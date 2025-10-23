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
const os = require('os');

// Here are some potential issues in the training and prediction loops in your code:

// ---

// ### 1. **Data Leakage in Feature Extraction**
// - In `extractSportFeatures`, you use `sortedGames` to compute features like recent win rate, average points, etc. If `sortedGames` includes the current game or future games, this can cause data leakage.
// - **Fix:** Always ensure only past games (before the current game date) are used for feature engineering.
//CONSOLE LOG IN PLACE TO TEST THIS

// ---

// ### 2. **Inconsistent Sorting of Game Data**
// - In `mlModelTraining`, you sort `gameData` as `sortedGameData` but then loop over the original `gameData` (which may not be sorted).
// - In `trainSportModelKFold`, you sort `gameData` multiple times, sometimes descending, sometimes ascending, which can lead to confusion and bugs.
// - **Fix:** Always sort once and use the sorted array consistently.

// ---

// ### 3. **NaN Handling**
// - In `mlModelTraining`, you check for `!normalizedHome || !normalizedAway` but do not check for NaN values in the feature arrays themselves.
// - In `trainSportModelKFold`, you check for `isNaN` in features, but only after extracting them, which may be too late.
// - **Fix:** Add robust NaN checks after feature extraction and before pushing to `xs`.

// ---

// ### 4. **Tensor Memory Leaks**
// - In `mlModelTraining`, you dispose of `xsTensor` and `ysScoresTensor`, but not the train/val splits (`xsTrain`, `ysScoresTrain`, etc.).
// - In `predictions`, you dispose of input tensors, but not the prediction tensors.
// - **Fix:** Dispose of all created tensors to avoid memory leaks.

// ---

// ### 5. **Label Normalization Consistency**
// - You normalize labels using mean and stddev from all past games, but if the test set contains out-of-distribution scores, this can skew results.
// - **Fix:** Consider using only training data to compute normalization statistics.

// ---

// ### 6. **Potential Overlap in K-Fold Splits**
// - In `trainSportModelKFold`, the way you calculate `trainEnd`, `valStart`, and `valEnd` may cause overlap or uneven splits, especially for small datasets.
// - **Fix:** Double-check fold boundaries to ensure no overlap and even distribution.

// ---

// ### 7. **Feature Leakage Check**
// - The `checkFeatureLeakage` function only warns but does not prevent training if high correlation is found.
// - **Fix:** Consider failing fast or removing highly correlated features automatically.

// ---

// ### 8. **Prediction Averaging**
// - In `repeatPredictions`, you return `[averagedScore]`, which is a nested array. In `predictions`, you use `homePredictions[0]`, which may not be robust if the output shape changes.
// - **Fix:** Return a flat array or document the shape clearly.

// ---

// ### 9. **No Shuffling Before Train/Val Split**
// - In `mlModelTraining`, you split the data into train/val sets without shuffling, which can cause temporal leakage if data is ordered by date.
// - **Fix:** Shuffle before splitting, or use time-based splits intentionally.

// ---

// ### 10. **Possible Race Conditions in DB Updates**
// - In `predictions`, you update the DB inside a loop with `await db.Games.update(...)`. If running in parallel, this could cause race conditions.
// - **Fix:** Consider batching updates or using transactions.

// ---

// ### 11. **Hardcoded Hyperparameters**
// - Some hyperparameters (like dropout, batch norm) are commented out or hardcoded, which may reduce model flexibility.
// - **Fix:** Make these configurable via hyperparameters.

// ---

// ### 12. **Error Handling**
// - Many places just `console.log` errors and continue, which can hide silent failures.
// - **Fix:** Add better error handling and reporting.

// ---

// **Summary:**  
// The main issues are potential data leakage, inconsistent sorting, incomplete NaN/tensor cleanup, and lack of robust error handling. Addressing these will improve model reliability and reproducibility.


/**
 * Extracts and saves feature importances from a trained model for a given sport.
 * Computes the contribution of each input feature to the output by multiplying the weights
 * from input through all hidden layers to the output, then normalizes and saves the results.
 * Also saves raw weights for UI/analysis.
 * @param {tf.LayersModel} model - Trained TensorFlow.js model
 * @param {Object} sport - Sport config object (contains stat map and id)
 */
async function extractAndSaveFeatureImportances(model, sport) {
    // Get the stat map for the sport (list of feature names)
    const statMap = statConfigMap[sport.espnSport].default;
    const inputSize = statMap.length;

    // Get hyperparameters for the sport (for layer counts, etc.)
    const hyperParams = getHyperParams(sport, false);
    const hiddenLayerCount = hyperParams.hiddenLayerNum;
    const dropoutRate = hyperParams.dropoutReg || 0;

    // 1. Get input-to-gate weights (feature gating layer)
    // The featureGate layer is the second layer (index 1)
    const inputToGateWeights = model.layers[1].getWeights()[0]; // shape: [input_features, input_features]

    // 2. Multiply layer (element-wise gating), so multiply input by gate weights
    // This simulates the effect of the gating layer on the input features
    const gatedInputWeights = tf.mul(inputToGateWeights, tf.onesLike(inputToGateWeights)); // element-wise multiply

    let currentWeights = gatedInputWeights;

    // 3. Traverse through hidden layers, multiplying weights to propagate feature importance
    let layerPointer = 3; // model.layers[0] = input, [1] = featureGate, [2] = multiply, [3+] = dense layers

    for (let i = 0; i < hiddenLayerCount; i++) {
        // Skip layers with no weights (e.g., activation, batch norm)
        while (layerPointer < model.layers.length &&
            model.layers[layerPointer].getWeights().length === 0) {
            layerPointer++;
        }

        const denseLayer = model.layers[layerPointer];
        const weights = denseLayer.getWeights()[0]; // weight matrix: [prev_units, units]

        // Multiply current weights by this layer's weights to propagate importance
        currentWeights = tf.matMul(currentWeights, weights);
        layerPointer++;
    }

    // 4. Connect to output layer (scoreOutput)
    // Get the weights from the last hidden layer to the output
    const scoreOutputLayer = model.getLayer('scoreOutput');
    const finalWeights = scoreOutputLayer.getWeights()[0]; // shape: [last_hidden_units, 1]

    // Multiply through to get feature-to-output weights
    const featureToOutput = tf.matMul(currentWeights, finalWeights); // shape: [input_features, 1]

    // 5. Normalize importance scores
    // Take absolute value and sum across output (if multi-output, here just 1)
    let importanceScores = tf.abs(featureToOutput).sum(1); // sum across output
    importanceScores = importanceScores.div(importanceScores.max()); // normalize to [0, 1]

    // Convert tensor to array for saving
    const scoresArr = await importanceScores.array();

    // Pair each feature with its importance score
    const featureImportanceWithLabels = statMap.map((stat, i) => ({
        feature: stat,
        importance: scoresArr[i]
    }));

    // Optional: Save raw weights for debugging or UI
    const inputToHiddenWeights = await inputToGateWeights.array(); // raw feature gate weights
    const hiddenToOutputWeights = await finalWeights.array();

    // 6. Save to DB (upsert to avoid duplicates)
    await db.MlModelWeights.upsert({
        sport: sport.id,
        inputToHiddenWeights,
        hiddenToOutputWeights,
        featureImportanceScores: featureImportanceWithLabels
    });
}

