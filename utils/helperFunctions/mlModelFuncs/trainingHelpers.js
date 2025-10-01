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
    const statMap = statConfigMap[sport.espnSport].default;
    const inputSize = statMap.length;

    const hyperParams = getHyperParams(sport, false);
    const hiddenLayerCount = hyperParams.hiddenLayerNum;
    const dropoutRate = hyperParams.dropoutReg || 0;

    // 1. Get input-to-gated weights (feature gating layer)
    const inputToGateWeights = model.layers[1].getWeights()[0]; // weights of the featureGate layer (sigmoid)
    
    // 2. Multiply layer (element-wise gating), so multiply input by gate weights
    const gatedInputWeights = tf.mul(inputToGateWeights, tf.onesLike(inputToGateWeights)); // element-wise multiply

    let currentWeights = gatedInputWeights;

    // 3. Traverse through hidden layers
    let layerPointer = 3; // model.layers[0] = input, [1] = featureGate, [2] = multiply, [3+] = dense layers

    for (let i = 0; i < hiddenLayerCount; i++) {
        // Skip batch norm or activation layers
        while (layerPointer < model.layers.length &&
               model.layers[layerPointer].getWeights().length === 0) {
            layerPointer++;
        }

        const denseLayer = model.layers[layerPointer];
        const weights = denseLayer.getWeights()[0]; // weight matrix

        currentWeights = tf.matMul(currentWeights, weights);
        layerPointer++;
    }

    // 4. Connect to output layer (scoreOutput)
    const scoreOutputLayer = model.getLayer('scoreOutput');
    const finalWeights = scoreOutputLayer.getWeights()[0]; // shape: [last_hidden_units, 1]

    const featureToOutput = tf.matMul(currentWeights, finalWeights); // shape: [input_features, 1]

    // 5. Normalize importance scores
    let importanceScores = tf.abs(featureToOutput).sum(1); // sum across output
    importanceScores = importanceScores.div(importanceScores.max()); // normalize [0, 1]

    const scoresArr = await importanceScores.array();

    const featureImportanceWithLabels = statMap.map((stat, i) => ({
        feature: stat,
        importance: scoresArr[i]
    }));

    // Optional: Save raw weights for debugging or UI
    const inputToHiddenWeights = await inputToGateWeights.array(); // raw feature gate weights
    const hiddenToOutputWeights = await finalWeights.array();

    // 6. Save to DB
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
const extractSportFeatures = (homeStats, awayStats, league, gameData, sortedGames, home) => {
    let gameDate = new Date(gameData.commence_time)
    let hourOfDay = gameDate.getHours() + (gameDate.getMinutes() / 60); // e.g., 14.5 for 2:30 PM
    let isHome = home ? 1 : 0;
    // let teamId = home ? gameData.homeTeam : gameData.awayTeam
    // let pastTeamGames = sortedGames.find(g => (g.homeTeam === teamId || g.awayTeam === teamId) && new Date(g.commence_time) < gameDate)
    // let restDays = pastTeamGames ? moment(gameDate).diff(moment(new Date(pastTeamGames.commence_time)), 'days') : 7

    switch (league) {
        case 'americanfootball_nfl':
            return footballStatMap.map(key => getNumericStat(homeStats, key))
                .concat(footballStatMap.map(key => getNumericStat(awayStats, key)))
                .concat([hourOfDay])
                .concat([isHome])
                // .concat([restDays]);
        case 'americanfootball_ncaaf':
            return footballStatMap.map(key => getNumericStat(homeStats, key))
                .concat(footballStatMap.map(key => getNumericStat(awayStats, key)))
                .concat([hourOfDay])
                .concat([isHome])
                // .concat([restDays]);
        case 'icehockey_nhl':
            return hockeyStatMap.map(key => getNumericStat(homeStats, key))
                .concat(hockeyStatMap.map(key => getNumericStat(awayStats, key)))
                .concat([hourOfDay])
                .concat([isHome])
                // .concat([restDays]);
        case 'baseball_mlb':
            return baseballStatMap.map(key => getNumericStat(homeStats, key))
                .concat(baseballStatMap.map(key => getNumericStat(awayStats, key)))
                .concat([hourOfDay])
                .concat([isHome])
                // .concat([restDays]);
        case 'basketball_ncaab':
            return basketballStatMap.map(key => getNumericStat(homeStats, key))
                .concat(basketballStatMap.map(key => getNumericStat(awayStats, key)))
                .concat([hourOfDay])
                .concat([isHome])
                // .concat([restDays]);
        case 'basketball_wncaab':
            return basketballStatMap.map(key => getNumericStat(homeStats, key))
                .concat(basketballStatMap.map(key => getNumericStat(awayStats, key)))
                .concat([hourOfDay])
                .concat([isHome])
                // .concat([restDays]);
        case 'basketball_nba':
            return basketballStatMap.map(key => getNumericStat(homeStats, key))
                .concat(basketballStatMap.map(key => getNumericStat(awayStats, key)))
                .concat([hourOfDay])
                .concat([isHome])
                // .concat([restDays]);
        default:
            return [];
    }
}



