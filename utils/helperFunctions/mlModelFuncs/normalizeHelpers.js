

// Helper: Normalize "W-L" string to wins (or keep numeric values)
const normalizeWinLoss = (value) => {
    if (typeof value === 'string') {
        const [wins] = value.split('-').map(Number);
        return wins;
    }
    return value !== undefined ? value : 0;
};

// Helper: Apply normalization (z-score) to a stat object using provided means/stds
const applyNormalization = (stats, means, stds) => {
    const result = {};
    for (const key of Object.keys(stats)) {
        result[key] = (stats[key] - means[key]) / stds[key];
    }
    return result;
};

// Helper: Transform win-loss strings in current stats
const transformStats = (stats) => {
    const cloned = { ...stats };
    ['seasonWinLoss', 'homeWinLoss', 'awayWinLoss'].forEach(key => {
        cloned[key] = normalizeWinLoss(cloned[key]);
    });
    return cloned;
};

const getZScoreNormalizedStats = (currentStats, teamStatsHistory, teamId, prediction, search, sport) => {
    const history = (teamStatsHistory && teamStatsHistory[teamId]) || [];
    const minGamesPerTeam = 3;
    const transformedStats = transformStats(currentStats);

    // Determine teams with enough data
    const teamsWithEnoughData = Object.values(teamStatsHistory)
        .filter(teamHistory => teamHistory && teamHistory.length >= minGamesPerTeam);

    // Case 1: Not enough teams with data → return raw stats
    if (teamsWithEnoughData.length < 5 ) {
        return { ...currentStats };
    }
    // Case 2: Some teams have data, but this one doesn't → use global normalization
    if (teamsWithEnoughData.length < 32 && history.length < minGamesPerTeam) {
        const allStats = Object.values(teamStatsHistory)
            .filter(Boolean)
            .flat();

        const keys = Object.keys(transformedStats);
        const means = {};
        const stds = {};

        for (const key of keys) {
            const values = allStats.map(stat => normalizeWinLoss(stat[key]));
            const mean = values.reduce((sum, val) => sum + val, 0) / values.length;

            const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
            means[key] = mean;
            stds[key] = Math.sqrt(variance) || 1; // Avoid divide-by-zero
        }

        return applyNormalization(transformedStats, means, stds);
    }

    // Case 3: Team has enough data → use decayed normalization on team history
    const keys = Object.keys(transformedStats);
    const means = {};
    const stds = {};

    const baseDecay = search
        ? sport.hyperParameters.gameDecayValue
        : sport['hyperParams.decayFactor'];

    const stepSize = search
        ? sport.hyperParameters.decayStepSize
        : sport['hyperParams.gameDecayThreshold'];

    for (const key of keys) {
        const decayedValues = [];
        const weights = [];

        for (let i = 0; i < history.length; i++) {
            const rawValue = normalizeWinLoss(history[i][key]);
            const stepsFromLatest = history.length - 1 - i;
            const weight = Math.pow(baseDecay, stepsFromLatest / stepSize);

            decayedValues.push(prediction ? rawValue : rawValue * weight);
            weights.push(weight);
        }

        const totalWeight = weights.reduce((a, b) => a + b, 0);
        const mean = decayedValues.reduce((sum, val) => sum + val, 0) / totalWeight;

        const variance = decayedValues.reduce((sum, val, i) => {
            return sum + weights[i] * Math.pow(val - mean, 2);
        }, 0) / totalWeight;

        means[key] = mean;
        stds[key] = Math.sqrt(variance) || 1;
    }
    return applyNormalization(transformedStats, means, stds);
};
module.exports = {
    getZScoreNormalizedStats,
    normalizeWinLoss
};