/**
 * Computes the Pearson correlation coefficient between two arrays.
 * Used to detect linear relationships (potential feature leakage).
 * @param {Array<number>} x - First array of values (feature)
 * @param {Array<number>} y - Second array of values (target)
 * @returns {number} - Pearson correlation coefficient (-1 to 1)
 */
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

/**
 * Checks for feature leakage by computing the correlation between each feature and the target.
 * Warns if any feature is highly correlated with the target (possible data leakage).
 * @param {Array<Array<number>>} xs - Feature matrix (samples x features)
 * @param {Array<number>} ys - Target array
 */
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

/**
 * Normalizes a stat value using min-max scaling based on global sampled stats.
 * If no min/max is found, returns the original value.
 * @param {string} statName - Name of the stat to normalize
 * @param {number} value - Stat value to normalize
 * @param {Array} games - (Unused, for compatibility)
 * @returns {number} - Normalized value in [0, 1]
 */
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

/**
 * Gets a numeric value for a stat, handling string values like "10-2" (win-loss).
 * If the stat is a win-loss string, returns the number of wins.
 * @param {Object} stats - Stats object
 * @param {string} statName - Name of the stat
 * @returns {number} - Numeric value for the stat
 */
const getNumericStat = (stats, statName) => {
    if (!stats || stats[statName] === undefined) return 0;
    const val = stats[statName];
    if (typeof val === 'string' && val.includes('-')) {
        const [wins, losses] = val.split('-').map(Number);
        return wins;
    }
    return val;
};

/**
 * Checks if a stats object is valid for a given sport.
 * Ensures all required keys are present and values are numbers (or valid strings).
 * @param {Object} statsObj - Stats object to check
 * @param {Object} sport - Sport config object (for stat map)
 * @returns {boolean} - True if valid, false otherwise
 */
const isValidStatBlock = (statsObj, sport) => {
    const config = statConfigMap[sport?.espnSport];
    if (!config || !config.default) return false;

    const requiredKeys = config.default;

    // Check all required keys are present
    for (const key of requiredKeys) {
        if (!(key in statsObj)) return false;
    }

    // Check all values are numbers or valid strings
    for (const [key, val] of Object.entries(statsObj)) {
        if (typeof val === 'string') continue;
        if (typeof val !== 'number' || isNaN(val)) return false;
    }

    return true;
};

/**
 * Extracts features for a given game/team for model input.
 * Combines team stats, opponent stats, game context (home/away, rest days, playoff, etc.),
 * recent performance, and engineered features (stat diffs, time of day, etc.).
 * Handles each sport with its own stat map and season logic.
 * @param {Object} homeStats - Stats for the team (home or away, depending on 'home' param)
 * @param {Object} awayStats - Stats for the opponent
 * @param {Object} sport - Sport config object
 * @param {Object} gameData - Game object (contains teams, commence_time, etc.)
 * @param {Array} sortedGames - Array of all games, sorted by date
 * @param {boolean} home - True if extracting for home team, false for away
 * @returns {Array<number>} - Feature vector for the model
 */
