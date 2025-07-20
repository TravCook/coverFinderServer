const { Odds, PastGameOdds, Weights } = require('../../../models');
const db = require('../../../models_sql');
const Sequelize = require('sequelize');
const { Op } = Sequelize;
const statsMinMax = require('../../seeds/sampledGlobalStats.json')
const { checkNaNValues } = require('../dataHelpers/dataSanitizers')
const fs = require('fs')
const tf = require('@tensorflow/tfjs-node');
const moment = require('moment')
const cliProgress = require('cli-progress');
const pastGameOdds = require('../../../models/pastGameOdds');
const { Console } = require('console');
const { baseballStatMap, basketballStatMap, footballStatMap, hockeyStatMap } = require('../../statMaps')
const globalMeans = require('../../seeds/globalMeans.json');
const { exit } = require('process');

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

const normalizeStatZScore = (statName, value, sportKey = null) => {
    let statMeta;

    // Try sport-specific first
    if (sportKey && globalMeans.perSport?.[sportKey]?.[statName]) {
        statMeta = globalMeans.perSport[sportKey][statName];
    }
    // Fallback to global
    else if (globalMeans.global?.[statName]) {
        statMeta = globalMeans.global[statName];
    }

    if (!statMeta) {
        console.warn(`No mean/stdDev found for stat: ${statName} (sport: ${sportKey})`);
        return value; // fallback: return original value
    }

    const { mean, stdDev } = statMeta;

    // Avoid division by zero
    if (stdDev === 0) return 0;

    return (value - mean) / stdDev;
};


// const getNumericStat = (stats, statName, gameCount) => {
//     if (!stats || stats[statName] === undefined) return 0;


//     return stats[statName] * (.95 * gameCount);
// };
const getStepwiseDecayWeight = (gameCount, stepSize = 60, baseDecay = 0.9) => {
    const decaySteps = Math.floor(gameCount / stepSize);
    return Math.pow(baseDecay, decaySteps);
};

const getNumericStat = (stats, statName, gameCount) => {
    if (!stats || stats[statName] === undefined) return 0;
    const weight = getStepwiseDecayWeight(gameCount, 100, 0.97); // decay every 60 games
    return stats[statName] * weight;
};



// Feature extraction per sport
const extractSportFeatures = (homeStats, awayStats, league, gameCount) => {
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
            return baseballStatMap.map(key => getNumericStat(homeStats, key, gameCount))
                .concat(baseballStatMap.map(key => getNumericStat(awayStats, key, gameCount)))
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

    for (let i = 0; i < numPasses; i++) {
        const pred = await model.predict(inputTensor).array(); // Get predictions
        // const pred = await model.apply(inputTensor, { training: true }).array(); // Apply the model to the input tensor
        predictions.push(pred.map(p => p[0])); // Flatten to 1D
    }

    // Average across predictions
    const averaged = predictions[0].map((_, i) =>
        predictions.reduce((sum, run) => sum + run[i], 0) / numPasses
    );

    return averaged;
};

// Function to calculate dynamic class weights
const calculateClassWeights = (ys) => {

    const homeWins = ys.filter(y => y === 1).length;   // Count the home wins (ys = 1)
    const homeLosses = ys.filter(y => y === 0).length; // Count the home losses (ys = 0)


    const totalExamples = homeWins + homeLosses;
    const classWeightWin = totalExamples / (2 * homeWins);   // Weight for home wins
    const classWeightLoss = totalExamples / (2 * homeLosses); // Weight for home losses

    return {
        0: classWeightLoss, // Weight for home losses
        1: classWeightWin   // Weight for home wins
    };
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
        l2Reg: search
            ? sport.hyperParameters.l2Reg
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
        kFolds: sport['hyperParams.kFolds'], // always comes from the saved hyperParams
        kernalInitializer: sport['hyperParams.kernalInitializer'] || 'glorotUniform',
        decayFactor: sport['hyperParams.decayFactor'] || 1,
        gameDecayThreshold: sport['hyperParams.gameDecayThreshold'] || 10,
    };
};


