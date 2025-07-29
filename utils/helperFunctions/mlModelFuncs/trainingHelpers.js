const db = require('../../../models_sql');
const statsMinMax = require('../../seeds/sampledGlobalStats.json')
const fs = require('fs')
const path = require('path');
const tf = require('@tensorflow/tfjs-node');
const moment = require('moment')
const cliProgress = require('cli-progress');
const { baseballStatMap, basketballStatMap, footballStatMap, hockeyStatMap, statConfigMap } = require('../../statMaps')


function evaluateFoldMetrics(testXs, testYsScore, testYsWins, scorePreds, winProbPreds) {
    const testXsTensor = tf.tensor2d(testXs);
    const testYsScoreTensor = tf.tensor2d(testYsScore, [testYsScore.length, 2]);
    const testYsWinsTensor = tf.tensor2d(testYsWins, [testYsWins.length, 1]);
    const scorePredsTensor = tf.tensor2d(scorePreds, [scorePreds.length, 2]);
    const winPredsTensor = tf.tensor2d(winProbPreds, [winProbPreds.length, 1]);

    const metrics = evaluateMetrics(testYsWinsTensor, winPredsTensor);
    const regressionMetrics = evaluateRegressionMetrics(testYsScoreTensor, scorePredsTensor);

    testXsTensor.dispose();
    testYsScoreTensor.dispose();
    testYsWinsTensor.dispose();
    scorePredsTensor.dispose();
    winPredsTensor.dispose();

    return {
        mse: regressionMetrics.mse,
        rmse: regressionMetrics.rmse,
        mae: regressionMetrics.mae,
        ...metrics,
    };
}

function printOverallMetrics(foldResults) {
    const avgF1 = avg(foldResults.map(f => f.f1Score));
    const avgMAE = avg(foldResults.map(f => f.mae));

    const totalCounts = ['truePositives', 'falsePositives', 'trueNegatives', 'falseNegatives'].reduce((acc, key) => {
        acc[key] = foldResults.reduce((sum, f) => sum + f[key], 0);
        return acc;
    }, {});

    const total = Object.values(totalCounts).reduce((sum, val) => sum + val, 0);

    console.log(`--- Overall Performance Avg F1-Score: ${avgF1.toFixed(4)} ---`);
    // for (const [label, count] of Object.entries(totalCounts)) {
    //     console.log(`${label}: ${count} (${((count / total) * 100).toFixed(2)}%)`);
    // }
    console.log(`--- Overall Performance Avg MAE: ${avgMAE.toFixed(4)} ---`);
}

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