const extractSportFeatures = (homeStats, awayStats, sport, gameData, sortedGames, home) => {
    // Parse game date and context
    let gameDate = new Date(gameData.commence_time)
    let hourOfDay = gameDate.getHours() + (gameDate.getMinutes() / 60); // e.g., 14.5 for 2:30 PM
    let isHome = home ? 1 : 0;
    let teamId = home ? gameData.homeTeam : gameData.awayTeam
    let opponentId = home ? gameData.awayTeam : gameData.homeTeam

    // Find the most recent past game for rest days calculation
    let pastTeamGames = sortedGames.find(g => (g.homeTeam === teamId || g.awayTeam === teamId) && new Date(g.commence_time) < gameDate)
    
    //log dates of first and last pastTeamGames
    // console.log(`Game Date: ${gameDate.toISOString()}, Past Team Game Date: ${pastTeamGames.length > 0 ? `${new Date(pastTeamGames[0].commence_time).toISOString()} - ${new Date(pastTeamGames[pastTeamGames.length-1].commence_time).toISOString()}` : 'N/A'}`)

    let restDays = pastTeamGames ? moment(gameDate).diff(moment(new Date(pastTeamGames.commence_time)), 'days') : 0

    // Find all previous games vs this opponent
    let gamesVsOpponent = sortedGames.filter(g =>
        (g.homeTeam === teamId && g.awayTeam === opponentId || g.homeTeam === opponentId && g.awayTeam === teamId) &&
        new Date(g.commence_time) < gameDate
    );

    // Compute win rate vs this opponent
    let winRateVsOpponent = gamesVsOpponent.length > 0 ? (gamesVsOpponent.filter(g => (g.winner === 'home' && g.homeTeam === teamId) || (g.winner === 'away' && g.awayTeam === teamId)).length / gamesVsOpponent.length) : 0;

    // Get recent games for this team in the current season
    let recentGames = sortedGames.filter(g => (g.homeTeam === teamId || g.awayTeam === teamId)).sort((a, b) => new Date(b.commence_time) - new Date(a.commence_time)).filter((game) => {
        let sportStartMonth = sport.startMonth
        let seasonStartDate = new Date(gameDate.getFullYear(), sportStartMonth - 1, 1);
        let gameCommenceDate = new Date(game.commence_time);
        return gameCommenceDate >= seasonStartDate; // Only include games from the current season
    }).slice(0, 10)

    // Compute recent win rate, average points for/against
    let recentWinRate = recentGames.length > 0 ? (recentGames.filter(g => (g.winner === 'home' && g.homeTeam === teamId) || (g.winner === 'away' && g.awayTeam === teamId)).length / recentGames.length) : 0;
    let recentAvgPointsFor = recentGames.length > 0 ? (recentGames.reduce((acc, g) => {
        if (g.homeTeam === teamId) return acc + g.homeScore;
        else return acc + g.awayScore;
    }, 0) / recentGames.length) : 0;
    let recentAvgPointsAgainst = recentGames.length > 0 ? (recentGames.reduce((acc, g) => {
        if (g.homeTeam === teamId) return acc + g.awayScore;
        else return acc + g.homeScore;
    }, 0) / recentGames.length) : 0;

    let statDiffs
    let statRatios

    // Encode hour of day as cyclical features
    let hourSin = Math.sin(2 * Math.PI * hourOfDay / 24);
    let hourCos = Math.cos(2 * Math.PI * hourOfDay / 24);

    // Product of win rates as an engineered feature
    let winRateProduct = winRateVsOpponent * recentWinRate;

    // Switch by sport to select stat map and playoff logic
    switch (sport.name) {
        case 'americanfootball_nfl':
            // NFL playoff games start in January
            let playoffMonthStartNFL = 1; // January
            let playoffGameNFL = (gameDate.getMonth() + 1) >= playoffMonthStartNFL
            let daysSinceSeasonStartNFL = moment(gameDate).diff(moment(`${gameDate.getFullYear()}-09-01`), 'days');
            statDiffs = footballStatMap.map(key => getNumericStat(homeStats, key) - getNumericStat(awayStats, key));
            // statRatios = footballStatMap.map(key => {
            //     let away = getNumericStat(awayStats, key);
            //     return away === 0 ? 1 : getNumericStat(homeStats, key) / away;
            // });
            return footballStatMap.map(key => getNumericStat(homeStats, key))
                .concat(footballStatMap.map(key => getNumericStat(awayStats, key)))
                .concat([isHome])
                .concat([restDays])
                .concat([playoffGameNFL ? 1 : 0])
                .concat([daysSinceSeasonStartNFL])
                .concat([winRateVsOpponent])
                .concat([recentWinRate])
                .concat([recentAvgPointsFor])
                .concat([recentAvgPointsAgainst])
                .concat(statDiffs)
                // .concat(statRatios)
        .concat([hourSin, hourCos])
        .concat([winRateProduct]);
        case 'americanfootball_ncaaf':
            // NCAAF playoff games start in December
            let playoffMonthStartNCAAF = 12; // December
            let playoffGameNCAAF = (gameDate.getMonth() + 1) >= playoffMonthStartNCAAF
            let daysSinceSeasonStartNCAAF = moment(gameDate).diff(moment(`${gameDate.getFullYear()}-09-01`), 'days');
            statDiffs = footballStatMap.map(key => getNumericStat(homeStats, key) - getNumericStat(awayStats, key));
            // statRatios = footballStatMap.map(key => {
            //     let away = getNumericStat(awayStats, key);
            //     return away === 0 ? 1 : getNumericStat(homeStats, key) / away;
            // });
            return footballStatMap.map(key => getNumericStat(homeStats, key))
                .concat(footballStatMap.map(key => getNumericStat(awayStats, key)))
                .concat([isHome])
                .concat([restDays])
                .concat([playoffGameNCAAF ? 1 : 0])
                .concat([daysSinceSeasonStartNCAAF])
                .concat([winRateVsOpponent])
                .concat([recentWinRate])
                .concat([recentAvgPointsFor])
                .concat([recentAvgPointsAgainst])
                .concat(statDiffs)
                // .concat(statRatios)
        .concat([hourSin, hourCos])
        .concat([winRateProduct]);
        case 'icehockey_nhl':
            // NHL playoff games start in April
            let playoffMonthStartNHL = 4; // April
            let playoffGameNHL = (gameDate.getMonth() + 1) >= playoffMonthStartNHL
            let daysSinceSeasonStartNHL = moment(gameDate).diff(moment(`${gameDate.getFullYear()}-10-01`), 'days');
            statDiffs = hockeyStatMap.map(key => getNumericStat(homeStats, key) - getNumericStat(awayStats, key));
            // statRatios = hockeyStatMap.map(key => {
            //     let away = getNumericStat(awayStats, key);
            //     return away === 0 ? 1 : getNumericStat(homeStats, key) / away;
            // });
            return hockeyStatMap.map(key => getNumericStat(homeStats, key))
                .concat(hockeyStatMap.map(key => getNumericStat(awayStats, key)))
                .concat([isHome])
                .concat([restDays])
                .concat([playoffGameNHL ? 1 : 0])
                .concat([daysSinceSeasonStartNHL])
                .concat([winRateVsOpponent])
                .concat([recentWinRate])
                .concat([recentAvgPointsFor])
                .concat([recentAvgPointsAgainst])
                .concat(statDiffs)
                // .concat(statRatios)
        .concat([hourSin, hourCos])
        .concat([winRateProduct]);
        case 'baseball_mlb':
            // MLB playoff games start in October
            let playoffMonthStartMLB = 10; // October
            let playoffGameMLB = (gameDate.getMonth() + 1) >= playoffMonthStartMLB
            let daysSinceSeasonStartMLB = moment(gameDate).diff(moment(`${gameDate.getFullYear()}-04-01`), 'days');
            statDiffs = baseballStatMap.map(key => getNumericStat(homeStats, key) - getNumericStat(awayStats, key));
            // statRatios = baseballStatMap.map(key => {
            //     let away = getNumericStat(awayStats, key);
            //     return away === 0 ? 1 : getNumericStat(homeStats, key) / away;
            // });
            return baseballStatMap.map(key => getNumericStat(homeStats, key))
                .concat(baseballStatMap.map(key => getNumericStat(awayStats, key)))
                .concat([isHome])
                .concat([restDays])
                .concat([playoffGameMLB ? 1 : 0])
                .concat([daysSinceSeasonStartMLB])
                .concat([winRateVsOpponent])
                .concat([recentWinRate])
                .concat([recentAvgPointsFor])
                .concat([recentAvgPointsAgainst])
                .concat(statDiffs)
                // .concat(statRatios)
        .concat([hourSin, hourCos])
        .concat([winRateProduct]);
        case 'basketball_ncaab':
            // NCAAB playoff games start in March
            let playoffMonthStartNCAAB = 3; // March
            let playoffGameNCAAB = (gameDate.getMonth() + 1) >= playoffMonthStartNCAAB
            let daysSinceSeasonStartNCAAB = moment(gameDate).diff(moment(`${gameDate.getFullYear()}-11-01`), 'days');
            statDiffs = basketballStatMap.map(key => getNumericStat(homeStats, key) - getNumericStat(awayStats, key));
            // statRatios = basketballStatMap.map(key => {
            //     let away = getNumericStat(awayStats, key);
            //     return away === 0 ? 1 : getNumericStat(homeStats, key) / away;
            // });
            return basketballStatMap.map(key => getNumericStat(homeStats, key))
                .concat(basketballStatMap.map(key => getNumericStat(awayStats, key)))
                .concat([isHome])
                .concat([restDays])
                .concat([playoffGameNCAAB ? 1 : 0])
                .concat([daysSinceSeasonStartNCAAB])
                .concat([winRateVsOpponent])
                .concat([recentWinRate])
                .concat([recentAvgPointsFor])
                .concat([recentAvgPointsAgainst])
                .concat(statDiffs)
                // .concat(statRatios)
        .concat([hourSin, hourCos])
        .concat([winRateProduct]);
        case 'basketball_wncaab':
            // WNCAAB playoff games start in March
            let playoffMonthStartWNCAAB = 3; // March
            let playoffGameWNCAAB = (gameDate.getMonth() + 1) >= playoffMonthStartWNCAAB
            let daysSinceSeasonStartWNCAAB = moment(gameDate).diff(moment(`${gameDate.getFullYear()}-11-01`), 'days');
            statDiffs = basketballStatMap.map(key => getNumericStat(homeStats, key) - getNumericStat(awayStats, key));
            // statRatios = basketballStatMap.map(key => {
            //     let away = getNumericStat(awayStats, key);
            //     return away === 0 ? 1 : getNumericStat(homeStats, key) / away;
            // });
            return basketballStatMap.map(key => getNumericStat(homeStats, key))
                .concat(basketballStatMap.map(key => getNumericStat(awayStats, key)))
                .concat([isHome])
                .concat([restDays])
                .concat([playoffGameWNCAAB ? 1 : 0])
                .concat([daysSinceSeasonStartWNCAAB])
                .concat([winRateVsOpponent])
                .concat([recentWinRate])
                .concat([recentAvgPointsFor])
                .concat([recentAvgPointsAgainst])
                .concat(statDiffs)
                // .concat(statRatios)
        .concat([hourSin, hourCos])
        .concat([winRateProduct]);
        case 'basketball_nba':
            // NBA playoff games start in April
            let playoffMonthStartNBA = 4; // April
            let playoffGameNBA = (gameDate.getMonth() + 1) >= playoffMonthStartNBA
            let daysSinceSeasonStartNBA = moment(gameDate).diff(moment(`${gameDate.getFullYear()}-10-01`), 'days');
            statDiffs = basketballStatMap.map(key => getNumericStat(homeStats, key) - getNumericStat(awayStats, key));
            // statRatios = basketballStatMap.map(key => {
            //     let away = getNumericStat(awayStats, key);
            //     return away === 0 ? 1 : getNumericStat(homeStats, key) / away;
            // });
            return basketballStatMap.map(key => getNumericStat(homeStats, key))
                .concat(basketballStatMap.map(key => getNumericStat(awayStats, key)))
                .concat([isHome])
                .concat([restDays])
                .concat([playoffGameNBA ? 1 : 0])
                .concat([daysSinceSeasonStartNBA])
                .concat([winRateVsOpponent])
                .concat([recentWinRate])
                .concat([recentAvgPointsFor])
                .concat([recentAvgPointsAgainst])
                .concat(statDiffs)
                // .concat(statRatios)
        .concat([hourSin, hourCos])
        .concat([winRateProduct]);
        default:
            // If sport is not recognized, return empty feature vector
            return [];
    }
}