const getHyperParams = (sport, search) => {
    const useDropoutReg = (sport.name === 'basketball_nba' || sport.name === 'icehockey_nhl');
    if (useDropoutReg) {
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
            // l2reg: search
            //     ? sport.hyperParameters.l2reg
            //     : sport['hyperParams.l2Reg'],
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
            decayFactor: search ? sport.hyperParameters.gameDecayValue : sport['hyperParams.decayFactor'],
            gameDecayThreshold: search ? sport.hyperParameters.decayStepSize : sport['hyperParams.gameDecayThreshold'],
            historyLength: search ? sport.hyperParameters.historyLength : sport['hyperParams.historyLength'],
            earlyStopPatience: search
                ? sport.hyperParameters.earlyStopPatience
                : sport['hyperParams.earlyStopPatience']
        };
    }
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
        // l2reg: search
        //     ? sport.hyperParameters.l2reg
        //     : sport['hyperParams.l2Reg'],
        hiddenLayerNum: search
            ? sport.hyperParameters.hiddenLayerNum
            : sport['hyperParams.hiddenLayers'],
        layerNeurons: search
            ? sport.hyperParameters.layerNeurons
            : sport['hyperParams.layerNeurons'],
        kFolds: search ? sport.hyperParameters.kFolds : sport['hyperParams.kFolds'], // always comes from the saved hyperParams
        decayFactor: search ? sport.hyperParameters.gameDecayValue : sport['hyperParams.decayFactor'],
        gameDecayThreshold: search ? sport.hyperParameters.decayStepSize : sport['hyperParams.gameDecayThreshold'],
        historyLength: search ? sport.hyperParameters.historyLength : sport['hyperParams.historyLength'],
        earlyStopPatience: search
            ? sport.hyperParameters.earlyStopPatience
            : sport['hyperParams.earlyStopPatience']
    };
};


const repeatPredictions = async (model, inputTensor, numPasses) => {
    const predictions = [];
    const winProbs = []

    for (let i = 0; i < numPasses; i++) {
        const predictedScores = model.predict(inputTensor);
        let score = predictedScores.arraySync()
        predictions.push(score[0]);

    }
    // Average over all passes
    const averagedScore = predictions[0].map((_, i) =>
        predictions.reduce((sum, run) => sum + run[i], 0) / numPasses
    );
    return [averagedScore];
};

