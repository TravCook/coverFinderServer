const db = require('../../../models_sql');
const statsMinMax = require('../../seeds/sampledGlobalStats.json')
const fs = require('fs')
const tf = require('@tensorflow/tfjs-node');
const moment = require('moment')
const cliProgress = require('cli-progress');
const { baseballStatMap, basketballStatMap, footballStatMap, hockeyStatMap } = require('../../statMaps')

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
            ? sport.hyperParameters.l2reg
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

const getZScoreNormalizedStats = (teamId, currentStats, teamStatsHistory, prediction, search, sport) => {
    const history = teamStatsHistory[teamId] || [];

    // Not enough data — return raw stats
    if (history.length < 5) {
        return { ...currentStats };
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
    const teamStatsHistory = {}; // teamID => [pastStatsObjects]
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
    gameData.forEach(game => {
        const homeTeamId = game.homeTeamId;
        const awayTeamId = game.awayTeamId;
        const homeRawStats = game['homeStats.data'];
        const awayRawStats = game['awayStats.data'];
        const normalizedHome = getZScoreNormalizedStats(homeTeamId, homeRawStats, teamStatsHistory, false, search, sport);
        const normalizedAway = getZScoreNormalizedStats(awayTeamId, awayRawStats, teamStatsHistory, false, search, sport);
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
            if (!teamStatsHistory[homeTeamId]) teamStatsHistory[homeTeamId] = [];
            if (!teamStatsHistory[awayTeamId]) teamStatsHistory[awayTeamId] = [];

            teamStatsHistory[homeTeamId].push(homeRawStats);
            if (teamStatsHistory[homeTeamId].length > (search ? sport.hyperParameters.historyLength : 50)) {
                teamStatsHistory[homeTeamId].shift(); // remove oldest game
            }
            teamStatsHistory[awayTeamId].push(awayRawStats);
            if (teamStatsHistory[awayTeamId].length > (search ? sport.hyperParameters.historyLength : 50)) {
                teamStatsHistory[awayTeamId].shift(); // remove oldest game
            }
        }
        gameCount++
    });


    checkFeatureLeakage(xs, ysScore, ysWins)
    // Check if xs contains NaN values
    // if (xs.some(row => row.some(isNaN))) {
    //     console.error('NaN detected in xs:', xs);
    //     // Handle NaN values (skip, replace, or log)
    // }

    // // Check if ys contains NaN values
    // if (ys.some(isNaN)) {
    //     console.error('NaN detected in ys:', ys);
    //     // Handle NaN values
    // }

    // Convert arrays to tensors
    const xsTensor = tf.tensor2d(xs);
    const ysScoresTensor = tf.tensor2d(ysScore, [ysScore.length, 2])
    const ysWinLabelsTensor = tf.tensor2d(ysWins, [ysWins.length, 1])

    // Define the path to the model directory
    const modelDir = `./model_checkpoint/${sport.name}_model`;
    // Define the model
    const model = await loadOrCreateModel(xs, sport, search)
    model.compile({
        optimizer: tf.train.adam(),
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

    return { model, updatedGameCount: gameCount }
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
    const teamStatsHistory = {}; // teamID => [pastStatsObjects]
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
    for (const game of sportOdds) {
        if (Date.parse(game.commence_time) <= Date.now() && !past) continue; // Skip upcoming games if already started
        const homeTeamId = game.homeTeamId;
        const awayTeamId = game.awayTeamId;

        const homeRawStats = game['homeStats.data'];
        const awayRawStats = game['awayStats.data'];


        const normalizedHome = getZScoreNormalizedStats(homeTeamId, homeRawStats, teamStatsHistory, true, search, sport);
        const normalizedAway = getZScoreNormalizedStats(awayTeamId, awayRawStats, teamStatsHistory, true, search, sport);

        if (!normalizedHome || !normalizedAway) {
            console.log(game.id)
            return;
        }

        const statFeatures = extractSportFeatures(normalizedHome, normalizedAway, sport.name, 0);

        if (isValidStatBlock(homeRawStats) && isValidStatBlock(awayRawStats)) {
            // Update history AFTER using current stats
            if (!teamStatsHistory[homeTeamId]) teamStatsHistory[homeTeamId] = [];
            if (!teamStatsHistory[awayTeamId]) teamStatsHistory[awayTeamId] = [];

            teamStatsHistory[homeTeamId].push(homeRawStats);
            if (teamStatsHistory[homeTeamId].length > (50)) {
                teamStatsHistory[homeTeamId].shift(); // remove oldest game
            }
            teamStatsHistory[awayTeamId].push(awayRawStats);
            if (teamStatsHistory[awayTeamId].length > (50)) {
                teamStatsHistory[awayTeamId].shift(); // remove oldest game
            }
        }

        if (statFeatures.some(isNaN)) {
            console.error('NaN detected in features Predictions:', game.id);
            return;
        }



        const [predScore, predWinProb] = await repeatPredictions(model, tf.tensor2d([statFeatures]), 100);
        // console.log(predScore)
        // console.log(predWinProb)
        let homeScore = predScore[0]
        let awayScore = predScore[1]

        const predictedWinner = predScore[0] > predScore[1] ? 'home' : 'away';
        const predictionConfidence = predWinProb;

        // Track the game so we can compare two predictions later
        const updatePayload = {
            predictedHomeScore: homeScore,
            predictedAwayScore: awayScore,
            predictedWinner,
            predictionConfidence,
            predictionCorrect: predictedWinner === game.winner,
            predictedHomeScore: Math.round(homeScore),
            predictedAwayScore: Math.round(awayScore),
        };
        let oldWinner = game.predictedWinner === 'home' ? game['homeTeamDetails.espnDisplayName'] : game['awayTeamDetails.espnDisplayName'];
        let newWinner = predictedWinner === 'home' ? game['homeTeamDetails.espnDisplayName'] : game['awayTeamDetails.espnDisplayName'];
        if (!past) console.log(`Prediction changed for game ${game.id}: ${oldWinner} → ${newWinner} (Confidence: ${predictionConfidence}) Score ([home, away]) [${Math.round(homeScore)}, ${Math.round(awayScore)}]`);
        if (game.predictedWinner !== predictedWinner) {
            predictionsChanged++

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

        }

        // await db.Games.update(updatePayload, { where: { id: game.id } });



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

const trainSportModelKFold = async (sport, gameData, search, upcomingGames) => {
    sportGames = upcomingGames.filter((game) => game.sport_key === sport.name) //USE THIS TO POPULATE UPCOMING GAME ODDS
    let sortedGameData = gameData.sort((a, b) => new Date(a.commence_time) - new Date(b.commence_time)).slice(0, gameData.length - (gameData.length * .10)); // Sort by commence_time
    console.log(`${sortedGameData[0].commence_time.toLocaleString()} - ${sortedGameData[sortedGameData.length - 1].commence_time.toLocaleString()}`)
    const numFolds = search ? sport.hyperParameters.kFolds : sport['hyperParams.kFolds'];  // Number of folds (you can adjust based on your data)
    const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    let gameCount = 0

    const total = numFolds
    let foldResults = [];
    let finalModel
    bar.start(total, 0);
    progress = 0
    // Perform training and testing on each fold
    for (let foldIndex = 1; foldIndex <= numFolds; foldIndex++) {
        const trainEnd = Math.floor((foldIndex / (numFolds + 1)) * sortedGameData.length);
        const trainingData = sortedGameData.slice(0, trainEnd);
        const valStart = trainEnd;
        const valEnd = foldIndex === numFolds
            ? sortedGameData.length
            : Math.floor(((foldIndex + 1) / (numFolds + 1)) * sortedGameData.length);

        const testData = sortedGameData.slice(valStart, valEnd);


        // Train the model with training data
        const { model, updatedGameCount } = await mlModelTraining(trainingData, [], [], [], sport, search, gameCount, sortedGameData);
        gameCount = updatedGameCount
        finalModel = model

        const testXs = [];
        const testYsScore = [];
        const testYsWins = [];

        const teamStatsHistory = {}; // teamID => [pastStatsObjects]
        let scorepredictionsArray = []
        let winProbPredicitonsArray = []
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
        for (const game of testData) {
            const homeTeamId = game.homeTeamId;
            const awayTeamId = game.awayTeamId;

            const homeRawStats = game['homeStats.data'];
            const awayRawStats = game['awayStats.data'];

            const normalizedHome = getZScoreNormalizedStats(homeTeamId, homeRawStats, teamStatsHistory, true, search, sport);
            const normalizedAway = getZScoreNormalizedStats(awayTeamId, awayRawStats, teamStatsHistory, true, search, sport);

            if (!normalizedHome || !normalizedAway) {
                console.log(game.id)
                return;
            }
            const gameIndexFromEnd = sortedGameData.length - 1 - gameCount;
            const statFeatures = extractSportFeatures(normalizedHome, normalizedAway, sport.name, gameIndexFromEnd);
            const homeScoreLabel = [game.homeScore, game.awayScore]
            const homeWinLabel = game.winner === 'home' ? 1 : 0

            if (statFeatures.some(isNaN) || homeWinLabel === null) {
                console.error('NaN detected in features during kFoldTest:', game.id);
                process.exit(0);
            } else {
                testXs.push(statFeatures);
                testYsScore.push(homeScoreLabel);
                testYsWins.push(homeWinLabel)
            }

            if (statFeatures.length / 2 === statMap.length && isValidStatBlock(homeRawStats) && isValidStatBlock(awayRawStats)) {
                // Update history AFTER using current stats
                if (!teamStatsHistory[homeTeamId]) teamStatsHistory[homeTeamId] = [];
                if (!teamStatsHistory[awayTeamId]) teamStatsHistory[awayTeamId] = [];

                teamStatsHistory[homeTeamId].push(homeRawStats);
                if (teamStatsHistory[homeTeamId].length > (search ? sport.hyperParameters.historyLength : 50)) {
                    teamStatsHistory[homeTeamId].shift(); // remove oldest game
                }
                teamStatsHistory[awayTeamId].push(awayRawStats);
                if (teamStatsHistory[awayTeamId].length > (search ? sport.hyperParameters.historyLength : 50)) {
                    teamStatsHistory[awayTeamId].shift(); // remove oldest game
                }
            }
            let [averagedScore, averagedWinProb] = await repeatPredictions(model, tf.tensor2d([statFeatures]), 10);
            scorepredictionsArray.push(averagedScore)
            winProbPredicitonsArray.push(averagedWinProb)
            gameCount++
        };
        // Create tensors
        const testXsTensor = tf.tensor2d(testXs);
        const testYsScoreTensor = tf.tensor2d(testYsScore, [testYsScore.length, 2]);
        const testYsWinsTensor = tf.tensor2d(testYsWins, [testYsWins.length, 1]);
        const scorePredictionsTensor = tf.tensor2d(scorepredictionsArray, [scorepredictionsArray.length, 2]);
        const winProbPredictionTensor = tf.tensor2d(winProbPredicitonsArray, [winProbPredicitonsArray.length, 1])


        // const confidences = predictionsArray.map(p => Math.abs(p - 0.5) * 2);  // Converts 0.5→0, 1.0/0.0→1.0
        // console.log("High-confidence predictions:", confidences.filter(c => c > 0.9).length);
        const metrics = evaluateMetrics(testYsWinsTensor, winProbPredictionTensor);

        const regressionMetrics = evaluateRegressionMetrics(testYsScoreTensor, scorePredictionsTensor);

        foldResults.push({
            foldIndex,
            mse: regressionMetrics.mse,
            rmse: regressionMetrics.rmse,
            mae: regressionMetrics.mae,
            precision: metrics.precision,
            recall: metrics.recall,
            f1Score: metrics.f1Score,
            truePositives: metrics.truePositives,
            falsePositives: metrics.falsePositives,
            trueNegatives: metrics.trueNegatives,
            falseNegatives: metrics.falseNegatives
        });

        testXsTensor.dispose();
        testYsScoreTensor.dispose();
        testYsWinsTensor.dispose();
        scorePredictionsTensor.dispose()
        winProbPredictionTensor.dispose()
        progress += 1
        bar.update(progress)
        if (progress >= total) {
            bar.stop();
            // console.log('Done!');
        }
    }
    let testWinRate = await predictions(sportGames, [], finalModel, sport, false, search, gameData.sort((gameA, gameB) => new Date(gameB.commence_time) - new Date(gameA.commence_time)))
    // await predictions(gameData, [], finalModel, sport, true) // Predictions for past games DO NOT RUN THIS AGAIN FOR BASEBALL. MAYBE FOR OTHER SPORTS BUT NOT LIKELY. DO NOT UNCOMMENT UNLESS YOU COMPLETELY CHANGE THE ARCHITECTURE OF THE MODEL OR THE DATASET. IT WILL OVERWRITE PAST GAME ODDS AND PREDICTIONS.
    // After all folds, calculate and log the overall performance
    const avgF1Score = foldResults.reduce((sum, fold) => sum + fold.f1Score, 0) / foldResults.length;
    const totalTruePositives = foldResults.reduce((sum, fold) => sum + fold.truePositives, 0)
    const totalFalsePositives = foldResults.reduce((sum, fold) => sum + fold.falsePositives, 0)
    const totalTrueNegatives = foldResults.reduce((sum, fold) => sum + fold.trueNegatives, 0)
    const totalFalseNegatives = foldResults.reduce((sum, fold) => sum + fold.falseNegatives, 0)
    const avgMAE = foldResults.reduce((sum, fold) => sum + fold.mae, 0) / foldResults.length;

    console.log(`--- Overall Performance Avg F1-Score: ${avgF1Score} ---`);
    console.log(`truePositives: ${totalTruePositives} (${(totalTruePositives / (totalTruePositives + totalFalseNegatives + totalFalsePositives + totalTrueNegatives) * 100).toFixed(2)}%)`);
    console.log(`falsePositives: ${totalFalsePositives} (${(totalFalsePositives / (totalTruePositives + totalFalseNegatives + totalFalsePositives + totalTrueNegatives) * 100).toFixed(2)}%)`);
    console.log(`falseNegatives: ${totalFalseNegatives} (${(totalFalseNegatives / (totalTruePositives + totalFalseNegatives + totalFalsePositives + totalTrueNegatives) * 100).toFixed(2)}%)`);
    console.log(`trueNegatives: ${totalTrueNegatives} (${(totalTrueNegatives / (totalTruePositives + totalFalseNegatives + totalFalsePositives + totalTrueNegatives) * 100).toFixed(2)}%)`);
    console.log(`--- Overall Performance Avg MAE: ${avgMAE} ---`);
    console.log(`TEST WIN RATE ${(testWinRate * 100).toFixed(2)}`)

    if (search) {
        return testWinRate
    }

    const inputToHiddenWeights = finalModel.layers[1].getWeights()[0].arraySync(); // Input → First hidden layer
    let currentWeights = inputToHiddenWeights; // Shape: [numInputFeatures, hiddenUnits]

    const hiddenLayerCount = hyperParams.hiddenLayerNum;
    const hiddenUnits = hyperParams.layerNeurons;

    // Propagate through each hidden layer
    for (let i = 0; i < hiddenLayerCount; i++) {
        const layerIndex = 2 + i * (dropoutRate > 0 ? 2 : 1); // Skip dropout layers
        const layerWeights = finalModel.layers[layerIndex].getWeights()[0].arraySync(); // Shape: [hiddenUnits, hiddenUnits]

        // Matrix multiply: feature weights * current layer's weights
        currentWeights = math.multiply(currentWeights, layerWeights);
    }

    // Multiply by weights of winProbOutput layer
    const winProbOutputLayer = finalModel.getLayer('scoreOutput');
    const finalOutputWeights = winProbOutputLayer.getWeights()[0].arraySync(); // Shape: [hiddenUnits, 1]

    const featureToOutputWeights = math.multiply(currentWeights, finalOutputWeights); // Shape: [numFeatures, 1]

    // Calculate absolute importance values (or square for stronger contrast)
    let featureImportanceScores = featureToOutputWeights.map(weightArr => Math.abs(weightArr[0]));

    // Normalize (optional)
    const maxVal = Math.max(...featureImportanceScores);
    featureImportanceScores = featureImportanceScores.map(val => val / maxVal);

    // Map to stat labels
    const statMaps = {
        'baseball_mlb': baseballStatMap,
        'basketball_nba': basketballStatMap,
        'basketball_ncaab': basketballStatMap,
        'basketball_wncaab': basketballStatMap,
        'americanfootball_nfl': footballStatMap,
        'americanfootball_ncaaf': footballStatMap,
        'icehockey_nhl': hockeyStatMap
    };

    const featureImportanceWithLabels = statMaps[sport.name].map((stat, index) => ({
        feature: stat,
        importance: featureImportanceScores[index]
    }));
    console.log(featureImportanceWithLabels)
    // await db.MlModelWeights.upsert({
    //     sport: sport.id,
    //     inputToHiddenWeights: inputToHiddenWeights,  // Store the 40x128 matrix
    //     hiddenToOutputWeights: hiddenToOutputWeights, // Store the 128x1 vector
    //     featureImportanceScores: featureImportanceWithLabels,  // Store the importance scores
    // })

    if (global.gc) global.gc();
    console.log(`ml model done for ${sport.name} @ ${moment().format('HH:mm:ss')}`);
};

module.exports = { getStat, getWinLoss, getHomeAwayWinLoss, normalizeStat, extractSportFeatures, mlModelTraining, predictions, trainSportModelKFold, loadOrCreateModel, evaluateMetrics }