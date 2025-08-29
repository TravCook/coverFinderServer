const db = require('../../../models_sql');
const statsMinMax = require('../../seeds/sampledGlobalStats.json')
const fs = require('fs')
const path = require('path');
const tf = require('@tensorflow/tfjs-node');
const moment = require('moment')
const cliProgress = require('cli-progress');
const { baseballStatMap, basketballStatMap, footballStatMap, hockeyStatMap, statConfigMap } = require('../../statMaps')
const { evaluateFoldMetrics, printOverallMetrics } = require('./metricsHelpers')
const { getZScoreNormalizedStats } = require('./normalizeHelpers')

async function extractAndSaveFeatureImportances(model, sport) {
    const dropoutRate = sport['hyperParams.dropoutReg'] || 0;
    const hiddenLayerCount = sport['hyperParams.hiddenLayerNum'];

    let currentWeights = model.layers[1].getWeights()[0]; // Input to first hidden
    for (let i = 0; i < hiddenLayerCount; i++) {
        const layerIndex = 2 + i * (dropoutRate > 0 ? 2 : 1);
        const nextWeights = model.layers[layerIndex].getWeights()[0];
        currentWeights = tf.matMul(currentWeights, nextWeights);
    }

    const scoreOutputLayer = model.getLayer('scoreOutput');
    const finalWeights = scoreOutputLayer.getWeights()[0];
    const featureToOutput = tf.matMul(currentWeights, finalWeights);

    let importanceScores = tf.abs(featureToOutput).sum(1);
    importanceScores = importanceScores.div(importanceScores.max());

    const scoresArr = await importanceScores.array();
    const statMap = statConfigMap[sport.espnSport].default

    const featureImportanceWithLabels = statMap.map((stat, i) => ({
        feature: stat,
        importance: scoresArr[i]
    }));

    const inputToHiddenWeights = await model.layers[1].getWeights()[0].array();
    const hiddenToOutputWeights = await scoreOutputLayer.getWeights()[0].array();

    await db.MlModelWeights.upsert({
        sport: sport.id,
        inputToHiddenWeights,
        hiddenToOutputWeights,
        featureImportanceScores: featureImportanceWithLabels
    });
}

function pearsonCorrelation(x, y) {
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((acc, val, idx) => acc + val * y[idx], 0);
    const sumX2 = x.reduce((acc, val) => acc + val * val, 0);
    const sumY2 = y.reduce((acc, val) => acc + val * val, 0);

    const numerator = (n * sumXY) - (sumX * sumY);
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    if (denominator === 0) return 0;
    return numerator / denominator;
}

function checkFeatureLeakage(xs, ys) {
    const numFeatures = xs[0].length;
    for (let featureIdx = 0; featureIdx < numFeatures; featureIdx++) {
        const featureValues = xs.map(row => row[featureIdx]);
        const corr = pearsonCorrelation(featureValues, ys);
        if (Math.abs(corr) > 0.9) {  // Threshold, adjust as needed
            console.warn(`Potential leakage detected! Feature index ${featureIdx} has high correlation (${corr.toFixed(3)}) with target.`);
        }
    }
}

// Function to normalize a stat using the min-max scaling
const normalizeStat = (statName, value, games) => {
    const minMaxValues = statsMinMax[statName];
    if (!minMaxValues) {
        console.warn(`No min/max values found for stat: ${statName}`);
        return value; // If no min/max values, return original value (or handle differently)
    }
    const { min, max } = minMaxValues;
    // Avoid division by zero
    if (max === min) return 0;
    return (value - min) / (max - min); // Apply Min-Max Normalization
}

const getNumericStat = (stats, statName) => {
    if (!stats || stats[statName] === undefined) return 0;
    const val = stats[statName];
    if (typeof val === 'string' && val.includes('-')) {
        const [wins, losses] = val.split('-').map(Number);
        return wins;
    }
    return val;
};

const isValidStatBlock = (statsObj, sport) => {
    const config = statConfigMap[sport?.espnSport];
    if (!config || !config.default) return false;

    const requiredKeys = config.default;

    for (const key of requiredKeys) {
        if (!(key in statsObj)) return false;
    }

    for (const [key, val] of Object.entries(statsObj)) {
        if (typeof val === 'string') continue;
        if (typeof val !== 'number' || isNaN(val)) return false;
    }

    return true;
};