function avg(arr) {
    return arr.reduce((sum, val) => sum + val, 0) / arr.length;
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

const getStat = (stats, statName, fallbackValue = 0) => {
    return stats && stats[statName] !== undefined ? stats[statName] : fallbackValue;
};
// Helper function to calculate Win-Loss difference
const getWinLoss = (stats) => {
    if (stats && stats.seasonWinLoss) {
        const winLoss = stats.seasonWinLoss.split("-");
        if (winLoss.length === 2) {
            return parseInt(winLoss[0], 10) - parseInt(winLoss[1], 10); // Difference in wins and losses
        }
    }
    return 0;
};
// Helper function to extract home/away win-loss
const getHomeAwayWinLoss = (stats, type) => {
    if (stats && stats[type]) {
        const winLoss = stats[type].split("-");
        if (winLoss.length === 2) {
            return parseInt(winLoss[0], 10) - parseInt(winLoss[1], 10); // Difference in home/away win-loss
        }
    }
    return 0;
};
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
            ? sport.hyperParameters.l2Reg
            : sport['hyperParams.l2reg'],
        dropoutReg: search
            ? sport.hyperParameters.dropoutReg
            : sport['hyperParams.dropoutReg'],
        hiddenLayerNum: search
            ? sport.hyperParameters.hiddenLayerNum
            : sport['hyperParams.hiddenLayers'],
        layerNeurons: search
            ? sport.hyperParameters.layerNeurons
            : sport['hyperParams.layerNeurons'],
        kFolds: sport['hyperParams.kFolds'], // always comes from the saved hyperParams
        kernalInitializer: sport['hyperParams.kernalInitializer'] || 'glorotUniform',
        decayFactor: sport['hyperParams.decayFactor'] || 1,
        gameDecayThreshold: sport['hyperParams.gameDecayThreshold'] || 10,
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
    // Function to calculate decay weight based on number of games processed
    let statMap
    switch (sport.name) {
        case 'baseball_mlb':
            statMap = baseballStatMap
            break
        case 'icehockey_nhl':
            statMap = hockeyStatMap
            break
        case 'americanfootball_nfl':
        case 'americanfootball_ncaaf':
            statMap = footballStatMap
            break
        case 'basketball_nba':
        case 'basketball_ncaab':
        case 'basketball_wncaab':
            statMap = basketballStatMap
            break
    }
    let teamStatsHistory = [];
    gameData.forEach(game => {
        const homeRawStats = game['homeStats.data'];
        const awayRawStats = game['awayStats.data'];
        let normalizedHome
        let normalizedAway

        normalizedHome = getZScoreNormalizedStats(homeRawStats, teamStatsHistory, false, search, sport);
        normalizedAway = getZScoreNormalizedStats(awayRawStats, teamStatsHistory, false, search, sport);

        if (!normalizedHome || !normalizedAway) {
            console.log(game.id)
            return;
        }

        const statFeatures = extractSportFeatures(normalizedHome, normalizedAway, sport.name);
        const winLabel = game.winner === 'home' ? 1 : 0;
        const homeLabel = [game.homeScore, game.awayScore]
        if (statFeatures.some(isNaN) || homeLabel === null) {
            console.error('NaN or invalid value detected in features during Training:', game.id);
            process.exit(0);
        } else {
            xs.push(statFeatures);
            ysWins.push([winLabel]);
            ysScore.push(homeLabel)
        }

        if (statFeatures.length / 2 === statMap.length && isValidStatBlock(homeRawStats) && isValidStatBlock(awayRawStats)) {
            // Update history AFTER using current stats


            teamStatsHistory.push(homeRawStats);
            if (teamStatsHistory.length > (search ? sport.hyperParameters.historyLength : sport['hyperParams.historyLength'])) {
                teamStatsHistory.shift(); // remove oldest game
            }
            teamStatsHistory.push(awayRawStats);
            if (teamStatsHistory.length > (search ? sport.hyperParameters.historyLength : sport['hyperParams.historyLength'])) {
                teamStatsHistory.shift(); // remove oldest game
            }
        }
        gameCount++
    });


    checkFeatureLeakage(xs, ysScore, ysWins)

    // Convert arrays to tensors
    const xsTensor = tf.tensor2d(xs);
    const ysScoresTensor = tf.tensor2d(ysScore, [ysScore.length, 2])
    const ysWinLabelsTensor = tf.tensor2d(ysWins, [ysWins.length, 1])

    // Define the path to the model directory
    const modelDir = `./model_checkpoint/${sport.name}_model`;
    // Define the model
    const model = await loadOrCreateModel(xs, sport, search)
    model.compile({
        optimizer: tf.train.adam(search ? sport.hyperParameters.learningRate : sport['hyperParams.learningRate']),
        loss: {
            scoreOutput: 'meanSquaredError',
            winProbOutput: 'binaryCrossentropy'
        },
        lossWeights: {
            scoreOutput: 1.0,
            winProbOutput: 1.0
        },
        metrics: {
            scoreOutput: ['mae'],
            winProbOutput: ['accuracy']  // or optionally AUC
        }
    });
    await model.fit(xsTensor, {
        scoreOutput: ysScoresTensor,
        winProbOutput: ysWinLabelsTensor
    }, {
        epochs: search ? sport.hyperParameters.epochs : sport['hyperParams.epochs'],
        batchSize: search ? sport.hyperParameters.batchSize : sport['hyperParams.batchSize'],
        validationSplit: 0.4,
        verbose: false,
        callbacks: [tf.callbacks.earlyStopping({
            monitor: 'val_loss',
            patience: sport['hyperParams.epochs'] ? sport['hyperParams.epochs'] * .20 : 5,
            restoreBestWeight: true
        })]
    });

    xsTensor.dispose();
    ysWinLabelsTensor.dispose();
    ysScoresTensor.dispose()

    // Save model specific to the sport
    if (!search) {

        if (!fs.existsSync(modelDir)) {
            console.log('Creating model directory...');
            // Create the directory (including any necessary parent directories)
            fs.mkdirSync(modelDir, { recursive: true });
        }
        await model.save(`file://./model_checkpoint/${sport.name}_model`);
    }

    xs = null
    ys = null

    return { model, updatedGameCount: gameCount, teamStatsHistory }
    // Log loss and accuracy

}