const loadOrCreateModel = async (xs, sport, search) => {
    // Define the path to the model
    const modelPath = `./model_checkpoint/${sport.name}_model/model.json`;
    try {
        if (fs.existsSync(modelPath) && !search) {
            return await tf.loadLayersModel(`file://./model_checkpoint/${sport.name}_model/model.json`);
        } else {
            const tf = require('@tensorflow/tfjs'); // if not already imported

            const hyperParams = getHyperParams(sport, search);
            const l2Strength = hyperParams.l2Reg || 0; // You can tune this (start small)
            const dropoutRate = 0; // You can tune this (start small)
            let newModel = tf.sequential();

            // Input layer with L2 regularization
            newModel.add(tf.layers.dense({
                units: hyperParams.layerNeurons,
                inputShape: [xs[0].length],
                activation: 'relu',
                kernelRegularizer: tf.regularizers.l2({ l2: l2Strength }),
                biasInitializer: 'zeros',
            }));

            // Hidden layers with L2
            for (let layers = 0; layers < hyperParams.hiddenLayerNum; layers++) {
                newModel.add(tf.layers.dense({
                    units: hyperParams.layerNeurons,
                    activation: 'relu',
                    kernelRegularizer: tf.regularizers.l2({ l2: l2Strength }),
                    biasInitializer: 'zeros',
                }));
                newModel.add(tf.layers.dropout({ rate: dropoutRate })); // Dropout after activation
            }

            // Output layer (binary classification)
            newModel.add(tf.layers.dense({
                units: 1,
                activation: 'sigmoid',
                kernelRegularizer: tf.regularizers.l2({ l2: l2Strength }),
                biasInitializer: 'zeros',
            }));


            return newModel
        }
    } catch (err) {
        console.log(err)
    }
}

const getZScoreNormalizedStats = (teamId, currentStats, teamStatsHistory) => {
    const history = teamStatsHistory[teamId] || [];

    // Shallow copy so we don't mutate original input
    const transformedStats = { ...currentStats };

    // Always convert win-loss strings into integers
    ['seasonWinLoss', 'homeWinLoss', 'awayWinLoss'].forEach(key => {
        if (transformedStats[key] && typeof transformedStats[key] === 'string') {
            const [wins, losses] = transformedStats[key].split('-').map(Number);
            transformedStats[key] = wins - losses;
        }
    });

    if (history.length < 3) {
        // Not enough data yet — return transformed raw stats
        return transformedStats;
    }

    const keys = Object.keys(transformedStats);
    const means = {};
    const stds = {};

    keys.forEach(key => {
        const values = history.map(s => {
            if (key === 'seasonWinLoss' || key === 'homeWinLoss' || key === 'awayWinLoss') {
                const [wins, losses] = s[key].split('-').map(Number);
                return wins - losses;
            }
            return s[key];
        });

        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const std = Math.sqrt(
            values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
        );

        means[key] = mean;
        stds[key] = std === 0 ? 1 : std;
    });

    const normalized = {};
    keys.forEach(key => {
        normalized[key] = (transformedStats[key] - means[key]) / stds[key];
    });

    return normalized;
}; //SINGLE TEAM HISTORY

// const getZScoreNormalizedStats = (teamId, currentStats, teamStatsHistory) => {
//     const transformedStats = { ...currentStats };

//     // Always convert win-loss strings into integers
//     ['seasonWinLoss', 'homeWinLoss', 'awayWinLoss'].forEach(key => {
//         if (transformedStats[key] && typeof transformedStats[key] === 'string') {
//             const [wins, losses] = transformedStats[key].split('-').map(Number);
//             transformedStats[key] = wins - losses;
//         }
//     });

//     // Flatten all history into one array across all teams
//     const allHistory = Object.values(teamStatsHistory).flat();



//     const keys = Object.keys(transformedStats);
//     if (allHistory.length < 15) {
//         // Not enough data yet — return transformed raw stats
//         return transformedStats;
//     }
//     const means = {};
//     const stds = {};
//     keys.forEach(key => {
//         const values = allHistory
//             .map(s => {
//                 if (s[key] == null) return null;
//                 if (key === 'seasonWinLoss' || key === 'homeWinLoss' || key === 'awayWinLoss') {
//                     if (typeof s[key] === 'string') {
//                         const [wins, losses] = s[key].split('-').map(Number);
//                         return wins - losses;
//                     }
//                     return s[key]; // Already converted
//                 }
//                 return s[key];
//             })
//             .filter(val => typeof val === 'number' && !isNaN(val));