// Feature extraction per sport
const extractSportFeatures = (homeStats, awayStats, league) => {
    switch (league) {
        case 'americanfootball_nfl':
            return footballStatMap.map(key => getNumericStat(homeStats, key))
                .concat(footballStatMap.map(key => getNumericStat(awayStats, key)))
        case 'americanfootball_ncaaf':
            return footballStatMap.map(key => getNumericStat(homeStats, key))
                .concat(footballStatMap.map(key => getNumericStat(awayStats, key)))
        case 'icehockey_nhl':
            return hockeyStatMap.map(key => getNumericStat(homeStats, key))
                .concat(hockeyStatMap.map(key => getNumericStat(awayStats, key)))
        case 'baseball_mlb':
            return baseballStatMap.map(key => getNumericStat(homeStats, key))
                .concat(baseballStatMap.map(key => getNumericStat(awayStats, key)))
        case 'basketball_ncaab':
            return basketballStatMap.map(key => getNumericStat(homeStats, key))
                .concat(basketballStatMap.map(key => getNumericStat(awayStats, key)))
        case 'basketball_wncaab':
            return basketballStatMap.map(key => getNumericStat(homeStats, key))
                .concat(basketballStatMap.map(key => getNumericStat(awayStats, key)))
        case 'basketball_nba':
            return basketballStatMap.map(key => getNumericStat(homeStats, key))
                .concat(basketballStatMap.map(key => getNumericStat(awayStats, key)))
        default:
            return [];
    }
}



const getHyperParams = (sport, search) => {
    return {
        learningRate: search
            ? sport.hyperParameters.learningRate
            : sport['hyperParams.learningRate'],
        batchSize: search
            ? sport.hyperParameters.batchSize
            : sport['hyperParams.batchSize'],
        epochs: search
            ? sport.hyperParameters.epochs
            : sport['hyperParams.epochs'],
        l2reg: search
            ? sport.hyperParameters.l2reg
            : sport['hyperParams.l2Reg'],
        dropoutReg: search
            ? sport.hyperParameters.dropoutReg
            : sport['hyperParams.dropoutReg'],
        hiddenLayerNum: search
            ? sport.hyperParameters.hiddenLayerNum
            : sport['hyperParams.hiddenLayers'],
        layerNeurons: search
            ? sport.hyperParameters.layerNeurons
            : sport['hyperParams.layerNeurons'],
        kFolds: search ? sport.hyperParameters.kFolds : sport['hyperParams.kFolds'], // always comes from the saved hyperParams
        kernalInitializer: sport['hyperParams.kernalInitializer'] || 'glorotUniform',
        decayFactor: search ? sport.hyperParameters.gameDecayValue : sport['hyperParams.decayFactor'],
        gameDecayThreshold: search ? sport.hyperParameters.decayStepSize : sport['hyperParams.gameDecayThreshold'],
        historyLength: search ? sport.hyperParameters.historyLength : sport['hyperParams.historyLength'],
        scoreLoss: search
            ? sport.hyperParameters.scoreLossWeight
            : sport['hyperParams.scoreLoss'],
        winPctLoss: search
            ? sport.hyperParameters.winPctLossWeight
            : sport['hyperParams.winPctLoss'],
        earlyStopPatience: search
            ? sport.hyperParameters.earlyStopPatience
            : sport['hyperParams.earlyStopPatience']
    };
};

const loadOrCreateModel = async (xs, sport, search) => {
    const modelPath = `./model_checkpoint/${sport.name}_model/model.json`;
    try {
        if (fs.existsSync(modelPath) && !search) {
            return await tf.loadLayersModel(`file://${modelPath}`);
        } else {
            const hyperParams = getHyperParams(sport, search);
            const l2Strength = hyperParams.l2reg || 0; // Default L2 regularization strength
            const input = tf.input({ shape: [xs[0].length] });


            let shared = input
            for (let i = 0; i < hyperParams.hiddenLayerNum; i++) {
                shared = tf.layers.dense({
                    units: hyperParams.layerNeurons,
                    activation: 'relu',
                    // kernelRegularizer: tf.regularizers.l2({ l2: l2Strength })
                }).apply(shared);

                // shared = tf.layers.batchNormalization().apply(shared); // optional but good with ReLU variants
                // shared = tf.layers.leakyReLU({ alpha: 0.3 }).apply(shared);
                // if (i % 2 === 0) {
                // shared = tf.layers.dropout({ rate: hyperParams.dropoutReg }).apply(shared);
                // }
            }
            // Score output: regression head (predicts [homeScore, awayScore])
            const scoreOutput = tf.layers.dense({
                units: 2, activation: 'linear', name: 'scoreOutput',
                kernelRegularizer: tf.regularizers.l2({ l2: l2Strength })
            }).apply(shared);
            // Win probability output: classification head (sigmoid)
            const winProbOutput = tf.layers.dense({
                units: 1, activation: 'sigmoid', name: 'winProbOutput',
                // kernelRegularizer: tf.regularizers.l2({ l2: l2Strength })
            }).apply(shared);
            // Define the model
            const model = tf.model({
                inputs: input,
                outputs: [scoreOutput, winProbOutput]
            });
            return model;

        }
    } catch (err) {
        console.error("Model loading/creation error:", err);
    }
};
// const loadOrCreateModel = async (xs, sport, search) => {
//   const modelPath = `./model_checkpoint/${sport.name}_model/model.json`;
//   try {
//     if (fs.existsSync(modelPath) && !search) {
//       return await tf.loadLayersModel(`file://${modelPath}`);
//     } else {
//       const hyperParams = getHyperParams(sport, search);
//       const l2Strength = hyperParams.l2reg || 1e-4; // default small L2
//       const input = tf.input({ shape: [xs[0].length] });