const predictions = async (sportOdds, ff, model, sport, past, search, pastGames) => {
    console.info(`STARTING PREDICTIONS FOR ${sport.name} @ ${moment().format('HH:mm:ss')}`);
    if (past) {
        sportOdds = sportOdds.filter(game => game.predictedWinner === 'home' || game.predictedWinner === 'away');
    }
    let predictionsChanged = 0
    let newWinnerPredictions = 0
    let newLoserPredictions = 0
    let totalWins = 0
    let totalLosses = 0
    let newConfidencePredictions = 0
    let highConfGames = 0
    let highConfLosers = 0
    let fiftyfiftyMatchups = 0
    let sixtyToSeventyMatchups = 0;
    let seventyToEightyMatchups = 0;
    let eightyToNinetyMatchups = 0;
    let misMatched = 0
    let matchedScore = 0
    let spreadMatch = 0
    let totalMatch = 0
    const teamStatsHistory = []; // teamID => [pastStatsObjects]
    let statMap
    switch (sport.name) {
        case 'baseball_mlb':
            statMap = baseballStatMap
            break
        case 'icehockey_nhl':
            statMap = hockeyStatMap
            break
        case 'americanfootball_nfl':
        case 'americanfootball_ncaaf':
            statMap = footballStatMap
            break
        case 'basketball_nba':
        case 'basketball_ncaab':
        case 'basketball_wncaab':
            statMap = basketballStatMap
            break
    }
    for (const pastGame of pastGames) {
        const homeRawStats = pastGame['homeStats.data'];
        const awayRawStats = pastGame['awayStats.data'];
        teamStatsHistory.push(homeRawStats);
        teamStatsHistory.push(awayRawStats);
    }
    for (const game of sportOdds) {
        // if (Date.parse(game.commence_time) <= Date.now() && !past) continue; // Skip upcoming games if already started
        const homeTeamId = game.homeTeamId;
        const awayTeamId = game.awayTeamId;

        const homeRawStats = game['homeStats.data'];
        const awayRawStats = game['awayStats.data'];

        const normalizedHome = getZScoreNormalizedStats(homeRawStats, teamStatsHistory, true, search, sport, false);
        const normalizedAway = getZScoreNormalizedStats(awayRawStats, teamStatsHistory, true, search, sport, false);

        if (!normalizedHome || !normalizedAway) {
            console.log(game.id)
            return;
        }

        const statFeatures = extractSportFeatures(normalizedHome, normalizedAway, sport.name, 0);

        if (statFeatures.some(isNaN)) {
            console.error('NaN detected in features Predictions:', game.id);
            return;
        }



        const [predScore, predWinProb] = await repeatPredictions(model, tf.tensor2d([statFeatures]), 10);

        let homeScore = predScore[0]
        let awayScore = predScore[1]

        const predictedWinner = predScore[0] > predScore[1] ? 'home' : 'away';
        const predictionConfidence = predWinProb > .50 ? predWinProb[0] : 1 - predWinProb[0];
        if (Math.round(homeScore) === Math.round(awayScore)) {
            predictedWinner === 'home' ? homeScore = homeScore + 1 : awayScore = awayScore + 1
        }
        // Track the game so we can compare two predictions later
        const updatePayload = {
            predictedWinner,
            predictionConfidence,
            predictedHomeScore: Math.round(homeScore),
            predictedAwayScore: Math.round(awayScore),
        };

        if (game.predictedWinner !== predictedWinner) {
            predictionsChanged++
            let oldWinner = game.predictedWinner === 'home' ? game['homeTeamDetails.espnDisplayName'] : game['awayTeamDetails.espnDisplayName'];
            let newWinner = predictedWinner === 'home' ? game['homeTeamDetails.espnDisplayName'] : game['awayTeamDetails.espnDisplayName'];
            if (!past) console.log(`Prediction changed for game ${game.id}: ${oldWinner} → ${newWinner} (Confidence: ${predictionConfidence}) Score ([home, away]) [${Math.round(homeScore)}, ${Math.round(awayScore)}]`);
        }
        if (game.predictionConfidence !== predictionConfidence) {
            newConfidencePredictions++
        }
        if (predictionConfidence > .90) {
            highConfGames++;
        }
        if (predictionConfidence < .60) {
            fiftyfiftyMatchups++;
        }
        if (predictionConfidence >= .60 && predictionConfidence < .70) {
            sixtyToSeventyMatchups++;
        }
        if (predictionConfidence >= .70 && predictionConfidence < .80) {
            seventyToEightyMatchups++;
        }
        if (predictionConfidence >= .80 && predictionConfidence < .90) {
            eightyToNinetyMatchups++;
        }

        if (past) {
            updatePayload.predictionCorrect = predictedWinner === game.winner;
            if ((predictedWinner === game.predictedWinner && predictedWinner === game.winner) || (predictedWinner !== game.predictedWinner && predictedWinner === game.winner)) {
                totalWins++;
            }
            if ((predictedWinner === game.predictedWinner && predictedWinner !== game.winner) || (predictedWinner !== game.predictedWinner && predictedWinner !== game.winner)) {
                totalLosses++;
            }
            if (predictedWinner !== game.predictedWinner && predictedWinner === game.winner) {
                newWinnerPredictions++;
            }
            if (predictedWinner !== game.predictedWinner && predictedWinner !== game.winner) {
                newLoserPredictions++;
            }

            if (predictionConfidence > .90 && predictedWinner !== game.winner) {
                highConfLosers++
            }

            if ((homeScore > awayScore && predWinProb < .50) || (homeScore < awayScore && predWinProb > .50)) {
                misMatched++
            }

            if (Math.round(homeScore) === game.homeScore && Math.round(awayScore) === game.awayScore) {
                matchedScore++
            }
            if (Math.abs(homeScore - awayScore) === Math.abs(game.homeScore - game.awayScore)) {
                spreadMatch++
            }
            if ((homeScore + awayScore) === (game.homeScore + game.awayScore)) {
                totalMatch++
            }

        }

        if (!past) await db.Games.update(updatePayload, { where: { id: game.id } });



    }
    console.log(`OUT OF ${sportOdds.length} GAMES [TOTAL WINS: ${totalWins}, TOTAL LOSSES: ${totalLosses}]: MATCHED SPREADS: ${spreadMatch} MATCHED SCORES: ${matchedScore} MISMATCHED PREDICTIONS: ${misMatched} PREDICTIONS CHANGED: ${predictionsChanged} | NEW WINNER PREDICTIONS: ${newWinnerPredictions} | NEW LOSER PREDICTIONS: ${newLoserPredictions} | NEW CONFIDENCE PREDICTIONS: ${newConfidencePredictions}`);
    console.log(`50/50 MATCHUPS: ${fiftyfiftyMatchups} (${((fiftyfiftyMatchups / sportOdds.length) * 100).toFixed(1)}%) | 60-70% MATCHUPS: ${sixtyToSeventyMatchups} (${((sixtyToSeventyMatchups / sportOdds.length) * 100).toFixed(1)}%) | 70-80% MATCHUPS: ${seventyToEightyMatchups} (${((seventyToEightyMatchups / sportOdds.length) * 100).toFixed(1)}%) | 80-90% MATCHUPS: ${eightyToNinetyMatchups} (${((eightyToNinetyMatchups / sportOdds.length) * 100).toFixed(1)}%) | HIGH CONFIDENCE GAMES: ${highConfGames} (${((highConfGames / sportOdds.length) * 100).toFixed(1)}%) | HIGH CONFIDENCE LOSERS: ${highConfLosers}`)
    // console.info(`FINISHED PREDICTIONS FOR ${sport.name} @ ${moment().format('HH:mm:ss')}`);
    if (search) return totalWins / sportOdds.length
};