const loadOrCreateModel = async (xs, sport, search) => {
    const modelPath = `./model_checkpoint/${sport.name}_model/model.json`;
    try {
        // if (fs.existsSync(modelPath) && !search) {
        //     return await tf.loadLayersModel(`file://${modelPath}`);
        // } else {
        const hyperParams = getHyperParams(sport, search);
        const l2Strength = hyperParams.l2reg || 0; // Default L2 regularization strength
        const initializer = tf.initializers.randomNormal({ seed: 122021 });
        const useBatchNorm = (sport.name === 'basketball_ncaab');
        const useDropoutEveryOther = (sport.name === 'basketball_nba' || sport.name === 'icehockey_nhl');


        const input = tf.input({ shape: [xs[0].length] });

        const featureGate = tf.layers.dense({
            units: xs[0].length,
            activation: 'sigmoid'
        }).apply(input);

        const gatedInput = tf.layers.multiply().apply([input, featureGate]);

        let shared = gatedInput;


        for (let i = 0; i < hyperParams.hiddenLayerNum; i++) {
            let dense = tf.layers.dense({
                units: hyperParams.layerNeurons,
                useBias: true,
                activation: null, // Activation will be applied separately
                // kernelInitializer: initializer, // optional
            }).apply(shared);

            if (useBatchNorm) {
                dense = tf.layers.batchNormalization().apply(dense);
                dense = tf.layers.leakyReLU({ alpha: 0.3 }).apply(dense); // or ReLU if preferred
            }

            dense = tf.layers.reLU().apply(dense);

            if (useDropoutEveryOther && i % 2 === 0) {
                dense = tf.layers.dropout({ rate: hyperParams.dropoutReg * 2 }).apply(dense);
            }

            // Add residual connection every 2 layers (skip connection)
            if (i > 0 && i % 2 === 0) {
                shared = tf.layers.add().apply([shared, dense]); // residual connection
            } else {
                shared = dense;
            }
        }

        // Score output: regression head (predicts team score)
        const scoreOutput = tf.layers.dense({
            units: 1, activation: 'linear', name: 'scoreOutput',
            // kernelRegularizer: tf.regularizers.l2({ l2: l2Strength })
        }).apply(shared);
        // Define the model
        const model = tf.model({
            inputs: input,
            outputs: [scoreOutput]
        });
        return model;

        // }
    } catch (err) {
        console.error("Model loading/creation error:", err);
    }
};