//       // Helper function to add a residual dense block
//       function residualDenseBlock(x, units, dropoutRate = hyperParams.dropoutReg || 0.2) {
//         const dense1 = tf.layers.dense({
//           units,
//           kernelRegularizer: tf.regularizers.l2({ l2: l2Strength }),
//           useBias: false
//         }).apply(x);
//         const bn1 = tf.layers.batchNormalization().apply(dense1);
//         const act1 = tf.layers.leakyReLU({ alpha: 0.1 }).apply(bn1);
//         const dropout1 = tf.layers.dropout({ rate: dropoutRate }).apply(act1);

//         const dense2 = tf.layers.dense({
//           units,
//           kernelRegularizer: tf.regularizers.l2({ l2: l2Strength }),
//           useBias: false
//         }).apply(dropout1);
//         const bn2 = tf.layers.batchNormalization().apply(dense2);

//         // Residual connection: add input (x) and bn2
//         let shortcut = x;
//         // If dimensions mismatch, project x
//         if (x.shape[x.shape.length - 1] !== units) {
//           shortcut = tf.layers.dense({ units, useBias: false }).apply(x);
//           shortcut = tf.layers.batchNormalization().apply(shortcut);
//         }
//         const added = tf.layers.add().apply([bn2, shortcut]);
//         const output = tf.layers.leakyReLU({ alpha: 0.1 }).apply(added);
//         return output;
//       }

//       // Build shared layers with residual blocks
//       let shared = input;
//       for (let i = 0; i < hyperParams.hiddenLayerNum; i++) {
//         shared = residualDenseBlock(shared, hyperParams.layerNeurons, hyperParams.dropoutReg || 0.2);
//       }

//       // Dedicated head for score prediction (regression)
//       let scoreHead = shared;
//       for (let i = 0; i < 2; i++) {
//         scoreHead = tf.layers.dense({
//           units: Math.floor(hyperParams.layerNeurons / 2),
//           kernelRegularizer: tf.regularizers.l2({ l2: l2Strength }),
//           useBias: false
//         }).apply(scoreHead);
//         scoreHead = tf.layers.batchNormalization().apply(scoreHead);
//         scoreHead = tf.layers.leakyReLU({ alpha: 0.1 }).apply(scoreHead);
//         scoreHead = tf.layers.dropout({ rate: 0.3 }).apply(scoreHead);
//       }
//       const scoreOutput = tf.layers.dense({
//         units: 2,
//         activation: 'linear',
//         name: 'scoreOutput',
//         kernelRegularizer: tf.regularizers.l2({ l2: l2Strength })
//       }).apply(scoreHead);

//       // Dedicated head for win probability (classification)
//       let winProbHead = shared;
//       for (let i = 0; i < 1; i++) {
//         winProbHead = tf.layers.dense({
//           units: Math.floor(hyperParams.layerNeurons / 2),
//           kernelRegularizer: tf.regularizers.l2({ l2: l2Strength }),
//           useBias: false
//         }).apply(winProbHead);
//         winProbHead = tf.layers.batchNormalization().apply(winProbHead);
//         winProbHead = tf.layers.leakyReLU({ alpha: 0.1 }).apply(winProbHead);
//         winProbHead = tf.layers.dropout({ rate: 0.3 }).apply(winProbHead);
//       }
//       const winProbOutput = tf.layers.dense({
//         units: 1,
//         activation: 'sigmoid',
//         name: 'winProbOutput',
//         kernelRegularizer: tf.regularizers.l2({ l2: l2Strength })
//       }).apply(winProbHead);

//       const model = tf.model({
//         inputs: input,
//         outputs: [scoreOutput, winProbOutput]
//       });

//       return model;
//     }
//   } catch (err) {
//     console.error("Model loading/creation error:", err);
//   }
// };

const repeatPredictions = async (model, inputTensor, numPasses) => {
    const predictions = [];
    const winProbs = []

    for (let i = 0; i < numPasses; i++) {
        const [predictedScores, predictedWinProb] = await model.apply(inputTensor, { training: true });
        // const [predictedScores, predictedWinProb] = await model.predict(inputTensor);
        let score = predictedScores.arraySync()
        let winProb = predictedWinProb.arraySync()
        predictions.push(score[0]); // Each prediction is [homeScore, awayScore]
        winProbs.push(winProb[0])

    }
    // Average over all passes
    const averagedScore = predictions[0].map((_, i) =>
        predictions.reduce((sum, run) => sum + run[i], 0) / numPasses
    );
    const averagedWinProb = winProbs[0].map((_, i) =>
        winProbs.reduce((sum, run) => sum + run[i], 0) / numPasses
    );
    return [averagedScore, averagedWinProb]; // Returns [avgHomeScore, avgAwayScore]
};