const evaluateMetrics = (ysTensor, yPredTensor) => {

    const yPredBool = yPredTensor.greaterEqual(0.5);  // Threshold predictions
    const ysTensorBool = ysTensor.cast('bool');       // Use ground-truth labels as-is

    // Convert tensors to arrays for easier manipulation
    const truePositives = tf.sum(tf.logicalAnd(ysTensorBool, yPredBool)).arraySync();
    const falsePositives = tf.sum(tf.logicalAnd(tf.logicalNot(ysTensorBool), yPredBool)).arraySync();
    const falseNegatives = tf.sum(tf.logicalAnd(ysTensorBool, tf.logicalNot(yPredBool))).arraySync();
    const trueNegatives = tf.sum(tf.logicalAnd(tf.logicalNot(ysTensorBool), tf.logicalNot(yPredBool))).arraySync();

    // console.log('truePositives', truePositives)
    // console.log('falsePositives', falsePositives)
    // console.log('falseNegatives', falseNegatives)
    // console.log('trueNegatives', trueNegatives)

    // Calculate precision, recall, and F1-score
    const precision = (truePositives + falsePositives > 0) ? truePositives / (truePositives + falsePositives) : 0;
    const recall = (truePositives + falseNegatives > 0) ? truePositives / (truePositives + falseNegatives) : 0;
    const f1Score = (precision + recall > 0) ? 2 * (precision * recall) / (precision + recall) : 0;


    return {
        precision: precision,
        recall: recall,
        f1Score: f1Score,
        truePositives: truePositives,
        falsePositives: falsePositives,
        trueNegatives: trueNegatives,
        falseNegatives: falseNegatives
    };
}

