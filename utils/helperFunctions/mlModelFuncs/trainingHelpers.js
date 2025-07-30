const db = require('../../../models_sql');
const statsMinMax = require('../../seeds/sampledGlobalStats.json')
const fs = require('fs')
const path = require('path');
const tf = require('@tensorflow/tfjs-node');
const moment = require('moment')
const cliProgress = require('cli-progress');
const { baseballStatMap, basketballStatMap, footballStatMap, hockeyStatMap, statConfigMap } = require('../../statMaps')
const { evaluateFoldMetrics, printOverallMetrics } = require('./metricsHelpers')

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

const isValidStatBlock = (statsObj) => {
    return Object.entries(statsObj).every(([key, val]) => {
        // Only check numeric-looking fields (not strings like "1-0")
        if (typeof val === 'string') return true;
        return typeof val === 'number' && !isNaN(val);
    });
}

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

const repeatPredictions = async (model, inputTensor, numPasses) => {
    const predictions = [];
    const winProbs = []

    for (let i = 0; i < numPasses; i++) {
        const [predictedScores, predictedWinProb] = await model.predict(inputTensor); // Shape: [1, 2]
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
        historyLength: search ? sport.hyperParameters.historyLength : sport['hyperParams.historyLength']
    };
};

const loadOrCreateModel = async (xs, sport, search) => {
    const modelPath = `./model_checkpoint/${sport.name}_model/model.json`;
    try {
        if (fs.existsSync(modelPath) && !search) {
            return await tf.loadLayersModel(`file://${modelPath}`);
        } else {
            const tf = require('@tensorflow/tfjs');
            const hyperParams = getHyperParams(sport, search);
            const l2Strength = hyperParams.l2reg || 0;
            const dropoutRate = hyperParams.dropoutReg || 0; // Optional

            const input = tf.input({ shape: [xs[0].length] });

            // Shared hidden layers
            let x = tf.layers.dense({
                units: hyperParams.layerNeurons,
                activation: 'relu',
                kernelRegularizer: tf.regularizers.l2({ l2: l2Strength }),
                biasInitializer: 'zeros',
            }).apply(input);

            for (let i = 0; i < hyperParams.hiddenLayerNum; i++) {
                x = tf.layers.dense({
                    units: hyperParams.layerNeurons,
                    activation: 'relu',
                    kernelRegularizer: tf.regularizers.l2({ l2: l2Strength }),
                    biasInitializer: 'zeros',
                }).apply(x);

                if (dropoutRate > 0) {
                    x = tf.layers.dropout({ rate: dropoutRate }).apply(x);
                }
            }

            // Score output: regression head (predicts [homeScore, awayScore])
            const scoreOutput = tf.layers.dense({
                units: 2,
                activation: 'linear',
                name: 'scoreOutput',
                kernelRegularizer: tf.regularizers.l2({ l2: l2Strength }),
            }).apply(x);

            // Win probability output: classification head (sigmoid)
            const winProbOutput = tf.layers.dense({
                units: 1,
                activation: 'sigmoid',
                name: 'winProbOutput',
                kernelRegularizer: tf.regularizers.l2({ l2: l2Strength }),
            }).apply(x);

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

const getZScoreNormalizedStats = (currentStats, teamStatsHistory, prediction, search, sport) => {
    const history = teamStatsHistory || [];

    if (history.length < 5) {

        return { ...currentStats }
    }


    // Normalize win-loss strings first
    const normalizeWinLoss = (value) => {
        if (typeof value === 'string') {
            const [wins, losses] = value.split('-').map(Number);
            return wins
        }
        return value !== undefined ? value : 0;
    };

    const transformedStats = { ...currentStats };
    ['seasonWinLoss', 'homeWinLoss', 'awayWinLoss'].forEach(key => {
        transformedStats[key] = normalizeWinLoss(transformedStats[key]);
    });

    const keys = Object.keys(transformedStats);
    const means = {};
    const stds = {};

    // Set decay hyperparameters
    const baseDecay = search ? sport.hyperParameters.gameDecayValue : sport['hyperParams.decayFactor'];     // Decay multiplier per step
    const stepSize = search ? sport.hyperParameters.decayStepSize : sport['hyperParams.gameDecayThreshold'];         // Decay every 1 step in history (from oldest to newest)
    keys.forEach(key => {
        const decayedValues = [];
        const weights = [];

        // Loop from oldest to newest
        for (let i = 0; i < history.length; i++) {
            const rawValue = normalizeWinLoss(history[i][key]);
            const stepsFromLatest = history.length - 1 - i;
            const weight = Math.pow(baseDecay, stepsFromLatest / stepSize);
            if (prediction) decayedValues.push(rawValue)
            if (!prediction) decayedValues.push(rawValue * weight);
            weights.push(weight);
        }
        const totalWeight = weights.reduce((a, b) => a + b, 0);
        const mean = decayedValues.reduce((sum, val) => sum + val, 0) / totalWeight;

        const variance = decayedValues.reduce((sum, val, i) => {
            return sum + weights[i] * Math.pow(val - mean, 2);
        }, 0) / totalWeight;
        means[key] = mean;
        stds[key] = Math.sqrt(variance) || 1;  // avoid divide-by-zero
    });

    const normalized = {};
    keys.forEach(key => {
        normalized[key] = (transformedStats[key] - means[key]) / stds[key];
    });

    return normalized;
};

const mlModelTraining = async (gameData, xs, ysWins, ysScore, sport, search, gameCount, sortedGameData) => {
    const statMap = statConfigMap[sport.espnSport].default;
    const hyperParams = await getHyperParams(sport, search)
    let teamStatsHistory = [];

    // --- Feature Extraction + Labeling ---
    for (const game of gameData) {
        const homeStats = game['homeStats.data'];
        const awayStats = game['awayStats.data'];

        const normalizedHome = getZScoreNormalizedStats(homeStats, teamStatsHistory, false, search, sport);
        const normalizedAway = getZScoreNormalizedStats(awayStats, teamStatsHistory, false, search, sport);

        if (!normalizedHome || !normalizedAway) {
            console.log(game.id);
            continue;
        }

        const statFeatures = extractSportFeatures(normalizedHome, normalizedAway, sport.name)
        const winLabel = game.winner === 'home' ? 1 : 0;
        const scoreLabel = [game.homeScore, game.awayScore];

        if (statFeatures.some(isNaN) || scoreLabel == null) {
            console.error('NaN or invalid value detected in features during Training:', game.id);
            process.exit(0);
        }

        xs.push(statFeatures);
        ysWins.push([winLabel]);
        ysScore.push(scoreLabel);

        if (
            statFeatures.length / 2 === statMap.length &&
            isValidStatBlock(homeStats) &&
            isValidStatBlock(awayStats)
        ) {
            teamStatsHistory.push(homeStats);
            if (teamStatsHistory.length > hyperParams.historyLength) {
                teamStatsHistory.shift();
            }

            teamStatsHistory.push(awayStats);
            if (teamStatsHistory.length > hyperParams.historyLength) {
                teamStatsHistory.shift();
            }
        }

        gameCount++;
    }

    checkFeatureLeakage(xs, ysScore, ysWins);

    // --- Tensor Conversion ---
    const xsTensor = tf.tensor2d(xs);
    const ysScoresTensor = tf.tensor2d(ysScore, [ysScore.length, 2]);
    const ysWinLabelsTensor = tf.tensor2d(ysWins, [ysWins.length, 1]);

    // --- Model Setup ---
    const model = await loadOrCreateModel(xs, sport, search);

    model.compile({
        optimizer: tf.train.adam(hyperParams.learningRate),
        loss: {
            scoreOutput: 'meanSquaredError',
            winProbOutput: 'binaryCrossentropy',
        },
        lossWeights: {
            scoreOutput: 1.0,
            winProbOutput: 1.0,
        },
        metrics: {
            scoreOutput: ['mae'],
            winProbOutput: ['accuracy'],
        }
    });

    // --- Model Training ---
    await model.fit(xsTensor, {
        scoreOutput: ysScoresTensor,
        winProbOutput: ysWinLabelsTensor,
    }, {
        epochs: hyperParams.epochs,
        batchSize: hyperParams.epochs,
        validationSplit: 0.4,
        verbose: false,
        callbacks: [
            tf.callbacks.earlyStopping({
                monitor: 'val_loss',
                patience: hyperParams.epochs * .10,
                restoreBestWeight: true
            })
        ]
    });

    // --- Clean up ---
    xsTensor.dispose();
    ysScoresTensor.dispose();
    ysWinLabelsTensor.dispose();

    // --- Model Saving ---
    if (!search) {
        const modelDir = `./model_checkpoint/${sport.name}_model`;
        if (!fs.existsSync(modelDir)) {
            console.log('Creating model directory...');
            fs.mkdirSync(modelDir, { recursive: true });
        }
        await model.save(`file://${modelDir}`);
    }

    return { model, updatedGameCount: gameCount, teamStatsHistory };
};

const predictions = async (sportOdds, ff, model, sport, past, search, pastGames) => {
    console.info(`STARTING PREDICTIONS FOR ${sport.name} @ ${moment().format('HH:mm:ss')}`);

    if (past) {
        sportOdds = sportOdds.filter(game =>
            game.predictedWinner === 'home' || game.predictedWinner === 'away'
        );
    }

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

    const teamStatsHistory = [];

    // Populate stat history from past games
    for (const pastGame of pastGames) {
        teamStatsHistory.push(pastGame['homeStats.data']);
        teamStatsHistory.push(pastGame['awayStats.data']);
    }

    for (const game of sportOdds) {

        const homeRawStats = game['homeStats.data'];
        const awayRawStats = game['awayStats.data'];

        const normalizedHome = getZScoreNormalizedStats(homeRawStats, teamStatsHistory, true, search, sport, false);
        const normalizedAway = getZScoreNormalizedStats(awayRawStats, teamStatsHistory, true, search, sport, false);

        if (!normalizedHome || !normalizedAway) {
            console.log(game.id);
            return;
        }

        const statFeatures = await extractSportFeatures(normalizedHome, normalizedAway, sport.name)

        if (statFeatures.some(isNaN)) {
            console.error('NaN detected in features Predictions:', game.id);
            return;
        }

        const [predScore, predWinProb] = await repeatPredictions(model, tf.tensor2d([statFeatures]), 100);
        let [homeScore, awayScore] = predScore;

        let predictedWinner = homeScore > awayScore ? 'home' : 'away';
        let predictionConfidence = predWinProb > 0.5 ? predWinProb[0] : 1 - predWinProb[0];

        // Avoid ties
        if (Math.round(homeScore) === Math.round(awayScore)) {
            predictedWinner === 'home' ? homeScore++ : awayScore++;
        }

        const updatePayload = {
            predictedWinner,
            predictionConfidence,
            predictedHomeScore: Math.round(homeScore),
            predictedAwayScore: Math.round(awayScore),
        };

        // Track changes and distributions
        if (game.predictedWinner !== predictedWinner) {
            predictionsChanged++;

            if (!past && !search) {
                const oldWinner = game.predictedWinner === 'home'
                    ? game['homeTeamDetails.espnDisplayName']
                    : game['awayTeamDetails.espnDisplayName'];
                const newWinner = predictedWinner === 'home'
                    ? game['homeTeamDetails.espnDisplayName']
                    : game['awayTeamDetails.espnDisplayName'];

                console.log(`Prediction changed for game ${game.id}: ${oldWinner} → ${newWinner} (Confidence: ${predictionConfidence}) Score ([home, away]) [${Math.round(homeScore)}, ${Math.round(awayScore)}]`);
            }
        }

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

            if (Math.round(homeScore) === game.homeScore &&
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
            await db.Games.update(updatePayload, { where: { id: game.id } });
        }
    }

    // Summary output
    if (past || search) {
        console.log(`OUT OF ${sportOdds.length} GAMES [TOTAL WINS: ${totalWins}, TOTAL LOSSES: ${totalLosses}]: MATCHED SPREADS: ${spreadMatch} MATCHED SCORES: ${matchedScore} MISMATCHED PREDICTIONS: ${misMatched} PREDICTIONS CHANGED: ${predictionsChanged} | NEW WINNER PREDICTIONS: ${newWinnerPredictions} | NEW LOSER PREDICTIONS: ${newLoserPredictions} | NEW CONFIDENCE PREDICTIONS: ${newConfidencePredictions}`);
    }

    console.log(
        `50/50 MATCHUPS: ${fiftyfiftyMatchups} (${((fiftyfiftyMatchups / sportOdds.length) * 100).toFixed(1)}%) | ` +
        `60-70% MATCHUPS: ${sixtyToSeventyMatchups} (${((sixtyToSeventyMatchups / sportOdds.length) * 100).toFixed(1)}%) | ` +
        `70-80% MATCHUPS: ${seventyToEightyMatchups} (${((seventyToEightyMatchups / sportOdds.length) * 100).toFixed(1)}%) | ` +
        `80-90% MATCHUPS: ${eightyToNinetyMatchups} (${((eightyToNinetyMatchups / sportOdds.length) * 100).toFixed(1)}%) | ` +
        `HIGH CONFIDENCE GAMES: ${highConfGames} (${((highConfGames / sportOdds.length) * 100).toFixed(1)}%) | ` +
        `HIGH CONFIDENCE LOSERS: ${highConfLosers}`
    );

    if (search) {
        return totalWins / sportOdds.length;
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
            const homeStats = getZScoreNormalizedStats(game['homeStats.data'], teamStatsHistory, true, search, sport);
            const awayStats = getZScoreNormalizedStats(game['awayStats.data'], teamStatsHistory, true, search, sport);

            if (!homeStats || !awayStats) {
                console.log(game.id);
                return;
            }

            const statFeatures = await extractSportFeatures(homeStats, awayStats, sport.name)

            const homeScoreLabel = [game.homeScore, game.awayScore];
            const homeWinLabel = game.winner === 'home' ? 1 : 0;

            if (statFeatures.some(isNaN) || homeWinLabel == null) {
                console.error('NaN detected in features during kFoldTest:', game.id);
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
    const { avgSpreadMAE, avgTotalMAE, avgMAE } = printOverallMetrics(foldResults);

    if (search) {
        // After k-folds
        const fullTrainingData = sortedGameData;
        const { model: finalModel90 } = await mlModelTraining(
            fullTrainingData, [], [], [], sport, search, gameCount, sortedGameData
        );

        const testSlice = gameData
            .sort((a, b) => new Date(a.commence_time) - new Date(b.commence_time))
            .slice(gameData.length - Math.floor(gameData.length * 0.10));

        const historySlice = gameData
            .sort((a, b) => new Date(b.commence_time) - new Date(a.commence_time))
            .slice(0, sport.hyperParameters.historyLength);

        const testWinRate = await predictions(testSlice, [], finalModel90, sport, false, search, historySlice);
        console.log(`--- Overall WINRATE ON UNSEEN DATA: ${(testWinRate * 100).toFixed(2)} ---`);

        const compositeScore =
            ((testWinRate * 100) * 1) -
            (avgMAE * .3) -
            (avgSpreadMAE * .15) -
            (avgTotalMAE * .1)


        console.log(`--- FINAL HYPERPARAM SCORE: ${(compositeScore).toFixed(2)} ---`);
        return compositeScore;
    }

    const fullTrainingData = sortedGameData; // All but final 10%
    const xs = [], ysWins = [], ysScore = [];

    const { model: retrainedModel } = await mlModelTraining(
        fullTrainingData, xs, ysWins, ysScore, sport, search, gameCount, sortedGameData
    );

    finalModel = retrainedModel;

    // Extract feature importances
    await extractAndSaveFeatureImportances(finalModel, sport);

    if (global.gc) global.gc();
    console.log(`ml model done for ${sport.name} @ ${moment().format('HH:mm:ss')}`);
    return finalModel;
};

module.exports = { normalizeStat, extractSportFeatures, mlModelTraining, predictions, trainSportModelKFold, loadOrCreateModel }