const mlModelTraining = async (gameData, xs, ysWins, ysScore, sport, search, gameCount, sortedGameData) => {
    const statMap = statConfigMap[sport.espnSport].default;
    const hyperParams = await getHyperParams(sport, search)
    let teamStatsHistory = {};

    // --- Feature Extraction + Labeling ---
    for (const game of gameData) {
        const homeStats = game['homeStats.data'];
        const awayStats = game['awayStats.data'];

        const normalizedHome = getZScoreNormalizedStats(homeStats, teamStatsHistory, game.homeTeam, false, search, sport);
        const normalizedAway = getZScoreNormalizedStats(awayStats, teamStatsHistory, game.awayTeam, false, search, sport);

        if (!normalizedHome || !normalizedAway) {
            console.log(game.id);
            continue;
        }

        const statFeatures = await extractSportFeatures(normalizedHome, normalizedAway, sport.name)
        const winLabel = game.winner === 'home' ? 1 : 0;
        const scoreLabel = [game.homeScore, game.awayScore];
        if (statFeatures.some(isNaN) || scoreLabel == null) {
            console.error('NaN or invalid value detected in features during Training:', game.id);
            process.exit(0);
        }
        xs.push(statFeatures);
        ysWins.push([winLabel]);
        ysScore.push(scoreLabel);

        const homeTeamId = game.homeTeam;
        const awayTeamId = game.awayTeam;

        if (isValidStatBlock(homeStats, sport)) {
            if (!teamStatsHistory[homeTeamId]) teamStatsHistory[homeTeamId] = [];
            teamStatsHistory[homeTeamId].push(homeStats);
            if (teamStatsHistory[homeTeamId].length > hyperParams.historyLength) {
                teamStatsHistory[homeTeamId].shift();
            }
        }

        if (isValidStatBlock(awayStats, sport)) {
            if (!teamStatsHistory[awayTeamId]) teamStatsHistory[awayTeamId] = [];
            teamStatsHistory[awayTeamId].push(awayStats);
            if (teamStatsHistory[awayTeamId].length > hyperParams.historyLength) {
                teamStatsHistory[awayTeamId].shift();
            }
        }

        gameCount++;
    }
    checkFeatureLeakage(xs, ysScore, ysWins);

    // --- Tensor Conversion ---
    const xsTensor = tf.tensor2d(xs);
    const ysScoresTensor = tf.tensor2d(ysScore, [ysScore.length, 2]);
    const ysWinLabelsTensor = tf.tensor2d(ysWins, [ysWins.length, 1]);

    // --- Create train/validation splits manually ---
    const totalSamples = xsTensor.shape[0];
    const valSize = Math.floor(totalSamples * 0.3);
    const trainSize = totalSamples - valSize;

    const xsTrain = xsTensor.slice([0, 0], [trainSize, xsTensor.shape[1]]);
    const ysScoresTrain = ysScoresTensor.slice([0, 0], [trainSize, ysScoresTensor.shape[1]]);
    const ysWinTrain = ysWinLabelsTensor.slice([0, 0], [trainSize, ysWinLabelsTensor.shape[1]]);

    const xsVal = xsTensor.slice([trainSize, 0], [valSize, xsTensor.shape[1]]);
    const ysScoresVal = ysScoresTensor.slice([trainSize, 0], [valSize, ysScoresTensor.shape[1]]);
    const ysWinVal = ysWinLabelsTensor.slice([trainSize, 0], [valSize, ysWinLabelsTensor.shape[1]]);

    // --- Model Setup ---
    const model = await loadOrCreateModel(xs, sport, search);

    model.compile({
        optimizer: tf.train.adam(hyperParams.learningRate),
        loss: {
            scoreOutput: 'meanSquaredError',
            winProbOutput: 'binaryCrossentropy',
        },
        lossWeights: {
            scoreOutput: hyperParams.scoreLoss,
            winProbOutput: hyperParams.winPctLoss,
        },
        metrics: {
            scoreOutput: ['mae'],
            winProbOutput: ['binaryAccuracy'],
        }
    });

    await model.fit(xsTrain, {
        scoreOutput: ysScoresTrain,
        winProbOutput: ysWinTrain,
    }, {
        epochs: hyperParams.epochs,
        batchSize: hyperParams.batchSize,
        validationData: [xsVal, { scoreOutput: ysScoresVal, winProbOutput: ysWinVal }],
        verbose: false,
        callbacks: [
            tf.callbacks.earlyStopping({
                monitor: 'val_loss',
                patience: hyperParams.earlyStopPatience,
                restoreBestWeight: true
            })
        ]
    });

    // --- Clean up ---
    xsTensor.dispose();
    ysScoresTensor.dispose();
    ysWinLabelsTensor.dispose();
    xsTrain.dispose();
    ysScoresTrain.dispose();
    ysWinTrain.dispose();
    xsVal.dispose();
    ysScoresVal.dispose();
    ysWinVal.dispose();

    return { model, updatedGameCount: gameCount, teamStatsHistory };
};