function calculateFeatureImportance(inputToHiddenWeights, hiddenToOutputWeights) {
    const featureImportanceScores = [];

    const numInputFeatures = inputToHiddenWeights.length;        // 106
    const numHiddenNeurons = inputToHiddenWeights[0].length;     // 128

    for (let i = 0; i < numInputFeatures; i++) {
        let importance = 0;

        for (let j = 0; j < numHiddenNeurons; j++) {
            const inputToHiddenWeight = Math.abs(inputToHiddenWeights[i][j]);   // input feature i → hidden neuron j
            const hiddenToOutputWeight = Math.abs(hiddenToOutputWeights[j][0]); // hidden neuron j → output
            importance += inputToHiddenWeight * hiddenToOutputWeight;
        }

        featureImportanceScores.push(importance);
    }

    return featureImportanceScores;
}

function evaluateRegressionMetrics(yTrueTensor, yPredTensor) {
    const diff = tf.sub(yTrueTensor, yPredTensor);
    const squared = tf.square(diff);
    const abs = tf.abs(diff);

    const mse = tf.mean(squared).arraySync();
    const mae = tf.mean(abs).arraySync();

    return {
        mse,
        rmse: Math.sqrt(mse),
        mae
    };
}

const trainSportModelKFold = async (sport, gameData, search) => {

    // Sort historical game data and slice off the most recent 10% for testing
    const sortedGameData = gameData
        .sort((a, b) => new Date(a.commence_time) - new Date(b.commence_time))
        .slice(0, gameData.length - Math.floor(gameData.length * 0.10));

    console.log(`${sortedGameData[0].commence_time.toLocaleString()} - ${sortedGameData[sortedGameData.length - 1].commence_time.toLocaleString()}`);

    const numFolds = search ? sport.hyperParameters.kFolds : sport['hyperParams.kFolds'];
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



        for (const game of testData) {
            const homeStats = getZScoreNormalizedStats(game['homeStats.data'], teamStatsHistory, true, search, sport);
            const awayStats = getZScoreNormalizedStats(game['awayStats.data'], teamStatsHistory, true, search, sport);

            if (!homeStats || !awayStats) {
                console.log(game.id);
                return;
            }

            const gameIndexFromEnd = sortedGameData.length - 1 - gameCount;
            const statFeatures = extractSportFeatures(homeStats, awayStats, sport.name, gameIndexFromEnd);

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

        foldResults.push({ foldIndex, ...foldMetrics });

        progress += 1;
        bar.update(progress);
    }

    bar.stop();

    // Aggregate results
    printOverallMetrics(foldResults);

    if (search) {
        const testSlice = gameData
            .sort((a, b) => new Date(a.commence_time) - new Date(b.commence_time))
            .slice(gameData.length - Math.floor(gameData.length * 0.10) - 1, gameData.length - 1);

        const historySlice = gameData
            .sort((a, b) => new Date(b.commence_time) - new Date(a.commence_time))
            .slice(0, search ? sport.hyperParameters.historyLength : sport['hyperParams.historyLength']);

        const testWinRate = await predictions(testSlice, [], finalModel, sport, false, search, historySlice);

        console.log(`TEST WIN RATE ${(testWinRate * 100).toFixed(2)}`);
        return testWinRate;
    }

    // Extract feature importances
    await extractAndSaveFeatureImportances(finalModel, sport);

    if (global.gc) global.gc();
    console.log(`ml model done for ${sport.name} @ ${moment().format('HH:mm:ss')}`);
    return finalModel;
};

module.exports = { getStat, getWinLoss, getHomeAwayWinLoss, normalizeStat, extractSportFeatures, mlModelTraining, predictions, trainSportModelKFold, loadOrCreateModel, evaluateMetrics }