/**
 * Returns the hyperparameters for the model, either from the search object (for hyperparameter search)
 * or from the saved sport object. Handles both with and without dropout regularization.
 * @param {Object} sport - The sport config object (may contain hyperParameters or hyperParams.* fields)
 * @param {boolean} search - If true, use sport.hyperParameters; else use sport['hyperParams.*']
 * @returns {Object} - Hyperparameter set for model training
 */
const getHyperParams = (sport, search) => {
    const useDropoutReg = false
    if (useDropoutReg) {
        // If using dropout regularization, include dropoutReg in returned params
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
    // Default: no dropout regularization
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


/**
 * Runs the model prediction multiple times (numPasses) on the same input tensor,
 * collects all predictions, and returns the average prediction.
 * This is useful for models with stochastic layers (e.g., dropout at inference).
 * @param {tf.LayersModel} model - Trained TensorFlow.js model
 * @param {tf.Tensor} inputTensor - Input tensor for prediction (shape: [1, features])
 * @param {number} numPasses - Number of times to repeat prediction
 * @returns {Promise<Array>} - Averaged prediction (array of predicted values)
 */
const repeatPredictions = async (model, inputTensor, numPasses) => {
    const predictions = [];
    const winProbs = []

    for (let i = 0; i < numPasses; i++) {
        // Run prediction and collect result
        const predictedScores = model.predict(inputTensor);
        let score = predictedScores.arraySync()
        predictions.push(score[0]);
    }
    // Average over all passes (element-wise mean)
    const averagedScore = predictions[0].map((_, i) =>
        predictions.reduce((sum, run) => sum + run[i], 0) / numPasses
    );
    return [averagedScore];
};

/**
 * Loads a model from disk if it exists (and not in search mode), or creates a new model
 * with the architecture defined for the given sport and input shape.
 * @param {Array} xs - Training data (used for input shape)
 * @param {Object} sport - Sport config object (contains hyperparameters)
 * @param {boolean} search - If true, always create a new model (do not load from disk)
 * @returns {Promise<tf.LayersModel>} - The loaded or newly created model
 */
const loadOrCreateModel = async (xs, sport, search) => {
    const modelPath = `./model_checkpoint/${sport.name}_model/model.json`;
    try {
        // if (fs.existsSync(modelPath) && !search) {
        //     return await tf.loadLayersModel(`file://${modelPath}`);
        // } else {
        const hyperParams = getHyperParams(sport, search);
        const l2Strength = hyperParams.l2reg || 0; // Default L2 regularization strength
        const initializer = tf.initializers.randomNormal({ seed: 122021 });
        // const useBatchNorm = (sport.name === 'basketball_ncaab');
        // const useDropoutEveryOther = (sport.name === 'basketball_nba' || sport.name === 'icehockey_nhl');

        // Input layer
        const input = tf.input({ shape: [xs[0].length] });

        // Feature gating layer (learns to weight/ignore input features)
        const featureGate = tf.layers.dense({
            units: xs[0].length,
            activation: 'sigmoid'
        }).apply(input);

        // Element-wise multiply input by feature gate
        const gatedInput = tf.layers.multiply().apply([input, featureGate]);

        let shared = gatedInput;

        // Hidden layers with optional residual connections
        for (let i = 0; i < hyperParams.hiddenLayerNum; i++) {
            let dense = tf.layers.dense({
                units: hyperParams.layerNeurons,
                useBias: true,
                activation: null, // Activation will be applied separately
                // kernelInitializer: initializer, // optional
            }).apply(shared);

            // if (useBatchNorm) {
            //     dense = tf.layers.batchNormalization().apply(dense);
            //     dense = tf.layers.leakyReLU({ alpha: 0.3 }).apply(dense); // or ReLU if preferred
            // }

            dense = tf.layers.reLU().apply(dense);

            // if (useDropoutEveryOther && i % 2 === 0) {
            //     dense = tf.layers.dropout({ rate: hyperParams.dropoutReg * 2 }).apply(dense);
            // }

            // Add residual connection every 2 layers (skip connection)
            if (i > 0 && i % 2 === 0) {
                shared = tf.layers.add().apply([shared, dense]); // residual connection
            } else {
                shared = dense;
            }
        }

        // Output layer: regression head for score prediction
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

/**
 * Trains the model on the provided game data for a given sport.
 * Handles feature extraction, normalization, label creation, and model fitting.
 * Returns the trained model, updated game count, and team stats history.
 * @param {Array} gameData - Array of game objects to train on
 * @param {Object} sport - Sport config object
 * @param {boolean} search - If true, use hyperparameter search mode
 * @param {number} gameCount - Running count of games processed
 * @param {Array} allPastGames - All past games (for normalization)
 * @param {boolean} final - If true, show progress bar
 * @returns {Promise<{model: tf.LayersModel, updatedGameCount: number, teamStatsHistory: Object}>}
 */
const mlModelTraining = async (gameData, sport, search, gameCount, allPastGames, final) => {
    const statMap = statConfigMap[sport.espnSport].default;
    let hyperParams = await getHyperParams(sport, search)

    xs = []
    ysWins = []
    ysScore = []
    let teamStatsHistory = {};
    // Step 1: Flatten all scores into one array for normalization
    let allScores = allPastGames.flatMap(game => [game.homeScore, game.awayScore]);

    // Step 2: Compute mean of all scores
    let scoreMean = allScores.reduce((acc, score) => acc + score, 0) / allScores.length;

    // Step 3: Compute standard deviation of all scores
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

        // Normalize stats for both teams using Z-score normalization
        const normalizedHome = getZScoreNormalizedStats(homeStats, teamStatsHistory, game.homeTeam, false, search, sport);
        const normalizedAway = getZScoreNormalizedStats(awayStats, teamStatsHistory, game.awayTeam, false, search, sport);

        if (!normalizedHome || !normalizedAway) {
            console.log(game.id);
            continue;
        }

        // Extract features for home team and create label (normalized home score)
        const homeStatFeatures = await extractSportFeatures(normalizedHome, normalizedAway, sport, game, sortedGameData, true);
        const homeScoreLabel = ((game.homeScore - scoreMean) / scoreStdDev);

        xs.push(homeStatFeatures);
        ysScore.push(homeScoreLabel);

        // Extract features for away team and create label (normalized away score)
        const awayStatFeatures = await extractSportFeatures(normalizedAway, normalizedHome, sport, game, sortedGameData, false);
        const awayScoreLabel = ((game.awayScore - scoreMean) / scoreStdDev);

        xs.push(awayStatFeatures);
        ysScore.push(awayScoreLabel);

        // Update rolling team stats history for normalization
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
    // Check for feature leakage (features too correlated with target)
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

    // Compile model with Adam optimizer and mean squared error loss
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

    // Train model with early stopping on validation loss
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

/**
 * Runs predictions for a set of games using a trained model, computes metrics, and updates DB if needed.
 * @param {Array} sportOdds - Array of games to predict on.
 * @param {*} ff - (Unused, legacy param)
 * @param {*} model - Trained TensorFlow.js model.
 * @param {*} sport - Sport config object.
 * @param {boolean} past - If true, evaluates on past games (for metrics).
 * @param {boolean} search - If true, running in hyperparameter search mode.
 * @param {Object} teamHistory - Map of teamId -> stat history arrays.
 * @param {Array} pastGames - All past games for normalization.
 * @returns {Object|undefined} - Metrics if search, otherwise undefined.
 */
const predictions = async (sportOdds, ff, model, sport, past, search, teamHistory, pastGames) => {
    console.info(`STARTING PREDICTIONS FOR ${sport.name} @ ${moment().format('HH:mm:ss')}`);

    // Filter for games with a predicted winner if evaluating on past data
    if (past) {
        sportOdds = sportOdds.filter(game =>
            game.predictedWinner === 'home' || game.predictedWinner === 'away'
        );
    }

    // Calculate home/away split for calibration
    let sportOddsHomeAwaySplit = sportOdds.filter(g => g.winner === 'home').length / sportOdds.length;

    // Metrics and counters
    let minScorePredicted = Infinity, maxScorePredicted = -Infinity;
    let minScoreReal = Infinity, maxScoreReal = -Infinity;
    let predictionsChanged = 0, newWinnerPredictions = 0, newLoserPredictions = 0;
    let totalWins = 0, totalLosses = 0, newConfidencePredictions = 0;
    let highConfGames = 0, highConfLosers = 0;
    let fiftyfiftyMatchups = 0, sixtyToSeventyMatchups = 0, seventyToEightyMatchups = 0, eightyToNinetyMatchups = 0;
    let matchedScore = 0, spreadMatch = 0, totalMatch = 0, tieGames = 0, home = 0, away = 0;

    // Confidence buckets for calibration analysis
    let confidenceBuckets;
    if (['americanfootball_nfl', 'basketball_nba', 'icehockey_nhl'].includes(sport.name)) {
        confidenceBuckets = [
            { range: [0.5, 0.6], total: 0, correct: 0 },
            { range: [0.6, 0.7], total: 0, correct: 0 },
            { range: [0.7, 0.8], total: 0, correct: 0 },
            { range: [0.8, 0.9], total: 0, correct: 0 },
            { range: [0.9, 1], total: 0, correct: 0 },
        ];
    } else {
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

    // Use provided team stats history
    const teamStatsHistory = teamHistory;

    // Compute normalization stats from all past games
    let allScores = pastGames.flatMap(game => [game.homeScore, game.awayScore]);
    let testScoreMean = allScores.reduce((acc, score) => acc + score, 0) / allScores.length;
    let testScoreStdDev = Math.sqrt(
        allScores.reduce((acc, score) => acc + Math.pow(score - testScoreMean, 2), 0) / allScores.length
    );
    let sortedPastGames = pastGames.sort((a, b) => new Date(b.commence_time) - new Date(a.commence_time));

    // Main prediction loop
    for (const game of sportOdds) {
        // If not search, skip games in the past (for live predictions)
        if (new Date(game.commence_time) < new Date() && !search) continue;

        // Get normalized stats for both teams
        const homeRawStats = game['homeStats.data'];
        const awayRawStats = game['awayStats.data'];
        const normalizedHome = getZScoreNormalizedStats(homeRawStats, teamStatsHistory, game.homeTeam, false, search, sport);
        const normalizedAway = getZScoreNormalizedStats(awayRawStats, teamStatsHistory, game.awayTeam, false, search, sport);

        if (!normalizedHome || !normalizedAway) {
            console.log(game.id);
            return;
        }

        // Extract features and run model predictions
        const homeStatFeatures = await extractSportFeatures(normalizedHome, normalizedAway, sport, game, sortedPastGames, true);
        const awayStatFeatures = await extractSportFeatures(normalizedAway, normalizedHome, sport, game, sortedPastGames, false);

        const homeInputTensor = tf.tensor2d([homeStatFeatures]);
        const awayInputTensor = tf.tensor2d([awayStatFeatures]);
        const homePredictions = await repeatPredictions(model, homeInputTensor, 10);
        const awayPredictions = await repeatPredictions(model, awayInputTensor, 10);
        homeInputTensor.dispose();
        awayInputTensor.dispose();

        // De-normalize predicted scores
        let homeScore = (homePredictions[0] * testScoreStdDev) + testScoreMean;
        let awayScore = (awayPredictions[0] * testScoreStdDev) + testScoreMean;
        if (homeScore < 0) homeScore = 0;
        if (awayScore < 0) awayScore = 0;

        // Compute prediction confidence (sigmoid of score diff)
        let predictionConfidence = 1 / (1 + Math.exp(-Math.abs(homeScore - awayScore)));

        // Avoid ties by nudging the score
        if (Math.round(homeScore) === Math.round(awayScore)) {
            tieGames++;
            let homeWinProb = 1 / (1 + Math.exp(-Math.abs(homeScore - awayScore)));
            let awayWinProb = 1 / (1 + Math.exp(-Math.abs(awayScore - homeScore)));
            if (['americanfootball_nfl', 'americanfootball_ncaaf'].includes(sport.name)) {
                homeWinProb > awayWinProb ? homeScore += 7 : awayScore += 7;
            } else {
                homeWinProb > awayWinProb ? homeScore++ : awayScore++;
            }
        }

        // Determine predicted winner
        let predictedWinner = homeScore > awayScore ? 'home' : 'away';
        if (predictedWinner === 'home') home++;
        else away++;

        // Prepare update payload for DB
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
                console.log(`Prediction changed for game ${game.id}: ${predictedWinner === 'home' ? 'HOME' : 'AWAY'} ${oldWinner} → ${newWinner}  (Confidence: ${predictionConfidence}) Score ([home, away]) [${Math.round(homeScore)}, ${Math.round(awayScore)}]`);
            }
        }
        if (game.predictionConfidence !== predictionConfidence) {
            newConfidencePredictions++;
        }

        // Confidence distribution counters
        if (predictionConfidence > 0.9) highConfGames++;
        else if (predictionConfidence < 0.6) fiftyfiftyMatchups++;
        else if (predictionConfidence < 0.7) sixtyToSeventyMatchups++;
        else if (predictionConfidence < 0.8) seventyToEightyMatchups++;
        else if (predictionConfidence < 0.9) eightyToNinetyMatchups++;

        // If evaluating on past data, compute accuracy and calibration metrics
        if (past || search) {
            updatePayload.predictionCorrect = predictedWinner === game.winner;
            const predictionChanged = predictedWinner !== game.predictedWinner;
            const wasCorrect = predictedWinner === game.winner;
            if (wasCorrect) totalWins++;
            else totalLosses++;
            if (predictionChanged && wasCorrect) newWinnerPredictions++;
            if (predictionChanged && !wasCorrect) newLoserPredictions++;
            if (predictionConfidence > 0.9 && !wasCorrect) highConfLosers++;
            if (Math.round(homeScore) === game.homeScore || Math.round(awayScore) === game.awayScore) matchedScore++;
            if (Math.abs(homeScore - awayScore) === Math.abs(game.homeScore - game.awayScore)) spreadMatch++;
            if ((homeScore + awayScore) === (game.homeScore + game.awayScore)) totalMatch++;
            if (homeScore > maxScorePredicted) maxScorePredicted = Math.round(homeScore);
            if (awayScore > maxScorePredicted) maxScorePredicted = Math.round(awayScore);
            if (homeScore < minScorePredicted) minScorePredicted = Math.round(homeScore);
            if (awayScore < minScorePredicted) minScorePredicted = Math.round(awayScore);
            if (game.homeScore > maxScoreReal) maxScoreReal = Math.round(game.homeScore);
            if (game.awayScore > maxScoreReal) maxScoreReal = Math.round(game.awayScore);
            if (game.homeScore < minScoreReal) minScoreReal = Math.round(game.homeScore);
            if (game.awayScore < minScoreReal) minScoreReal = Math.round(game.awayScore);
        }

        // Update DB with predictions if not in search/past mode
        if (!past && !search) {
            await db.Games.update(updatePayload, { where: { id: game.id } });
        }

        // Fill confidence buckets for calibration analysis
        if (past || search) {
            for (let i = 0; i < confidenceBuckets.length; i++) {
                const bucket = confidenceBuckets[i];
                const [low, high] = bucket.range;
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

    // Output summary if evaluating on past data
    if (past || search) {
        console.log(`PREDICTION SCORE RANGE: [${minScorePredicted} - ${maxScorePredicted}] REAL SCORE RANGE: [${minScoreReal} - ${maxScoreReal}]`);
        console.log(`OUT OF ${sportOdds.length} GAMES [TOTAL WINS: ${totalWins}, TOTAL LOSSES: ${totalLosses}]: MATCHED SPREADS: ${spreadMatch} MATCHED SCORES: ${matchedScore} TIE GAMES: ${tieGames} HOME: ${home} AWAY: ${away}`);
    }

    // Calibration score calculation
    let bucketCalibrationPenalty = 0, bucketCount = 0;
    for (const bucket of confidenceBuckets) {
        if (bucket.total === 0) continue;
        const empiricalAccuracy = bucket.correct / bucket.total;
        const idealConfidence = bucket.range[1];
        const weight = idealConfidence;
        const error = weight * Math.abs(empiricalAccuracy - idealConfidence);
        bucketCalibrationPenalty += error;
        bucketCount++;
    }
    const scoreRangeMAE = (Math.abs(minScoreReal - minScorePredicted) + Math.abs(maxScoreReal - maxScorePredicted)) / 2;
    const avgBucketCalibrationError = bucketCount > 0 ? bucketCalibrationPenalty / bucketCount : 0;
    const calibrationScore = 1 - avgBucketCalibrationError; // closer to 1 is better

    // Print calibration bucket stats
    for (const bucket of confidenceBuckets) {
        if (bucket.total === 0) continue;
        const acc = (bucket.correct / bucket.total * 100).toFixed(1);
        console.log(`Confidence ${Math.round(bucket.range[0] * 100)}–${Math.round(bucket.range[1] * 100)}%: Accuracy ${acc}% (${bucket.correct}/${bucket.total})`);
    }

    // If in search mode, return metrics for hyperparameter optimization
    if (search) {
        const winRate = (totalWins / sportOdds.length) * 100;
        let predictedHomeAwaySplit = home / sportOdds.length;
        const splitMatchScore = Math.pow(1 - Math.abs(predictedHomeAwaySplit - sportOddsHomeAwaySplit) * 2, 2);
        return {
            winRate,
            calibrationScore,
            splitMatchScore,
            scoreRangeMAE
        };
    }
};

/**
 * Trains and evaluates a model for a given sport using k-fold cross-validation.
 * Optionally performs a final training run and saves the model and feature importances.
 * Also supports hyperparameter search mode, returning a composite score for optimization.
 *
 * @param {Object} sport - The sport configuration object (contains hyperparameters, stat maps, etc.)
 * @param {Array} gameData - Array of all historical game objects for the sport
 * @param {boolean} search - If true, run in hyperparameter search mode (no model saving, returns score)
 * @returns {Promise<tf.LayersModel|number>} - The trained model (if not search), or composite score (if search)
 */
const trainSportModelKFold = async (sport, gameData, search) => {

    // Retrieve hyperparameters for this sport and search mode
    let hyperParams = await getHyperParams(sport, search)

    console.log(hyperParams)
    // Sort historical game data and slice off the most recent 10% (or 30% if small dataset) for final testing
    const sortedGameData = gameData
        .slice(0, gameData.length - (gameData.length > 3000 ? Math.floor(gameData.length * 0.10) : Math.floor(gameData.length * .30)));

    // Print the date range of the training data
    console.log(`${sortedGameData[0].commence_time.toLocaleString()} - ${sortedGameData[sortedGameData.length - 1].commence_time.toLocaleString()}`);

    const numFolds = hyperParams.kFolds;
    const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    const totalFolds = numFolds;

    let gameCount = 0;
    let foldResults = [];
    let finalModel;
    let progress = 0;

    bar.start(totalFolds, 0);

    // Sort all games by most recent first for normalization/stat history
    let sortedPastGames = gameData.sort((a, b) => new Date(b.commence_time) - new Date(a.commence_time));

    // Step 1: Flatten all scores into one array for normalization
    let allScores = gameData.flatMap(game => [game.homeScore, game.awayScore]);

    // Step 2: Compute mean of all scores
    let testScoreMean = allScores.reduce((acc, score) => acc + score, 0) / allScores.length;

    // Step 3: Compute standard deviation of all scores
    let testScoreStdDev = Math.sqrt(
        allScores.reduce((acc, score) => acc + Math.pow(score - testScoreMean, 2), 0) / allScores.length
    );

    // --- K-Fold Cross-Validation Loop ---
    for (let foldIndex = 1; foldIndex <= numFolds; foldIndex++) {
        // Define training and validation split for this fold
        // Each fold uses a contiguous block of games for validation, the rest for training
        const trainEnd = Math.floor((foldIndex / (numFolds + 1)) * sortedGameData.length);
        const valStart = trainEnd;
        const valEnd = foldIndex === numFolds
            ? sortedGameData.length
            : Math.floor(((foldIndex + 1) / (numFolds + 1)) * sortedGameData.length);

        const trainingData = sortedGameData.slice(0, trainEnd);
        const testData = sortedGameData.slice(valStart, valEnd);

        // Train model on trainingData, get updated team stats history
        const { model, updatedGameCount, teamStatsHistory } = await mlModelTraining(
            trainingData, sport, search, gameCount, sortedPastGames
        );

        finalModel = model;
        gameCount = updatedGameCount;

        // Arrays to hold test features, labels, and predictions for this fold
        const testXs = [];
        const testYsScore = [];

        const scorePredictionsArray = [];
        const spreadErrors = [];
        const totalErrors = [];
        // Sort games by date ascending for feature extraction
        let sortedGamesForFeatures = gameData.sort((a, b) => new Date(a.commence_time) - new Date(b.commence_time))
        for (const game of testData) {
            const homeStats = game['homeStats.data'];
            const awayStats = game['awayStats.data'];
            // Normalize stats for both teams using rolling team stats history
            const normalizedHome = getZScoreNormalizedStats(homeStats, teamStatsHistory, game.homeTeam, false, search, sport);
            const normalizedAway = getZScoreNormalizedStats(awayStats, teamStatsHistory, game.awayTeam, false, search, sport);

            // If missing stats, skip this game
            if (!homeStats || !awayStats) {
                console.log(game.id);
                return;
            }
            // Extract features for home and away teams
            const homeStatFeatures = await extractSportFeatures(normalizedHome, normalizedAway, sport, game, sortedGamesForFeatures, true)
            const homeScoreLabel = ((game.homeScore - testScoreMean) / testScoreStdDev);

            testXs.push(homeStatFeatures);
            testYsScore.push(homeScoreLabel);

            const awayStatFeatures = await extractSportFeatures(normalizedAway, normalizedHome, sport, game, sortedGamesForFeatures, false)
            const awayScoreLabel = ((game.awayScore - testScoreMean) / testScoreStdDev);

            testXs.push(awayStatFeatures);
            testYsScore.push(awayScoreLabel);

            // Check for NaN in features (should not happen)
            if (awayStatFeatures.some(isNaN) || homeStatFeatures.some(isNaN)) {
                console.error('NaN detected in features during kFoldTest:', game.id);
                console.log(game.awayTeam, game.homeTeam);
                console.log(teamStatsHistory[game.homeTeam].length, teamStatsHistory[game.awayTeam].length);
                process.exit(0);
            }

            // Run model predictions for both teams (with dropout averaging)
            const homeTeamInput = tf.tensor2d([homeStatFeatures]);
            const awayTeamInput = tf.tensor2d([awayStatFeatures]);
            const homeScorePred = await repeatPredictions(model, homeTeamInput, 10);
            const awayScorePred = await repeatPredictions(model, awayTeamInput, 10);
            homeTeamInput.dispose();
            awayTeamInput.dispose();

            const [actualHome, actualAway] = [game.homeScore, game.awayScore];

            // De-normalize predictions to original score scale
            let [predHome, predAway] = [
                (homeScorePred[0] * testScoreStdDev) + testScoreMean,
                (awayScorePred[0] * testScoreStdDev) + testScoreMean
            ]
            // Compute spread and total errors for this game
            const predSpread = predHome - predAway;
            const actualSpread = actualHome - actualAway;
            spreadErrors.push(Math.abs(predSpread - actualSpread));

            const predTotal = predHome + predAway;
            const actualTotal = actualHome + actualAway;
            totalErrors.push(Math.abs(predTotal - actualTotal));

            // Store normalized predictions for MAE calculation
            scorePredictionsArray.push(homeScorePred[0]);
            scorePredictionsArray.push(awayScorePred[0]);

            gameCount++;
        }

        // Evaluate fold using MAE and other metrics
        const foldMetrics = evaluateFoldMetrics(
            testXs,
            testYsScore,
            scorePredictionsArray,
        );

        // Compute average spread and total MAE for this fold
        const avgSpreadMAE = spreadErrors.reduce((a, b) => a + b, 0) / spreadErrors.length;
        const avgTotalMAE = totalErrors.reduce((a, b) => a + b, 0) / totalErrors.length;

        // Store results for this fold
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

    // Aggregate results across all folds
    const { avgSpreadMAE, avgTotalMAE, avgMAE, totalCounts } = printOverallMetrics(foldResults);

    // De-normalize MAE to original score scale
    let deNormalizedMAE = avgMAE * testScoreStdDev;

    console.log(`--- Overall Performance Avg MAE: ${deNormalizedMAE.toFixed(2)} ---`);

    // Save MAE metrics to DB if not in search mode
    if (!search) await db.HyperParams.update({
        scoreMAE: deNormalizedMAE,
        totalMAE: avgTotalMAE,
        spreadMAE: avgSpreadMAE
    }, {
        where: {
            sport: sport.id
        }
    })

    // --- Hyperparameter Search Mode ---
    if (search) {
        // If model only predicted one class, return 0 score (bad model)
        if (Object.values(totalCounts).some(count => count === 0)) {
            console.log(`--- WARNING: MODEL ONLY PREDICTED ONE CLASS ---`)
            console.log(`--- FINAL HYPERPARAM SCORE: 0 ---`);
            return 0;

        };
        // After k-folds, train on all training data and evaluate on held-out test set
        const fullTrainingData = sortedGameData;
        const { model: finalModel } = await mlModelTraining(
            fullTrainingData, sport, search, gameCount, sortedPastGames
        );

        // Get held-out test set (most recent 10% or 30%)
        const testSlice = gameData
            .sort((a, b) => new Date(a.commence_time) - new Date(b.commence_time))
            .slice(gameData.length - (gameData.length > 3000 ? Math.floor(gameData.length * 0.10) : Math.floor(gameData.length * .30)));

        // Build up team stats history for normalization
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

        // Run predictions on held-out test set and get metrics
        const { winRate,
            calibrationScore,
            splitMatchScore,
            scoreRangeMAE } = await predictions(testSlice, [], finalModel, sport, false, search, teamStatsHistory, gameData);
        console.log(`--- Overall WINRATE ON UNSEEN DATA: ${(winRate).toFixed(2)} ---`);

        // Composite score for hyperparameter optimization (higher is better)
        const compositeScore =
            (winRate * .1) +                 // Strong positive effect
            (calibrationScore * 100) +         // 0.0–1.0 → 0–100
            (splitMatchScore * 25) +          // 0.0–1.0 → 0–25
            (-(scoreRangeMAE) * 3) +        // Moderate penalty (can be high)
            (-(avgSpreadMAE) * 1.5) +            // Lower penalty
            (-(avgTotalMAE) * 1.5) +             // Lower penalty
            (-(avgMAE) * 2.0);                // Slightly stronger penalty (since it's often lower range)

        // Print breakdown of score sources for debugging
        console.log(`BREAKDOWN OF SCORE SOURCES:`);
        console.log(`  - WinRate: ${(winRate).toFixed(2)}`);
        console.log(`  - Calibration Score: ${(calibrationScore).toFixed(2)}`);
        console.log(`  - SplitMatchScore: ${(splitMatchScore).toFixed(2)}`);
        console.log(`  - ScoreRangeMAE: ${(scoreRangeMAE).toFixed(2)}`);
        console.log(`  - Spread MAE: ${(avgSpreadMAE).toFixed(2)}`);
        console.log(`  - Total MAE: ${(avgTotalMAE).toFixed(2)}`);
        console.log(`  - Avg MAE: ${(avgMAE).toFixed(2)}`);
        console.log(`-----------BREAKDOWN OF FINAL SCORE:--------------------`);
        console.log(`  - WinRate: ${(winRate * .1).toFixed(2)}`);
        console.log(`  + Calibration Score: ${(calibrationScore * 100).toFixed(2)}`);
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

    // --- Final Training and Model Saving (not in search mode) ---
    // Train on all available data
    const fullTrainingData = gameData
        .sort((a, b) => new Date(a.commence_time) - new Date(b.commence_time)); // All

    const { model } = await mlModelTraining(
        fullTrainingData, sport, search, gameCount, sortedGameData, true
    );

    finalModel = model;

    // Save trained model to disk
    if (!search) {
        const modelDir = `./model_checkpoint/${sport.name}_model`;
        if (!fs.existsSync(modelDir)) {
            console.log('Creating model directory...');
            fs.mkdirSync(modelDir, { recursive: true });
        }
        await finalModel.save(`file://${modelDir}`);
    }

    // Extract and save feature importances for UI/analysis
    await extractAndSaveFeatureImportances(finalModel, sport);

    // Run garbage collection if available (to free up memory)
    if (global.gc) global.gc();

    console.log(`ml model done for ${sport.name} @ ${moment().format('HH:mm:ss')}`);
    return finalModel;
};

module.exports = { normalizeStat, extractSportFeatures, mlModelTraining, predictions, trainSportModelKFold, loadOrCreateModel, isValidStatBlock }