const predictions = async (sportOdds, ff, model, sport, past, search, pastGames) => {
    console.info(`STARTING PREDICTIONS FOR ${sport.name} @ ${moment().format('HH:mm:ss')}`);

    if (past) {
        sportOdds = sportOdds.filter(game =>
            game.predictedWinner === 'home' || game.predictedWinner === 'away'
        );
    }

    let sportOddsHomeAwaySplit = sportOdds.filter(g => g.winner === 'home').length / sportOdds.length;
    // Stats and counters
    let predictionsChanged = 0;
    let newWinnerPredictions = 0;
    let newLoserPredictions = 0;
    let totalWins = 0;
    let totalLosses = 0;
    let newConfidencePredictions = 0;
    let highConfGames = 0;
    let highConfLosers = 0;

    let fiftyfiftyMatchups = 0;
    let sixtyToSeventyMatchups = 0;
    let seventyToEightyMatchups = 0;
    let eightyToNinetyMatchups = 0;

    let misMatched = 0;
    let matchedScore = 0;
    let spreadMatch = 0;
    let totalMatch = 0;
    let tieGames = 0;
    let home = 0
    let away = 0

    let confidenceBuckets
    if (sport.name === 'americanfootball_nfl' || sport.name === 'basketball_nba' || sport.name === 'icehockey_nhl') {

        confidenceBuckets = [
            { range: [0.5, 0.6], total: 0, correct: 0 },
            { range: [0.6, 0.7], total: 0, correct: 0 },
            { range: [0.7, 0.8], total: 0, correct: 0 },
            { range: [0.8, 0.9], total: 0, correct: 0 },
            { range: [0.9, 1], total: 0, correct: 0 },
        ];
    }
    else {

        confidenceBuckets = [
            { range: [0.5, 0.55], total: 0, correct: 0 },
            { range: [0.55, 0.6], total: 0, correct: 0 },
            { range: [0.6, 0.65], total: 0, correct: 0 },
            { range: [0.65, 0.7], total: 0, correct: 0 },
            { range: [0.7, 0.75], total: 0, correct: 0 },
            { range: [0.75, 0.8], total: 0, correct: 0 },
            { range: [0.8, 0.85], total: 0, correct: 0 },
            { range: [0.85, 0.9], total: 0, correct: 0 },
            { range: [0.9, 0.95], total: 0, correct: 0 },
            { range: [0.95, 1], total: 0, correct: 0 },
        ];

    }


    const teamStatsHistory = pastGames; // pastGames is now the map

    for (const game of sportOdds) {
        if (new Date(game.commence_time) < new Date() && !search) continue
        const homeRawStats = game['homeStats.data'];
        const awayRawStats = game['awayStats.data'];

        const normalizedHome = getZScoreNormalizedStats(homeRawStats, teamStatsHistory, game.homeTeam, false, search, sport);
        const normalizedAway = getZScoreNormalizedStats(awayRawStats, teamStatsHistory, game.awayTeam, false, search, sport);


        if (!normalizedHome || !normalizedAway) {
            console.log(game.id);
            return;
        }

        const statFeatures = await extractSportFeatures(normalizedHome, normalizedAway, sport.name)

        if (statFeatures.some(isNaN)) {
            console.error('NaN detected in features Predictions:', game.id);
            return;
        }
        const [predScore, predWinProb] = await repeatPredictions(model, tf.tensor2d([statFeatures]), search ? 10 : 100);
        let [homeScore, awayScore] = predScore;


        let predictionConfidence = predWinProb > 0.5 ? predWinProb[0] : 1 - predWinProb[0];

        // Avoid ties
        if (Math.round(homeScore) === Math.round(awayScore)) {
            tieGames++;
            predWinProb[0] > 0.5 ? homeScore++ : awayScore++;
        }
        let predictedWinner = homeScore > awayScore ? 'home' : 'away';
        if (predictedWinner === 'home') home++;
        else away++;
        const updatePayload = {
            predictedWinner,
            predictionConfidence,
            predictedHomeScore: Math.round(homeScore),
            predictedAwayScore: Math.round(awayScore),
        };

        // Track changes and distributions
        // if (game.predictedWinner !== predictedWinner) {
        //     predictionsChanged++;

            if (!past && !search) {
                const oldWinner = game.predictedWinner === 'home'
                    ? game['homeTeamDetails.espnDisplayName']
                    : game['awayTeamDetails.espnDisplayName'];
                const newWinner = predictedWinner === 'home'
                    ? game['homeTeamDetails.espnDisplayName']
                    : game['awayTeamDetails.espnDisplayName'];

                console.log(`Prediction changed for game ${game.id}: ${predictedWinner === 'home' ? 'HOME' : 'AWAY'} ${oldWinner} → ${newWinner}  (Confidence: ${predictionConfidence}) Score ([home, away]) [${Math.round(homeScore)}, ${Math.round(awayScore)}]`);
            }
        // }

        if (game.predictionConfidence !== predictionConfidence) {
            newConfidencePredictions++;
        }

        // Confidence distribution
        if (predictionConfidence > 0.9) highConfGames++;
        else if (predictionConfidence < 0.6) fiftyfiftyMatchups++;
        else if (predictionConfidence < 0.7) sixtyToSeventyMatchups++;
        else if (predictionConfidence < 0.8) seventyToEightyMatchups++;
        else if (predictionConfidence < 0.9) eightyToNinetyMatchups++;

        // Past-game evaluation
        if (past || search) {
            updatePayload.predictionCorrect = predictedWinner === game.winner;

            const predictionChanged = predictedWinner !== game.predictedWinner;
            const wasCorrect = predictedWinner === game.winner;

            if (wasCorrect) totalWins++;
            else totalLosses++;

            if (predictionChanged && wasCorrect) newWinnerPredictions++;
            if (predictionChanged && !wasCorrect) newLoserPredictions++;

            if (predictionConfidence > 0.9 && !wasCorrect) highConfLosers++;

            if ((homeScore > awayScore && predWinProb < 0.5) ||
                (homeScore < awayScore && predWinProb > 0.5)) {
                misMatched++;
            }

            if (Math.round(homeScore) === game.homeScore ||
                Math.round(awayScore) === game.awayScore) {
                matchedScore++;
            }

            if (Math.abs(homeScore - awayScore) === Math.abs(game.homeScore - game.awayScore)) {
                spreadMatch++;
            }

            if ((homeScore + awayScore) === (game.homeScore + game.awayScore)) {
                totalMatch++;
            }
        }

        if (!past && !search) {
            // await db.Games.update(updatePayload, { where: { id: game.id } });
        }

        if (past || search) {
            for (let i = 0; i < confidenceBuckets.length; i++) {
                const bucket = confidenceBuckets[i];
                const [low, high] = confidenceBuckets[i].range;
                const isLastBucket = i === confidenceBuckets.length - 1;

                if (
                    predictionConfidence >= low &&
                    (predictionConfidence < high || (isLastBucket && predictionConfidence === high))
                ) {
                    bucket.total++;
                    if (predictedWinner === game.winner) {
                        bucket.correct++;
                    }
                    break;
                }
            }

        }


    }
    // Summary output
    if (past || search) {
        console.log(`OUT OF ${sportOdds.length} GAMES [TOTAL WINS: ${totalWins}, TOTAL LOSSES: ${totalLosses}]: MATCHED SPREADS: ${spreadMatch} MATCHED SCORES: ${matchedScore} MISMATCHED PREDICTIONS: ${misMatched} TIE GAMES: ${tieGames} HOME: ${home} AWAY: ${away}`);
    }

    let bucketCalibrationPenalty = 0;
    let bucketCount = 0;

    for (const bucket of confidenceBuckets) {
        if (bucket.total === 0) continue;

        const empiricalAccuracy = bucket.correct / bucket.total;
        const idealConfidence = bucket.range[1]; // upper bound is your "ideal"

        // Penalize both overconfidence and underconfidence
        const error = Math.abs(empiricalAccuracy - idealConfidence);

        bucketCalibrationPenalty += error;
        bucketCount++;
    }

    const avgBucketCalibrationError = bucketCount > 0 ? bucketCalibrationPenalty / bucketCount : 0;
    const calibrationScore = 1 - avgBucketCalibrationError; // closer to 1 is better

    for (const bucket of confidenceBuckets) {
        if (bucket.total === 0) continue;
        const acc = (bucket.correct / bucket.total * 100).toFixed(1);
        console.log(`Confidence ${Math.round(bucket.range[0] * 100)}–${Math.round(bucket.range[1] * 100)}%: Accuracy ${acc}% (${bucket.correct}/${bucket.total})`);
    }


    if (search) {
        const winRate = totalWins / sportOdds.length;
        let predictedHomeAwaySplit = home / sportOdds.length;

        const splitMatchScore = Math.pow(1 - Math.abs(predictedHomeAwaySplit - sportOddsHomeAwaySplit) * 2, 2);


        // Updated weights
        const WINRATE_WEIGHT = 0.5;
        const CALIBRATION_WEIGHT = 0.3;


        const combinedScore =
            (winRate * WINRATE_WEIGHT) +
            (calibrationScore * CALIBRATION_WEIGHT)
        // matchedScore

        console.log(`(Winrate: ${(winRate * 100).toFixed(2)}%, Calibration: ${calibrationScore.toFixed(4)}, Combined Score: ${combinedScore.toFixed(4)} Combined Score with Split: ${(combinedScore * splitMatchScore).toFixed(4)})`);

        return {
            winRate,
            combinedScore: combinedScore * splitMatchScore,
        };

    }

};