const mlModelTraining = async (gameData, sport, search, gameCount, allPastGames, final) => {
    const statMap = statConfigMap[sport.espnSport].default;
    let hyperParams = await getHyperParams(sport, search)

    xs = []
    ysWins = []
    ysScore = []
    let teamStatsHistory = {};
    // Step 1: Flatten all scores into one array
    let allScores = allPastGames.flatMap(game => [game.homeScore, game.awayScore]);

    // Step 2: Compute mean
    let scoreMean = allScores.reduce((acc, score) => acc + score, 0) / allScores.length;

    // Step 3: Compute standard deviation
    let scoreStdDev = Math.sqrt(
        allScores.reduce((acc, score) => acc + Math.pow(score - scoreMean, 2), 0) / allScores.length
    );
    let progress
    let bar
    if (final) {
        bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
        let totalGames = gameData.length
        progress = 0;
        bar.start(totalGames, 0);
    }
    // --- Feature Extraction + Labeling ---
    let sortedGameData = gameData.sort((a, b) => new Date(b.commence_time) - new Date(a.commence_time))
    for (const game of gameData) {
        const homeStats = game['homeStats.data'];
        const awayStats = game['awayStats.data'];

        const normalizedHome = getZScoreNormalizedStats(homeStats, teamStatsHistory, game.homeTeam, false, search, sport);
        const normalizedAway = getZScoreNormalizedStats(awayStats, teamStatsHistory, game.awayTeam, false, search, sport);

        if (!normalizedHome || !normalizedAway) {
            console.log(game.id);
            continue;
        }

        const homeStatFeatures = await extractSportFeatures(normalizedHome, normalizedAway, sport.name, game, sortedGameData, true);
        const homeScoreLabel = ((game.homeScore - scoreMean) / scoreStdDev);

        xs.push(homeStatFeatures);
        ysScore.push(homeScoreLabel);


        const awayStatFeatures = await extractSportFeatures(normalizedAway, normalizedHome, sport.name, game, sortedGameData, false);
        const awayScoreLabel = ((game.awayScore - scoreMean) / scoreStdDev);

        xs.push(awayStatFeatures);
        ysScore.push(awayScoreLabel);

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
        if (final) {
            progress += 1;
            bar.update(progress);
        }
    }
    if (final) bar.stop()
    checkFeatureLeakage(xs, ysScore);

    // --- Tensor Conversion ---
    const xsTensor = tf.tensor2d(xs);
    const ysScoresTensor = tf.tensor2d(ysScore, [ysScore.length, 1]);

    // --- Create train/validation splits manually ---
    const totalSamples = xsTensor.shape[0];
    const valSize = Math.floor(totalSamples * 0.3);
    const trainSize = totalSamples - valSize;

    const xsTrain = xsTensor.slice([0, 0], [trainSize, xsTensor.shape[1]]);
    const ysScoresTrain = ysScoresTensor.slice([0, 0], [trainSize, ysScoresTensor.shape[1]]);

    const xsVal = xsTensor.slice([trainSize, 0], [valSize, xsTensor.shape[1]]);
    const ysScoresVal = ysScoresTensor.slice([trainSize, 0], [valSize, ysScoresTensor.shape[1]]);


    // --- Model Setup ---
    const model = await loadOrCreateModel(xs, sport, search);

    model.compile({
        optimizer: tf.train.adam(hyperParams.learningRate),
        loss: {
            scoreOutput: 'meanSquaredError'
        },
        lossWeights: {
            scoreOutput: hyperParams.scoreLoss
        },
        metrics: {
            scoreOutput: ['mae']
        }
    });

    await model.fit(xsTrain, ysScoresTrain, {
        epochs: hyperParams.epochs,
        batchSize: hyperParams.batchSize,
        validationData: [xsVal, ysScoresVal],
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

    return { model, updatedGameCount: gameCount, teamStatsHistory };
};

const predictions = async (sportOdds, ff, model, sport, past, search, teamHistory, pastGames) => {
    console.info(`STARTING PREDICTIONS FOR ${sport.name} @ ${moment().format('HH:mm:ss')}`);

    if (past) {
        sportOdds = sportOdds.filter(game =>
            game.predictedWinner === 'home' || game.predictedWinner === 'away'
        );
    }

    let sportOddsHomeAwaySplit = sportOdds.filter(g => g.winner === 'home').length / sportOdds.length;
    // Stats and counters
    let minScorePredicted = Infinity;
    let maxScorePredicted = -Infinity;
    let minScoreReal = Infinity
    let maxScoreReal = -Infinity
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

    const teamStatsHistory = teamHistory; // pastGames is now the map

    // Step 1: Flatten all scores into one array
    let allScores = pastGames.flatMap(game => [game.homeScore, game.awayScore]);

    // Step 2: Compute mean
    let testScoreMean = allScores.reduce((acc, score) => acc + score, 0) / allScores.length;

    // Step 3: Compute standard deviation
    let testScoreStdDev = Math.sqrt(
        allScores.reduce((acc, score) => acc + Math.pow(score - testScoreMean, 2), 0) / allScores.length
    );
    let sortedPastGames = pastGames.sort((a, b) => new Date(b.commence_time) - new Date(a.commence_time))
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

        const homeStatFeatures = await extractSportFeatures(normalizedHome, normalizedAway, sport.name, game, sortedPastGames, true);
        const awayStatFeatures = await extractSportFeatures(normalizedAway, normalizedHome, sport.name, game, sortedPastGames, false);

        const homeInputTensor = tf.tensor2d([homeStatFeatures]);
        const awayInputTensor = tf.tensor2d([awayStatFeatures]);

        const homePredictions = await repeatPredictions(model, homeInputTensor, 10);
        const awayPredictions = await repeatPredictions(model, awayInputTensor, 10);
        homeInputTensor.dispose();
        awayInputTensor.dispose();

        let homeScore = (homePredictions[0] * testScoreStdDev) + testScoreMean;
        let awayScore = (awayPredictions[0] * testScoreStdDev) + testScoreMean;

        if (homeScore < 0) homeScore = 0
        if (awayScore < 0) awayScore = 0
        // Prediction confidence is the probability of the predicted winner

        let predictionConfidence = 1 / (1 + Math.exp(-Math.abs(homeScore - awayScore)));

        // Avoid ties
        if (Math.round(homeScore) === Math.round(awayScore)) {
            tieGames++;
            let homeWinProb = 1 / (1 + Math.exp(-Math.abs(homeScore - awayScore)));
            let awayWinProb = 1 / (1 + Math.exp(-Math.abs(awayScore - homeScore)));
            if (sport.name === 'americanfootball_nfl' || sport.name === 'americanfootball_ncaaf') {
                homeWinProb > awayWinProb ? homeScore += 7 : awayScore += 7;
            } else {
                homeWinProb > awayWinProb ? homeScore++ : awayScore++;
            }

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

            if ((homeScore > awayScore && predictionConfidence < 0.5) ||
                (homeScore < awayScore && predictionConfidence > 0.5)) {
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

            if (homeScore > maxScorePredicted) maxScorePredicted = Math.round(homeScore);
            if (awayScore > maxScorePredicted) maxScorePredicted = Math.round(awayScore);
            if (homeScore < minScorePredicted) minScorePredicted = Math.round(homeScore);
            if (awayScore < minScorePredicted) minScorePredicted = Math.round(awayScore);
            if (game.homeScore > maxScoreReal) maxScoreReal = Math.round(game.homeScore);
            if (game.awayScore > maxScoreReal) maxScoreReal = Math.round(game.awayScore);
            if (game.homeScore < minScoreReal) minScoreReal = Math.round(game.homeScore);
            if (game.awayScore < minScoreReal) minScoreReal = Math.round(game.awayScore);
        }

        if (!past && !search) {
            await db.Games.update(updatePayload, { where: { id: game.id } });
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
        console.log(`PREDICTION SCORE RANGE: [${minScorePredicted} - ${maxScorePredicted}] REAL SCORE RANGE: [${minScoreReal} - ${maxScoreReal}]`)
        console.log(`OUT OF ${sportOdds.length} GAMES [TOTAL WINS: ${totalWins}, TOTAL LOSSES: ${totalLosses}]: MATCHED SPREADS: ${spreadMatch} MATCHED SCORES: ${matchedScore} MISMATCHED PREDICTIONS: ${misMatched} TIE GAMES: ${tieGames} HOME: ${home} AWAY: ${away}`);
    }

    let bucketCalibrationPenalty = 0;
    let bucketCount = 0;

    for (const bucket of confidenceBuckets) {
        if (bucket.total === 0) continue;

        const empiricalAccuracy = bucket.correct / bucket.total;
        const idealConfidence = bucket.range[1]; // upper bound is your "ideal"

        // Weight error more heavily for high-confidence buckets
        const weight = idealConfidence; // or Math.pow(idealConfidence, 2) for stronger penalty
        const error = weight * Math.abs(empiricalAccuracy - idealConfidence);

        bucketCalibrationPenalty += error;
        bucketCount++;
    }


    const scoreRangeMAE = (Math.abs(minScoreReal - minScorePredicted) + Math.abs(maxScoreReal - maxScorePredicted)) / 2

    const avgBucketCalibrationError = bucketCount > 0 ? bucketCalibrationPenalty / bucketCount : 0;
    const calibrationScore = 1 - avgBucketCalibrationError; // closer to 1 is better

    for (const bucket of confidenceBuckets) {
        if (bucket.total === 0) continue;
        const acc = (bucket.correct / bucket.total * 100).toFixed(1);
        console.log(`Confidence ${Math.round(bucket.range[0] * 100)}–${Math.round(bucket.range[1] * 100)}%: Accuracy ${acc}% (${bucket.correct}/${bucket.total})`);
    }


    if (search) {
        const winRate = (totalWins / sportOdds.length) * 100;
        let predictedHomeAwaySplit = home / sportOdds.length;

        const splitMatchScore = Math.pow(1 - Math.abs(predictedHomeAwaySplit - sportOddsHomeAwaySplit) * 2, 2);
        // console.log(`(Winrate: ${(winRate * 100).toFixed(2)}%, Calibration: ${calibrationScore.toFixed(4)}`);

        return {
            winRate,
            calibrationScore,
            splitMatchScore,
            scoreRangeMAE
        };

    }



};

const trainSportModelKFold = async (sport, gameData, search) => {

    let hyperParams = await getHyperParams(sport, search)

    console.log(hyperParams)
    // Sort historical game data and slice off the most recent 10% for testing
    const sortedGameData = gameData
        .slice(0, gameData.length - (gameData.length > 3000 ? Math.floor(gameData.length * 0.10) : Math.floor(gameData.length * .30)));

    console.log(`${sortedGameData[0].commence_time.toLocaleString()} - ${sortedGameData[sortedGameData.length - 1].commence_time.toLocaleString()}`);

    const numFolds = hyperParams.kFolds;
    const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    const totalFolds = numFolds;

    let gameCount = 0;
    let foldResults = [];
    let finalModel;
    let progress = 0;

    bar.start(totalFolds, 0);

    let sortedPastGames = gameData.sort((a, b) => new Date(b.commence_time) - new Date(a.commence_time));

    // Step 1: Flatten all scores into one array
    let allScores = gameData.flatMap(game => [game.homeScore, game.awayScore]);

    // Step 2: Compute mean
    let testScoreMean = allScores.reduce((acc, score) => acc + score, 0) / allScores.length;

    // Step 3: Compute standard deviation
    let testScoreStdDev = Math.sqrt(
        allScores.reduce((acc, score) => acc + Math.pow(score - testScoreMean, 2), 0) / allScores.length
    );

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
            trainingData, sport, search, gameCount, sortedPastGames
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
        let sortedGamesForFeatures = gameData.sort((a, b) => new Date(b.commence_time) - new Date(a.commence_time))
        for (const game of testData) {
            const homeStats = game['homeStats.data'];
            const awayStats = game['awayStats.data'];
            const normalizedHome = getZScoreNormalizedStats(homeStats, teamStatsHistory, game.homeTeam, false, search, sport);
            const normalizedAway = getZScoreNormalizedStats(awayStats, teamStatsHistory, game.awayTeam, false, search, sport);


            if (!homeStats || !awayStats) {
                console.log(game.id);
                return;
            }
            const homeStatFeatures = await extractSportFeatures(normalizedHome, normalizedAway, sport.name, game, sortedGamesForFeatures, true)
            const homeScoreLabel = ((game.homeScore - testScoreMean) / testScoreStdDev);

            testXs.push(homeStatFeatures);
            testYsScore.push(homeScoreLabel);


            const awayStatFeatures = await extractSportFeatures(normalizedAway, normalizedHome, sport.name, game, sortedGamesForFeatures, false)
            const awayScoreLabel = ((game.awayScore - testScoreMean) / testScoreStdDev);

            testXs.push(awayStatFeatures);
            testYsScore.push(awayScoreLabel);

            if (awayStatFeatures.some(isNaN) || homeStatFeatures.some(isNaN)) {
                console.error('NaN detected in features during kFoldTest:', game.id);
                console.log(game.awayTeam, game.homeTeam);
                console.log(teamStatsHistory[game.homeTeam].length, teamStatsHistory[game.awayTeam].length);
                process.exit(0);
            }

            const homeTeamInput = tf.tensor2d([homeStatFeatures]);
            const awayTeamInput = tf.tensor2d([awayStatFeatures]);
            // Get predictions
            const homeScorePred = await repeatPredictions(model, homeTeamInput, 10);
            const awayScorePred = await repeatPredictions(model, awayTeamInput, 10);
            homeTeamInput.dispose();
            awayTeamInput.dispose();

            const [actualHome, actualAway] = [game.homeScore, game.awayScore];

            let [predHome, predAway] = [
                (homeScorePred[0] * testScoreStdDev) + testScoreMean,
                (awayScorePred[0] * testScoreStdDev) + testScoreMean
            ]
            const predSpread = predHome - predAway;
            const actualSpread = actualHome - actualAway;
            spreadErrors.push(Math.abs(predSpread - actualSpread));

            const predTotal = predHome + predAway;
            const actualTotal = actualHome + actualAway;
            totalErrors.push(Math.abs(predTotal - actualTotal));

            scorePredictionsArray.push(homeScorePred[0]);
            scorePredictionsArray.push(awayScorePred[0]);

            gameCount++;
        }

        // Evaluate fold
        const foldMetrics = evaluateFoldMetrics(
            testXs,
            testYsScore,
            scorePredictionsArray,
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

    let deNormalizedMAE = avgMAE * testScoreStdDev;

    console.log(`--- Overall Performance Avg MAE: ${deNormalizedMAE.toFixed(2)} ---`);

    if (!search) await db.HyperParams.update({
        scoreMAE: deNormalizedMAE,
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
            fullTrainingData, sport, search, gameCount, sortedPastGames
        );

        const testSlice = gameData
            .sort((a, b) => new Date(a.commence_time) - new Date(b.commence_time))
            .slice(gameData.length - (gameData.length > 3000 ? Math.floor(gameData.length * 0.10) : Math.floor(gameData.length * .30)));

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

        const { winRate,
            calibrationScore,
            splitMatchScore,
            scoreRangeMAE } = await predictions(testSlice, [], finalModel, sport, false, search, teamStatsHistory, gameData);
        console.log(`--- Overall WINRATE ON UNSEEN DATA: ${(winRate).toFixed(2)} ---`);

        const compositeScore =
            (winRate * 1.5) +                 // Strong positive effect
            (calibrationScore * 20) +         // 0.0–1.0 → 0–25
            (splitMatchScore * 25) +          // 0.0–1.0 → 0–25
            (-(scoreRangeMAE) * 3) +        // Moderate penalty (can be high)
            (-(avgSpreadMAE) * 1.5) +            // Lower penalty
            (-(avgTotalMAE) * 1.5) +             // Lower penalty
            (-(avgMAE) * 2.0);                // Slightly stronger penalty (since it's often lower range)

        console.log(`BREAKDOWN OF SCORE SOURCES:`);
        console.log(`  - WinRate: ${(winRate).toFixed(2)}`);
        console.log(`  - Calibration Score: ${(calibrationScore).toFixed(2)}`);
        console.log(`  - SplitMatchScore: ${(splitMatchScore).toFixed(2)}`);
        console.log(`  - ScoreRangeMAE: ${(scoreRangeMAE).toFixed(2)}`);
        console.log(`  - Spread MAE: ${(avgSpreadMAE).toFixed(2)}`);
        console.log(`  - Total MAE: ${(avgTotalMAE).toFixed(2)}`);
        console.log(`  - Avg MAE: ${(avgMAE).toFixed(2)}`);
        console.log(`-----------BREAKDOWN OF FINAL SCORE:--------------------`);
        console.log(`  - WinRate: ${(winRate * 1.5).toFixed(2)}`);
        console.log(`  + Calibration Score: ${(calibrationScore * 20).toFixed(2)}`);
        console.log(`  + SplitMatchScore: ${(splitMatchScore * 30).toFixed(2)}`);
        console.log(`  - ScoreRangeMAE: ${((-(scoreRangeMAE) * 3)).toFixed(2)}`);
        console.log(`  - Spread MAE: ${((-(avgSpreadMAE) * 1.5)).toFixed(2)}`);
        console.log(`  - Total MAE: ${((-(avgTotalMAE) * 1.5)).toFixed(2)}`);
        console.log(`  - Avg MAE: ${((-(avgMAE) * 2.0)).toFixed(2)}`);
        console.log(`--- FINAL HYPERPARAM SCORE: ${(compositeScore).toFixed(2)} ---`);
        tf.disposeVariables();
        tf.engine().reset();
        return winRate;
    }

    const fullTrainingData = gameData
        .sort((a, b) => new Date(a.commence_time) - new Date(b.commence_time)); // All


    const { model } = await mlModelTraining(
        fullTrainingData, sport, search, gameCount, sortedGameData, true
    );

    finalModel = model;


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
    await extractAndSaveFeatureImportances(finalModel, sport);

    if (global.gc) global.gc();

    console.log(`ml model done for ${sport.name} @ ${moment().format('HH:mm:ss')}`);
    return finalModel;
};

module.exports = { normalizeStat, extractSportFeatures, mlModelTraining, predictions, trainSportModelKFold, loadOrCreateModel, isValidStatBlock }