//         const mean = values.reduce((a, b) => a + b, 0) / values.length;
//         const std = Math.sqrt(
//             values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
//         );

//         means[key] = mean;
//         stds[key] = std === 0 ? 1 : std;
//     });
//     const normalized = {};
//     keys.forEach(key => {
//         normalized[key] = (transformedStats[key] - means[key]) / stds[key];
//     });

//     return normalized;
// }; //ALL TEAM HISTORY


const mlModelTraining = async (gameData, xs, ys, sport, search, gameCount) => {
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
        const normalizedHome = getZScoreNormalizedStats(homeTeamId, homeRawStats, teamStatsHistory);
        const normalizedAway = getZScoreNormalizedStats(awayTeamId, awayRawStats, teamStatsHistory);
        if (!normalizedHome || !normalizedAway) {
            console.log(game.id)
            return;
        }
        const statFeatures = extractSportFeatures(normalizedHome, normalizedAway, sport.name, gameCount);
        const homeLabel = game.winner === 'home' ? 1 : 0;
        if (statFeatures.some(isNaN) || homeLabel === null) {
            console.error('NaN detected in features during Training:', game.id);
            process.exit(0)
        } else {
            xs.push(statFeatures);
            ys.push(homeLabel);
        }

        if (statFeatures.length / 2 === statMap.length) {
            // Update history AFTER using current stats
            if (!teamStatsHistory[homeTeamId]) teamStatsHistory[homeTeamId] = [];
            if (!teamStatsHistory[awayTeamId]) teamStatsHistory[awayTeamId] = [];

            teamStatsHistory[homeTeamId].push(homeRawStats);
            if (teamStatsHistory[homeTeamId].length > 5) {
                teamStatsHistory[homeTeamId].shift(); // remove oldest game
            }
            teamStatsHistory[awayTeamId].push(awayRawStats);
            if (teamStatsHistory[awayTeamId].length > 5) {
                teamStatsHistory[awayTeamId].shift(); // remove oldest game
            }
        }
        gameCount++
    });


    checkFeatureLeakage(xs, ys)
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
    // console.log(xsTensor.shape)
    const ysTensor = tf.tensor2d(ys, [ys.length, 1]);
    // Define the path to the model directory
    const modelDir = `./model_checkpoint/${sport.name}_model`;
    // Define the model
    // console.log(xs.length)
    const model = await loadOrCreateModel(xs, sport, search)
    model.compile({
        optimizer: tf.train.adam(search ? sport.hyperParameters.learningRate : sport['hyperParams.learningRate']),
        loss: 'binaryCrossentropy',
        metrics: ['accuracy']
    });
    await model.fit(xsTensor, ysTensor, {
        epochs: search ? sport.hyperParameters.epochs : sport['hyperParams.epochs'],
        batchSize: search ? sport.hyperParameters.batchSize : sport['hyperParams.batchSize'],
        classWeight: await calculateClassWeights(ys),
        validationSplit: 0.4,
        verbose: false,
        callbacks: [tf.callbacks.earlyStopping({
            monitor: 'val_loss',
            patience: 5,
            restoreBestWeight: true
        })]
    });

    xsTensor.dispose();
    ysTensor.dispose();


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
const predictions = async (sportOdds, ff, model, sport, past) => {
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
    const teamStatsHistory = {}; // teamID => [pastStatsObjects]
    for (const game of sportOdds) {
        if (Date.parse(game.commence_time) <= Date.now() && !past) continue; // Skip upcoming games if already started
        const homeTeamId = game.homeTeamId;
        const awayTeamId = game.awayTeamId;

        const homeRawStats = game['homeStats.data'];
        const awayRawStats = game['awayStats.data'];

        const normalizedHome = getZScoreNormalizedStats(homeTeamId, homeRawStats, teamStatsHistory);
        const normalizedAway = getZScoreNormalizedStats(awayTeamId, awayRawStats, teamStatsHistory);

        if (!normalizedHome || !normalizedAway) {
            console.log(game.id)
            return;
        }

        const statFeatures = extractSportFeatures(normalizedHome, normalizedAway, sport.name, 0);

        if (statFeatures.some(isNaN)) {
            console.error('NaN detected in features Predictions:', game.id);
            return;
        }

        // Update history AFTER using current stats
        if (!teamStatsHistory[homeTeamId]) teamStatsHistory[homeTeamId] = [];
        if (!teamStatsHistory[awayTeamId]) teamStatsHistory[awayTeamId] = [];

        teamStatsHistory[homeTeamId].push(homeRawStats);
        if (teamStatsHistory[homeTeamId].length > 5) {
            teamStatsHistory[homeTeamId].shift(); // remove oldest game
        }

        teamStatsHistory[awayTeamId].push(awayRawStats);
        if (teamStatsHistory[awayTeamId].length > 5) {
            teamStatsHistory[awayTeamId].shift(); // remove oldest game
        }

        const probability = await repeatPredictions(model, tf.tensor2d([statFeatures]), 100); // Get the average probability for home team winning
        let predictedWinner = probability[0] >= 0.5 ? 'home' : 'away'; // Predict home if probability >= 0.5, else away
        let predictionConfidence = probability[0] >= .5 ? probability[0] : 1 - probability[0]; // Confidence is the max of home or away probability
        // Track the game so we can compare two predictions later
        const updatePayload = {
            predictedWinner,
            predictionConfidence: predictionConfidence
        };
        if (game.predictedWinner !== predictedWinner) {
            predictionsChanged++
            let oldWinner = game.predictedWinner === 'home' ? game['homeTeamDetails.espnDisplayName'] : game['awayTeamDetails.espnDisplayName'];
            let newWinner = predictedWinner === 'home' ? game['homeTeamDetails.espnDisplayName'] : game['awayTeamDetails.espnDisplayName'];
            if(!past)console.log(`Prediction changed for game ${game.id}: ${oldWinner} → ${newWinner} (Confidence: ${predictionConfidence})`);
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

        }

        await db.Games.update(updatePayload, { where: { id: game.id } });


    }
    console.log(`OUT OF ${sportOdds.length} GAMES [TOTAL WINS: ${totalWins}, TOTAL LOSSES: ${totalLosses}]: PREDICTIONS CHANGED: ${predictionsChanged} | NEW WINNER PREDICTIONS: ${newWinnerPredictions} | NEW LOSER PREDICTIONS: ${newLoserPredictions} | NEW CONFIDENCE PREDICTIONS: ${newConfidencePredictions}`);
    console.log(`50/50 MATCHUPS: ${fiftyfiftyMatchups} (${((fiftyfiftyMatchups / sportOdds.length) * 100).toFixed(1)}%) | 60-70% MATCHUPS: ${sixtyToSeventyMatchups} (${((sixtyToSeventyMatchups / sportOdds.length) * 100).toFixed(1)}%) | 70-80% MATCHUPS: ${seventyToEightyMatchups} (${((seventyToEightyMatchups / sportOdds.length) * 100).toFixed(1)}%) | 80-90% MATCHUPS: ${eightyToNinetyMatchups} (${((eightyToNinetyMatchups / sportOdds.length) * 100).toFixed(1)}%) | HIGH CONFIDENCE GAMES: ${highConfGames} (${((highConfGames / sportOdds.length) * 100).toFixed(1)}%) | HIGH CONFIDENCE LOSERS: ${highConfLosers}`)
    console.info(`FINISHED PREDICTIONS FOR ${sport.name} @ ${moment().format('HH:mm:ss')}`);
};