const trainSportModelKFold = async (sport, gameData, search) => {
    const hyperParams = await getHyperParams(sport, search)
    console.log(hyperParams)
    // Sort historical game data and slice off the most recent 10% for testing
    const sortedGameData = gameData
        .sort((a, b) => new Date(a.commence_time) - new Date(b.commence_time))
        .slice(0, gameData.length - Math.floor(gameData.length * 0.10));

    console.log(`${sortedGameData[0].commence_time.toLocaleString()} - ${sortedGameData[sortedGameData.length - 1].commence_time.toLocaleString()}`);

    const numFolds = hyperParams.kFolds;
    const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    const totalFolds = numFolds;

    let gameCount = 0;
    let foldResults = [];
    let finalModel;
    let progress = 0;

    bar.start(totalFolds, 0);

    for (let foldIndex = 1; foldIndex <= numFolds; foldIndex++) {
        // Define training and validation split for this fold
        const trainEnd = Math.floor((foldIndex / (numFolds + 1)) * sortedGameData.length);
        const valStart = trainEnd;
        const valEnd = foldIndex === numFolds
            ? sortedGameData.length
            : Math.floor(((foldIndex + 1) / (numFolds + 1)) * sortedGameData.length);

        const trainingData = sortedGameData.slice(0, trainEnd);
        const testData = sortedGameData.slice(valStart, valEnd);

        // Train model
        const { model, updatedGameCount, teamStatsHistory } = await mlModelTraining(
            trainingData, [], [], [], sport, search, gameCount, sortedGameData
        );


        finalModel = model;
        gameCount = updatedGameCount;

        const testXs = [];
        const testYsScore = [];
        const testYsWins = [];

        const scorePredictionsArray = [];
        const winProbPredictionsArray = [];
        const spreadErrors = [];
        const totalErrors = [];



        for (const game of testData) {
            const homeStats = game['homeStats.data'];
            const awayStats = game['awayStats.data'];
            const normalizedHome = getZScoreNormalizedStats(homeStats, teamStatsHistory, game.homeTeam, false, search, sport);
            const normalizedAway = getZScoreNormalizedStats(awayStats, teamStatsHistory, game.awayTeam, false, search, sport);


            if (!homeStats || !awayStats) {
                console.log(game.id);
                return;
            }

            const statFeatures = await extractSportFeatures(normalizedHome, normalizedAway, sport.name)

            const homeScoreLabel = [game.homeScore, game.awayScore];
            const homeWinLabel = game.winner === 'home' ? 1 : 0;

            if (statFeatures.some(isNaN) || homeWinLabel == null) {
                console.error('NaN detected in features during kFoldTest:', game.id);
                console.log(game.awayTeam, game.homeTeam);
                console.log(teamStatsHistory[game.homeTeam].length, teamStatsHistory[game.awayTeam].length);
                process.exit(0);
            }

            testXs.push(statFeatures);
            testYsScore.push(homeScoreLabel);
            testYsWins.push(homeWinLabel);
            const [avgScore, avgWinProb] = await repeatPredictions(model, tf.tensor2d([statFeatures]), 10);
            const [predHome, predAway] = avgScore;
            const [actualHome, actualAway] = [game.homeScore, game.awayScore];

            const predSpread = predHome - predAway;
            const actualSpread = actualHome - actualAway;
            spreadErrors.push(Math.abs(predSpread - actualSpread));

            const predTotal = predHome + predAway;
            const actualTotal = actualHome + actualAway;
            totalErrors.push(Math.abs(predTotal - actualTotal));

            scorePredictionsArray.push(avgScore);
            winProbPredictionsArray.push(avgWinProb);

            gameCount++;
        }

        // Evaluate fold
        const foldMetrics = evaluateFoldMetrics(
            testXs,
            testYsScore,
            testYsWins,
            scorePredictionsArray,
            winProbPredictionsArray
        );

        const avgSpreadMAE = spreadErrors.reduce((a, b) => a + b, 0) / spreadErrors.length;
        const avgTotalMAE = totalErrors.reduce((a, b) => a + b, 0) / totalErrors.length;

        foldResults.push({
            foldIndex,
            ...foldMetrics,
            spreadMAE: avgSpreadMAE,
            totalMAE: avgTotalMAE
        });


        progress += 1;
        bar.update(progress);
    }

    bar.stop();

    // Aggregate results
    const { avgSpreadMAE, avgTotalMAE, avgMAE, totalCounts } = printOverallMetrics(foldResults);
    if (!search) await db.HyperParams.update({
        scoreMAE: avgMAE,
        totalMAE: avgTotalMAE,
        spreadMAE: avgSpreadMAE
    }, {
        where: {
            sport: sport.id
        }
    })

    if (search) {
        if (Object.values(totalCounts).some(count => count === 0)) {
            console.log(`--- WARNING: MODEL ONLY PREDICTED ONE CLASS ---`)
            console.log(`--- FINAL HYPERPARAM SCORE: 0 ---`);
            return 0;

        };
        // After k-folds
        const fullTrainingData = sortedGameData;
        const { model: finalModel } = await mlModelTraining(
            fullTrainingData, [], [], [], sport, search, gameCount, sortedGameData
        );

        const testSlice = gameData
            .sort((a, b) => new Date(a.commence_time) - new Date(b.commence_time))
            .slice(gameData.length - Math.floor(gameData.length * 0.10));

        const historyLength = hyperParams.historyLength || 10; // Default to 10 if not set
        const teamStatsHistory = {};

        for (const game of gameData.sort((a, b) => new Date(a.commence_time) - new Date(b.commence_time))) {
            const homeTeamId = game.homeTeam;
            const awayTeamId = game.awayTeam;

            if (!teamStatsHistory[homeTeamId]) teamStatsHistory[homeTeamId] = [];
            if (!teamStatsHistory[awayTeamId]) teamStatsHistory[awayTeamId] = [];

            if (isValidStatBlock(game['homeStats.data'], sport)) {
                teamStatsHistory[homeTeamId].push(game['homeStats.data']);
                if (teamStatsHistory[homeTeamId].length > historyLength) {
                    teamStatsHistory[homeTeamId].shift();
                }
            }

            if (isValidStatBlock(game['awayStats.data'], sport)) {
                teamStatsHistory[awayTeamId].push(game['awayStats.data']);
                if (teamStatsHistory[awayTeamId].length > historyLength) {
                    teamStatsHistory[awayTeamId].shift();
                }
            }
        }

        const { winRate, combinedScore } = await predictions(testSlice, [], finalModel, sport, false, search, teamStatsHistory);
        console.log(`--- Overall WINRATE ON UNSEEN DATA: ${(winRate * 100).toFixed(2)} ---`);

        const compositeScore =
            ((combinedScore * 100)) +           // ↓ Combined Score of winrate and calibration (done in predictions)
            (-(avgSpreadMAE) * 0.6) +           // ↓ Slightly reduce spread MAE penalty
            (-(avgTotalMAE) * 0.4) +            // ↓ Slightly reduce total MAE penalty
            (-(avgMAE) * 0.8);                  // ↑ Slight increase to avg MAE to differentiate
        console.log(`Composite Score Breakdown:`);
        console.log(`  - Combined Score (Winrate & Calibration): ${(combinedScore * 100).toFixed(2)}`);
        console.log(`  - Spread MAE Penalty: ${(-avgSpreadMAE * 0.6).toFixed(2)}`);
        console.log(`  - Total MAE Penalty: ${(-avgTotalMAE * 0.4).toFixed(2)}`);
        console.log(`  - Avg MAE Penalty: ${(-avgMAE * 0.8).toFixed(2)}`);
        console.log(`--- FINAL HYPERPARAM SCORE: ${(compositeScore).toFixed(2)} ---`);
        return compositeScore;
    }

    const fullTrainingData = gameData
        .sort((a, b) => new Date(a.commence_time) - new Date(b.commence_time)); // All
    const xs = [], ysWins = [], ysScore = [];

    const { model: retrainedModel } = await mlModelTraining(
        fullTrainingData, xs, ysWins, ysScore, sport, search, gameCount, sortedGameData
    );

    finalModel = retrainedModel;


    // // --- Model Saving ---
    if (!search) {
        const modelDir = `./model_checkpoint/${sport.name}_model`;
        if (!fs.existsSync(modelDir)) {
            console.log('Creating model directory...');
            fs.mkdirSync(modelDir, { recursive: true });
        }
        await finalModel.save(`file://${modelDir}`);
    }

    // // Extract feature importances
    // await extractAndSaveFeatureImportances(finalModel, sport);

    if (global.gc) global.gc();
    console.log(`ml model done for ${sport.name} @ ${moment().format('HH:mm:ss')}`);
    return finalModel;
};

module.exports = { normalizeStat, extractSportFeatures, mlModelTraining, predictions, trainSportModelKFold, loadOrCreateModel, isValidStatBlock }