const evaluateMetrics = (ysTensor, yPredTensor) => {
    // Round the predictions to either 0 or 1 (binary classification)
    const yPredBool = yPredTensor.greaterEqual(.49);


    // Convert ysTensor from float32 to boolean tensor
    const ysTensorBool = ysTensor.greaterEqual(.5);  // Convert values >= 0.5 to true (1), and < 0.5 to false (0)

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



const trainSportModelKFold = async (sport, gameData, search, upcomingGames) => {
    sportGames = upcomingGames.filter((game) => game.sport_key === sport.name) //USE THIS TO POPULATE UPCOMING GAME ODDS
    let sortedGameData = gameData.sort((a, b) => new Date(b.commence_time) - new Date(a.commence_time)); // Sort by commence_time
    console.log(`${sortedGameData[0].commence_time.toLocaleString()} - ${sortedGameData[sortedGameData.length - 1].commence_time.toLocaleString()}`)
    const numFolds = 4;  // Number of folds (you can adjust based on your data)
    const foldSize = Math.floor(gameData.length / numFolds);  // Size of each fold
    const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    let allFolds = [];
    let gameCount = 0

    // Split gameData into `numFolds` folds
    for (let i = 0; i < numFolds; i++) {
        const foldStart = i * foldSize;
        const foldEnd = i === numFolds - 1 ? sortedGameData.length : (i + 1) * foldSize;
        allFolds.push(sortedGameData.slice(foldStart, foldEnd));
    }
    const total = allFolds.length
    let foldResults = [];
    let finalModel
    bar.start(total, 0);
    progress = 0
    // Perform training and testing on each fold
    for (let foldIndex = 0; foldIndex < allFolds.length; foldIndex++) {
        let foldData = [...allFolds[foldIndex]]

        const startTest = foldData.length - (foldData.length * .30);
        const endTest = foldData.length - 1;

        const trainingData = [...foldData.slice(0, startTest)];
        const testData = foldData.slice(startTest, endTest);

        // Train the model with training data
        const { model, updatedGameCount } = await mlModelTraining(trainingData, [], [], sport, search, gameCount);
        gameCount = updatedGameCount
        finalModel = model

        const testXs = [];
        const testYs = [];

        const teamStatsHistory = {}; // teamID => [pastStatsObjects]

        testData.forEach(game => {
            const homeTeamId = game.homeTeamId;
            const awayTeamId = game.awayTeamId;

            const homeRawStats = game['homeStats.data'];
            const awayRawStats = game['awayStats.data'];

            const normalizedHome = getZScoreNormalizedStats(homeTeamId, homeRawStats, teamStatsHistory);
            const normalizedAway = getZScoreNormalizedStats(awayTeamId, awayRawStats, teamStatsHistory);

            if (!normalizedHome || !normalizedAway) {
                console.log(game.id)
                return;
            }
            const statFeatures = extractSportFeatures(normalizedHome, normalizedAway, sport.name, gameCount);
            const homeLabel = game.winner === 'home' ? 1 : 0;

            if (statFeatures.some(isNaN) || homeLabel === null) {
                console.error('NaN detected in features during kFoldTest:', game.id);
                process.exit(0);
            } else {
                testXs.push(statFeatures);
                testYs.push(homeLabel);
            }

            // Update history AFTER using current stats
            if (!teamStatsHistory[homeTeamId]) teamStatsHistory[homeTeamId] = [];
            if (!teamStatsHistory[awayTeamId]) teamStatsHistory[awayTeamId] = [];

            teamStatsHistory[homeTeamId].push(homeRawStats);
            if (teamStatsHistory[homeTeamId].length > 5) {
                teamStatsHistory[homeTeamId].shift(); // remove oldest game
            }

            teamStatsHistory[awayTeamId].push(awayRawStats);
            if (teamStatsHistory[awayTeamId].length > 5) {
                teamStatsHistory[awayTeamId].shift(); // remove oldest game
            }
            gameCount++
        });

        // Create tensors
        const testXsTensor = tf.tensor2d(testXs);
        const testYsTensor = tf.tensor2d(testYs, [testYs.length, 1]);

        const evaluation = await model.evaluate(testXsTensor, testYsTensor);
        const loss = await evaluation[0].arraySync();
        const accuracy = await evaluation[1].arraySync();


        const predictionsArray = await repeatPredictions(model, testXsTensor, 100);
        const predictionsTensor = tf.tensor2d(predictionsArray, [predictionsArray.length, 1]);
        const metrics = evaluateMetrics(testYsTensor, predictionsTensor);
        predictionsTensor.dispose();

        // const confidences = predictionsArray.map(p => Math.abs(p - 0.5) * 2);  // Converts 0.5→0, 1.0/0.0→1.0
        // console.log("High-confidence predictions:", confidences.filter(c => c > 0.9).length);


        testXsTensor.dispose();
        testYsTensor.dispose();

        // Store fold results
        foldResults.push({
            foldIndex,
            loss,
            accuracy,
            precision: metrics.precision,
            recall: metrics.recall,
            f1Score: metrics.f1Score,
            truePositives: metrics.truePositives,
            falsePositives: metrics.falsePositives,
            trueNegatives: metrics.trueNegatives,
            falseNegatives: metrics.falseNegatives
        });
        progress += 1
        bar.update(progress)
        if (progress >= total) {
            bar.stop();
            console.log('Done!');
        }
    }

    // finalModel.summary()
    // console.log('Optimizer:', finalModel.optimizer.getClassName());
    // console.log('Learning rate:', finalModel.optimizer.learningRate);


    if (!search) await predictions(sportGames, [], finalModel, sport)
    // await predictions(gameData, [], finalModel, sport, true) // Predictions for past games DO NOT RUN THIS AGAIN FOR BASEBALL. MAYBE FOR OTHER SPORTS BUT NOT LIKELY. DO NOT UNCOMMENT UNLESS YOU COMPLETELY CHANGE THE ARCHITECTURE OF THE MODEL OR THE DATASET. IT WILL OVERWRITE PAST GAME ODDS AND PREDICTIONS.
    // After all folds, calculate and log the overall performance
    const avgF1Score = foldResults.reduce((sum, fold) => sum + fold.f1Score, 0) / foldResults.length;
    const totalTruePositives = foldResults.reduce((sum, fold) => sum + fold.truePositives, 0)
    const totalFalsePositives = foldResults.reduce((sum, fold) => sum + fold.falsePositives, 0)
    const totalTrueNegatives = foldResults.reduce((sum, fold) => sum + fold.trueNegatives, 0)
    const totalFalseNegatives = foldResults.reduce((sum, fold) => sum + fold.falseNegatives, 0)

    console.log(`--- Overall Performance Avg F1-Score: ${avgF1Score} ---`);
    console.log(`truePositives: ${totalTruePositives} (${(totalTruePositives / (totalTruePositives + totalFalseNegatives + totalFalsePositives + totalTrueNegatives) * 100).toFixed(2)}%)`);
    console.log(`falsePositives: ${totalFalsePositives} (${(totalFalsePositives / (totalTruePositives + totalFalseNegatives + totalFalsePositives + totalTrueNegatives) * 100).toFixed(2)}%)`);
    console.log(`falseNegatives: ${totalFalseNegatives} (${(totalFalseNegatives / (totalTruePositives + totalFalseNegatives + totalFalsePositives + totalTrueNegatives) * 100).toFixed(2)}%)`);
    console.log(`trueNegatives: ${totalTrueNegatives} (${(totalTrueNegatives / (totalTruePositives + totalFalseNegatives + totalFalsePositives + totalTrueNegatives) * 100).toFixed(2)}%)`);

    if (search) return avgF1Score

    let inputToHiddenWeights = finalModel.layers[0].getWeights()[0].arraySync();  // Shape: 40x128
    let hiddenToOutputWeights = finalModel.layers[finalModel.layers.length - 1].getWeights()[0].arraySync();  // Shape: 128x1
    let statMaps = {
        'baseball_mlb': baseballStatMap,
        'basketball_nba': basketballStatMap,
        'basketball_ncaab': basketballStatMap,
        'basketball_wncaab': basketballStatMap,
        'americanfootball_nfl': footballStatMap,
        'americanfootball_ncaaf': footballStatMap,
        'icehockey_nhl': hockeyStatMap

    }
    // Calculate the importance scores
    let featureImportanceScores = calculateFeatureImportance(inputToHiddenWeights, hiddenToOutputWeights);
    let featureImportanceWithLabels = statMaps[sport.name].map((stat, index) => ({
        feature: stat,
        importance: featureImportanceScores[index]
    }));
    await db.MlModelWeights.upsert({
        sport: sport.id,
        inputToHiddenWeights: inputToHiddenWeights,  // Store the 40x128 matrix
        hiddenToOutputWeights: hiddenToOutputWeights, // Store the 128x1 vector
        featureImportanceScores: featureImportanceWithLabels,  // Store the importance scores
    })


    console.log(`ml model done for ${sport.name} @ ${moment().format('HH:mm:ss')}`);
};


module.exports = { getStat, getWinLoss, getHomeAwayWinLoss, normalizeStat, extractSportFeatures, mlModelTraining, predictions, trainSportModelKFold, loadOrCreateModel, evaluateMetrics }