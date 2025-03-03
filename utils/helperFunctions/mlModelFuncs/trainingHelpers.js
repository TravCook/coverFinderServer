const { Odds, PastGameOdds } = require('../../../models');
const statsMinMax = require('../../seeds/sampledGlobalStats.json')
const { checkNaNValues } = require('../dataHelpers/dataSanitizers')
const fs = require('fs')
const tf = require('@tensorflow/tfjs-node');
const {learningRate, batchSize, epochsValue, weightDecayl2, dropoutRate, layerNeurons} = require('../../constants')
const { handleSportWeights, indexAdjuster } = require('./indexHelpers')

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
const normalizeStat = (statName, value) => {
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
// Feature extraction per sport
const extractSportFeatures = (homeStats, awayStats, league) => {
    switch (league) {
        case 'americanfootball_nfl':
            return [
                normalizeStat('seasonWinLoss', getWinLoss(homeStats) - getWinLoss(awayStats)),
                normalizeStat('homeWinLoss', getHomeAwayWinLoss(homeStats, 'homeWinLoss') - getHomeAwayWinLoss(awayStats, 'awayWinLoss')),
                normalizeStat('pointDiff', getStat(homeStats, 'pointDiff') - getStat(awayStats, 'pointDiff')),
                normalizeStat('USFBpointsPerGame', getStat(homeStats, 'USFBpointsPerGame') - getStat(awayStats, 'USFBpointsPerGame')),
                normalizeStat('USFBtotalPoints', getStat(homeStats, 'USFBtotalPoints') - getStat(awayStats, 'USFBtotalPoints')),
                normalizeStat('USFBtotalTouchdowns', getStat(homeStats, 'USFBtotalTouchdowns') - getStat(awayStats, 'USFBtotalTouchdowns')),
                normalizeStat('USFBtouchdownsPerGame', getStat(homeStats, 'USFBtouchdownsPerGame') - getStat(awayStats, 'USFBtouchdownsPerGame')),
                normalizeStat('USFBcompletionPercent', getStat(homeStats, 'USFBcompletionPercent') - getStat(awayStats, 'USFBcompletionPercent')),
                normalizeStat('USFBcompletions', getStat(homeStats, 'USFBcompletions') - getStat(awayStats, 'USFBcompletions')),
                normalizeStat('USFBcompletionsPerGame', getStat(homeStats, 'USFBcompletionsPerGame') - getStat(awayStats, 'USFBcompletionsPerGame')),
                normalizeStat('USFBnetPassingYards', getStat(homeStats, 'USFBnetPassingYards') - getStat(awayStats, 'USFBnetPassingYards')),
                normalizeStat('USFBnetPassingYardsPerGame', getStat(homeStats, 'USFBnetPassingYardsPerGame') - getStat(awayStats, 'USFBnetPassingYardsPerGame')),
                normalizeStat('USFBpassingFirstDowns', getStat(homeStats, 'USFBpassingFirstDowns') - getStat(awayStats, 'USFBpassingFirstDowns')),
                normalizeStat('USFBpassingYards', getStat(homeStats, 'USFBpassingYards') - getStat(awayStats, 'USFBpassingYards')),
                normalizeStat('USFBpassingYardsPerGame', getStat(homeStats, 'USFBpassingYardsPerGame') - getStat(awayStats, 'USFBpassingYardsPerGame')),
                normalizeStat('USFBpassingAttempts', getStat(homeStats, 'USFBpassingAttempts') - getStat(awayStats, 'USFBpassingAttempts')),
                normalizeStat('USFBpassingAttemptsPerGame', getStat(homeStats, 'USFBpassingAttemptsPerGame') - getStat(awayStats, 'USFBpassingAttemptsPerGame')),
                normalizeStat('USFByardsPerPassAttempt', getStat(homeStats, 'USFByardsPerPassAttempt') - getStat(awayStats, 'USFByardsPerPassAttempt')),
                normalizeStat('USFBrushingAttempts', getStat(homeStats, 'USFBrushingAttempts') - getStat(awayStats, 'USFBrushingAttempts')),
                normalizeStat('USFBrushingFirstDowns', getStat(homeStats, 'USFBrushingFirstDowns') - getStat(awayStats, 'USFBrushingFirstDowns')),
                normalizeStat('USFBrushingTouchdowns', getStat(homeStats, 'USFBrushingTouchdowns') - getStat(awayStats, 'USFBrushingTouchdowns')),
                normalizeStat('USFBrushingYards', getStat(homeStats, 'USFBrushingYards') - getStat(awayStats, 'USFBrushingYards')),
                normalizeStat('USFBrushingYardsPerGame', getStat(homeStats, 'USFBrushingYardsPerGame') - getStat(awayStats, 'USFBrushingYardsPerGame')),
                normalizeStat('USFByardsPerRushAttempt', getStat(homeStats, 'USFByardsPerRushAttempt') - getStat(awayStats, 'USFByardsPerRushAttempt')),
                normalizeStat('USFBreceivingFirstDowns', getStat(homeStats, 'USFBreceivingFirstDowns') - getStat(awayStats, 'USFBreceivingFirstDowns')),
                normalizeStat('USFBreceivingTouchdowns', getStat(homeStats, 'USFBreceivingTouchdowns') - getStat(awayStats, 'USFBreceivingTouchdowns')),
                normalizeStat('USFBreceivingYards', getStat(homeStats, 'USFBreceivingYards') - getStat(awayStats, 'USFBreceivingYards')),
                normalizeStat('USFBreceivingYardsPerGame', getStat(homeStats, 'USFBreceivingYardsPerGame') - getStat(awayStats, 'USFBreceivingYardsPerGame')),
                normalizeStat('USFBreceivingYardsPerReception', getStat(homeStats, 'USFBreceivingYardsPerReception') - getStat(awayStats, 'USFBreceivingYardsPerReception')),
                normalizeStat('USFBreceivingYardsAfterCatch', getStat(homeStats, 'USFBreceivingYardsAfterCatch') - getStat(awayStats, 'USFBreceivingYardsAfterCatch')),
                normalizeStat('USFBreceivingYardsAfterCatchPerGame', getStat(homeStats, 'USFBreceivingYardsAfterCatchPerGame') - getStat(awayStats, 'USFBreceivingYardsAfterCatchPerGame')),
                normalizeStat('USFBtacklesforLoss', getStat(homeStats, 'USFBtacklesforLoss') - getStat(awayStats, 'USFBtacklesforLoss')),
                normalizeStat('USFBtacklesforLossPerGame', getStat(homeStats, 'USFBtacklesforLossPerGame') - getStat(awayStats, 'USFBtacklesforLossPerGame')),
                normalizeStat('USFBinterceptions', getStat(homeStats, 'USFBinterceptions') - getStat(awayStats, 'USFBinterceptions')),
                normalizeStat('USFByardsPerInterception', getStat(homeStats, 'USFByardsPerInterception') - getStat(awayStats, 'USFByardsPerInterception')),
                normalizeStat('USFBsacksTotal', getStat(homeStats, 'USFBsacksTotal') - getStat(awayStats, 'USFBsacksTotal')),
                normalizeStat('USFBsacksPerGame', getStat(homeStats, 'USFBsacksPerGame') - getStat(awayStats, 'USFBsacksPerGame')),
                normalizeStat('USFBsackYards', getStat(homeStats, 'USFBsackYards') - getStat(awayStats, 'USFBsackYards')),
                normalizeStat('USFBsackYardsPerGame', getStat(homeStats, 'USFBsackYardsPerGame') - getStat(awayStats, 'USFBsackYardsPerGame')),
                normalizeStat('USFBstuffs', getStat(homeStats, 'USFBstuffs') - getStat(awayStats, 'USFBstuffs')),
                normalizeStat('USFBstuffsPerGame', getStat(homeStats, 'USFBstuffsPerGame') - getStat(awayStats, 'USFBstuffsPerGame')),
                normalizeStat('USFBstuffYards', getStat(homeStats, 'USFBstuffYards') - getStat(awayStats, 'USFBstuffYards')),
                normalizeStat('USFBpassesDefended', getStat(homeStats, 'USFBpassesDefended') - getStat(awayStats, 'USFBpassesDefended')),
                normalizeStat('USFBpassesDefendedPerGame', getStat(homeStats, 'USFBpassesDefendedPerGame') - getStat(awayStats, 'USFBpassesDefendedPerGame')),
                normalizeStat('USFBsafties', getStat(homeStats, 'USFBsafties') - getStat(awayStats, 'USFBsafties')),
                normalizeStat('USFBaverageKickoffYards', getStat(homeStats, 'USFBaverageKickoffYards') - getStat(awayStats, 'USFBaverageKickoffYards')),
                normalizeStat('USFBaverageKickoffYardsPerGame', getStat(homeStats, 'USFBaverageKickoffYardsPerGame') - getStat(awayStats, 'USFBaverageKickoffYardsPerGame')),
                normalizeStat('USFBextraPointAttempts', getStat(homeStats, 'USFBextraPointAttempts') - getStat(awayStats, 'USFBextraPointAttempts')),
                normalizeStat('USFBextraPointAttemptsPerGame', getStat(homeStats, 'USFBextraPointAttemptsPerGame') - getStat(awayStats, 'USFBextraPointAttemptsPerGame')),
                normalizeStat('USFBextraPointsMade', getStat(homeStats, 'USFBextraPointsMade') - getStat(awayStats, 'USFBextraPointsMade')),
                normalizeStat('USFBextraPointsMadePerGame', getStat(homeStats, 'USFBextraPointsMadePerGame') - getStat(awayStats, 'USFBextraPointsMadePerGame')),
                normalizeStat('USFBextraPointPercent', getStat(homeStats, 'USFBextraPointPercent') - getStat(awayStats, 'USFBextraPointPercent')),
                normalizeStat('USFBextraPointPercentPerGame', getStat(homeStats, 'USFBextraPointPercentPerGame') - getStat(awayStats, 'USFBextraPointPercentPerGame')),
                normalizeStat('USFBfieldGoalAttempts', getStat(homeStats, 'USFBfieldGoalAttempts') - getStat(awayStats, 'USFBfieldGoalAttempts')),
                normalizeStat('USFBfieldGoalAttemptsPerGame', getStat(homeStats, 'USFBfieldGoalAttemptsPerGame') - getStat(awayStats, 'USFBfieldGoalAttemptsPerGame')),
                normalizeStat('USFBfieldGoalsMade', getStat(homeStats, 'USFBfieldGoalsMade') - getStat(awayStats, 'USFBfieldGoalsMade')),
                normalizeStat('USFBfieldGoalsMadePerGame', getStat(homeStats, 'USFBfieldGoalsMadePerGame') - getStat(awayStats, 'USFBfieldGoalsMadePerGame')),
                normalizeStat('USFBfieldGoalPct', getStat(homeStats, 'USFBfieldGoalPct') - getStat(awayStats, 'USFBfieldGoalPct')),
                normalizeStat('USFBfieldGoalPercentPerGame', getStat(homeStats, 'USFBfieldGoalPercentPerGame') - getStat(awayStats, 'USFBfieldGoalPercentPerGame')),
                normalizeStat('USFBtouchbacks', getStat(homeStats, 'USFBtouchbacks') - getStat(awayStats, 'USFBtouchbacks')),
                normalizeStat('USFBtouchbacksPerGame', getStat(homeStats, 'USFBtouchbacksPerGame') - getStat(awayStats, 'USFBtouchbacksPerGame')),
                normalizeStat('USFBtouchBackPercentage', getStat(homeStats, 'USFBtouchBackPercentage') - getStat(awayStats, 'USFBtouchBackPercentage')),
                normalizeStat('USFBkickReturns', getStat(homeStats, 'USFBkickReturns') - getStat(awayStats, 'USFBkickReturns')),
                normalizeStat('USFBkickReturnsPerGame', getStat(homeStats, 'USFBkickReturnsPerGame') - getStat(awayStats, 'USFBkickReturnsPerGame')),
                normalizeStat('USFBkickReturnYards', getStat(homeStats, 'USFBkickReturnYards') - getStat(awayStats, 'USFBkickReturnYards')),
                normalizeStat('USFBkickReturnYardsPerGame', getStat(homeStats, 'USFBkickReturnYardsPerGame') - getStat(awayStats, 'USFBkickReturnYardsPerGame')),
                normalizeStat('USFBpuntReturns', getStat(homeStats, 'USFBpuntReturns') - getStat(awayStats, 'USFBpuntReturns')),
                normalizeStat('USFBpuntReturnsPerGame', getStat(homeStats, 'USFBpuntReturnsPerGame') - getStat(awayStats, 'USFBpuntReturnsPerGame')),
                normalizeStat('USFBpuntReturnFairCatchPct', getStat(homeStats, 'USFBpuntReturnFairCatchPct') - getStat(awayStats, 'USFBpuntReturnFairCatchPct')),
                normalizeStat('USFBpuntReturnYards', getStat(homeStats, 'USFBpuntReturnYards') - getStat(awayStats, 'USFBpuntReturnYards')),
                normalizeStat('USFBpuntReturnYardsPerGame', getStat(homeStats, 'USFBpuntReturnYardsPerGame') - getStat(awayStats, 'USFBpuntReturnYardsPerGame')),
                normalizeStat('USFByardsPerReturn', getStat(homeStats, 'USFByardsPerReturn') - getStat(awayStats, 'USFByardsPerReturn')),
                normalizeStat('USFBthirdDownEfficiency', getStat(homeStats, 'USFBthirdDownEfficiency') - getStat(awayStats, 'USFBthirdDownEfficiency')),
                normalizeStat('USFBtotalPenyards', getStat(homeStats, 'USFBtotalPenyards') - getStat(awayStats, 'USFBtotalPenyards')),
                normalizeStat('USFBaveragePenYardsPerGame', getStat(homeStats, 'USFBaveragePenYardsPerGame') - getStat(awayStats, 'USFBaveragePenYardsPerGame')),
                normalizeStat('USFBgiveaways', getStat(homeStats, 'USFBgiveaways') - getStat(awayStats, 'USFBgiveaways')),
                normalizeStat('USFBtakeaways', getStat(homeStats, 'USFBtakeaways') - getStat(awayStats, 'USFBtakeaways')),
                normalizeStat('USFBturnoverDiff', getStat(homeStats, 'USFBturnoverDiff') - getStat(awayStats, 'USFBturnoverDiff')),
                normalizeStat('USFBtotalFirstDowns', getStat(homeStats, 'USFBtotalFirstDowns') - getStat(awayStats, 'USFBtotalFirstDowns')),

            ];
        case 'americanfootball_ncaaf':
            return [
                normalizeStat('seasonWinLoss', getWinLoss(homeStats) - getWinLoss(awayStats)),
                normalizeStat('homeWinLoss', getHomeAwayWinLoss(homeStats, 'homeWinLoss') - getHomeAwayWinLoss(awayStats, 'awayWinLoss')),
                normalizeStat('pointDiff', getStat(homeStats, 'pointDiff') - getStat(awayStats, 'pointDiff')),
                normalizeStat('USFBpointsPerGame', getStat(homeStats, 'USFBpointsPerGame') - getStat(awayStats, 'USFBpointsPerGame')),
                normalizeStat('USFBtotalPoints', getStat(homeStats, 'USFBtotalPoints') - getStat(awayStats, 'USFBtotalPoints')),
                normalizeStat('USFBtotalTouchdowns', getStat(homeStats, 'USFBtotalTouchdowns') - getStat(awayStats, 'USFBtotalTouchdowns')),
                normalizeStat('USFBtouchdownsPerGame', getStat(homeStats, 'USFBtouchdownsPerGame') - getStat(awayStats, 'USFBtouchdownsPerGame')),
                normalizeStat('USFBcompletionPercent', getStat(homeStats, 'USFBcompletionPercent') - getStat(awayStats, 'USFBcompletionPercent')),
                normalizeStat('USFBcompletions', getStat(homeStats, 'USFBcompletions') - getStat(awayStats, 'USFBcompletions')),
                normalizeStat('USFBcompletionsPerGame', getStat(homeStats, 'USFBcompletionsPerGame') - getStat(awayStats, 'USFBcompletionsPerGame')),
                normalizeStat('USFBnetPassingYards', getStat(homeStats, 'USFBnetPassingYards') - getStat(awayStats, 'USFBnetPassingYards')),
                normalizeStat('USFBnetPassingYardsPerGame', getStat(homeStats, 'USFBnetPassingYardsPerGame') - getStat(awayStats, 'USFBnetPassingYardsPerGame')),
                normalizeStat('USFBpassingFirstDowns', getStat(homeStats, 'USFBpassingFirstDowns') - getStat(awayStats, 'USFBpassingFirstDowns')),
                normalizeStat('USFBpassingYards', getStat(homeStats, 'USFBpassingYards') - getStat(awayStats, 'USFBpassingYards')),
                normalizeStat('USFBpassingYardsPerGame', getStat(homeStats, 'USFBpassingYardsPerGame') - getStat(awayStats, 'USFBpassingYardsPerGame')),
                normalizeStat('USFBpassingAttempts', getStat(homeStats, 'USFBpassingAttempts') - getStat(awayStats, 'USFBpassingAttempts')),
                normalizeStat('USFBpassingAttemptsPerGame', getStat(homeStats, 'USFBpassingAttemptsPerGame') - getStat(awayStats, 'USFBpassingAttemptsPerGame')),
                normalizeStat('USFByardsPerPassAttempt', getStat(homeStats, 'USFByardsPerPassAttempt') - getStat(awayStats, 'USFByardsPerPassAttempt')),
                normalizeStat('USFBrushingAttempts', getStat(homeStats, 'USFBrushingAttempts') - getStat(awayStats, 'USFBrushingAttempts')),
                normalizeStat('USFBrushingFirstDowns', getStat(homeStats, 'USFBrushingFirstDowns') - getStat(awayStats, 'USFBrushingFirstDowns')),
                normalizeStat('USFBrushingTouchdowns', getStat(homeStats, 'USFBrushingTouchdowns') - getStat(awayStats, 'USFBrushingTouchdowns')),
                normalizeStat('USFBrushingYards', getStat(homeStats, 'USFBrushingYards') - getStat(awayStats, 'USFBrushingYards')),
                normalizeStat('USFBrushingYardsPerGame', getStat(homeStats, 'USFBrushingYardsPerGame') - getStat(awayStats, 'USFBrushingYardsPerGame')),
                normalizeStat('USFByardsPerRushAttempt', getStat(homeStats, 'USFByardsPerRushAttempt') - getStat(awayStats, 'USFByardsPerRushAttempt')),
                normalizeStat('USFBreceivingFirstDowns', getStat(homeStats, 'USFBreceivingFirstDowns') - getStat(awayStats, 'USFBreceivingFirstDowns')),
                normalizeStat('USFBreceivingTouchdowns', getStat(homeStats, 'USFBreceivingTouchdowns') - getStat(awayStats, 'USFBreceivingTouchdowns')),
                normalizeStat('USFBreceivingYards', getStat(homeStats, 'USFBreceivingYards') - getStat(awayStats, 'USFBreceivingYards')),
                normalizeStat('USFBreceivingYardsPerGame', getStat(homeStats, 'USFBreceivingYardsPerGame') - getStat(awayStats, 'USFBreceivingYardsPerGame')),
                normalizeStat('USFBreceivingYardsPerReception', getStat(homeStats, 'USFBreceivingYardsPerReception') - getStat(awayStats, 'USFBreceivingYardsPerReception')),
                normalizeStat('USFBreceivingYardsAfterCatch', getStat(homeStats, 'USFBreceivingYardsAfterCatch') - getStat(awayStats, 'USFBreceivingYardsAfterCatch')),
                normalizeStat('USFBreceivingYardsAfterCatchPerGame', getStat(homeStats, 'USFBreceivingYardsAfterCatchPerGame') - getStat(awayStats, 'USFBreceivingYardsAfterCatchPerGame')),
                normalizeStat('USFBtacklesforLoss', getStat(homeStats, 'USFBtacklesforLoss') - getStat(awayStats, 'USFBtacklesforLoss')),
                normalizeStat('USFBtacklesforLossPerGame', getStat(homeStats, 'USFBtacklesforLossPerGame') - getStat(awayStats, 'USFBtacklesforLossPerGame')),
                normalizeStat('USFBinterceptions', getStat(homeStats, 'USFBinterceptions') - getStat(awayStats, 'USFBinterceptions')),
                normalizeStat('USFByardsPerInterception', getStat(homeStats, 'USFByardsPerInterception') - getStat(awayStats, 'USFByardsPerInterception')),
                normalizeStat('USFBsacksTotal', getStat(homeStats, 'USFBsacksTotal') - getStat(awayStats, 'USFBsacksTotal')),
                normalizeStat('USFBsacksPerGame', getStat(homeStats, 'USFBsacksPerGame') - getStat(awayStats, 'USFBsacksPerGame')),
                normalizeStat('USFBsackYards', getStat(homeStats, 'USFBsackYards') - getStat(awayStats, 'USFBsackYards')),
                normalizeStat('USFBsackYardsPerGame', getStat(homeStats, 'USFBsackYardsPerGame') - getStat(awayStats, 'USFBsackYardsPerGame')),
                normalizeStat('USFBstuffs', getStat(homeStats, 'USFBstuffs') - getStat(awayStats, 'USFBstuffs')),
                normalizeStat('USFBstuffsPerGame', getStat(homeStats, 'USFBstuffsPerGame') - getStat(awayStats, 'USFBstuffsPerGame')),
                normalizeStat('USFBstuffYards', getStat(homeStats, 'USFBstuffYards') - getStat(awayStats, 'USFBstuffYards')),
                normalizeStat('USFBpassesDefended', getStat(homeStats, 'USFBpassesDefended') - getStat(awayStats, 'USFBpassesDefended')),
                normalizeStat('USFBpassesDefendedPerGame', getStat(homeStats, 'USFBpassesDefendedPerGame') - getStat(awayStats, 'USFBpassesDefendedPerGame')),
                normalizeStat('USFBsafties', getStat(homeStats, 'USFBsafties') - getStat(awayStats, 'USFBsafties')),
                normalizeStat('USFBaverageKickoffYards', getStat(homeStats, 'USFBaverageKickoffYards') - getStat(awayStats, 'USFBaverageKickoffYards')),
                normalizeStat('USFBaverageKickoffYardsPerGame', getStat(homeStats, 'USFBaverageKickoffYardsPerGame') - getStat(awayStats, 'USFBaverageKickoffYardsPerGame')),
                normalizeStat('USFBextraPointAttempts', getStat(homeStats, 'USFBextraPointAttempts') - getStat(awayStats, 'USFBextraPointAttempts')),
                normalizeStat('USFBextraPointAttemptsPerGame', getStat(homeStats, 'USFBextraPointAttemptsPerGame') - getStat(awayStats, 'USFBextraPointAttemptsPerGame')),
                normalizeStat('USFBextraPointsMade', getStat(homeStats, 'USFBextraPointsMade') - getStat(awayStats, 'USFBextraPointsMade')),
                normalizeStat('USFBextraPointsMadePerGame', getStat(homeStats, 'USFBextraPointsMadePerGame') - getStat(awayStats, 'USFBextraPointsMadePerGame')),
                normalizeStat('USFBextraPointPercent', getStat(homeStats, 'USFBextraPointPercent') - getStat(awayStats, 'USFBextraPointPercent')),
                normalizeStat('USFBextraPointPercentPerGame', getStat(homeStats, 'USFBextraPointPercentPerGame') - getStat(awayStats, 'USFBextraPointPercentPerGame')),
                normalizeStat('USFBfieldGoalAttempts', getStat(homeStats, 'USFBfieldGoalAttempts') - getStat(awayStats, 'USFBfieldGoalAttempts')),
                normalizeStat('USFBfieldGoalAttemptsPerGame', getStat(homeStats, 'USFBfieldGoalAttemptsPerGame') - getStat(awayStats, 'USFBfieldGoalAttemptsPerGame')),
                normalizeStat('USFBfieldGoalsMade', getStat(homeStats, 'USFBfieldGoalsMade') - getStat(awayStats, 'USFBfieldGoalsMade')),
                normalizeStat('USFBfieldGoalsMadePerGame', getStat(homeStats, 'USFBfieldGoalsMadePerGame') - getStat(awayStats, 'USFBfieldGoalsMadePerGame')),
                normalizeStat('USFBfieldGoalPct', getStat(homeStats, 'USFBfieldGoalPct') - getStat(awayStats, 'USFBfieldGoalPct')),
                normalizeStat('USFBfieldGoalPercentPerGame', getStat(homeStats, 'USFBfieldGoalPercentPerGame') - getStat(awayStats, 'USFBfieldGoalPercentPerGame')),
                normalizeStat('USFBtouchbacks', getStat(homeStats, 'USFBtouchbacks') - getStat(awayStats, 'USFBtouchbacks')),
                normalizeStat('USFBtouchbacksPerGame', getStat(homeStats, 'USFBtouchbacksPerGame') - getStat(awayStats, 'USFBtouchbacksPerGame')),
                normalizeStat('USFBtouchBackPercentage', getStat(homeStats, 'USFBtouchBackPercentage') - getStat(awayStats, 'USFBtouchBackPercentage')),
                normalizeStat('USFBkickReturns', getStat(homeStats, 'USFBkickReturns') - getStat(awayStats, 'USFBkickReturns')),
                normalizeStat('USFBkickReturnsPerGame', getStat(homeStats, 'USFBkickReturnsPerGame') - getStat(awayStats, 'USFBkickReturnsPerGame')),
                normalizeStat('USFBkickReturnYards', getStat(homeStats, 'USFBkickReturnYards') - getStat(awayStats, 'USFBkickReturnYards')),
                normalizeStat('USFBkickReturnYardsPerGame', getStat(homeStats, 'USFBkickReturnYardsPerGame') - getStat(awayStats, 'USFBkickReturnYardsPerGame')),
                normalizeStat('USFBpuntReturns', getStat(homeStats, 'USFBpuntReturns') - getStat(awayStats, 'USFBpuntReturns')),
                normalizeStat('USFBpuntReturnsPerGame', getStat(homeStats, 'USFBpuntReturnsPerGame') - getStat(awayStats, 'USFBpuntReturnsPerGame')),
                normalizeStat('USFBpuntReturnFairCatchPct', getStat(homeStats, 'USFBpuntReturnFairCatchPct') - getStat(awayStats, 'USFBpuntReturnFairCatchPct')),
                normalizeStat('USFBpuntReturnYards', getStat(homeStats, 'USFBpuntReturnYards') - getStat(awayStats, 'USFBpuntReturnYards')),
                normalizeStat('USFBpuntReturnYardsPerGame', getStat(homeStats, 'USFBpuntReturnYardsPerGame') - getStat(awayStats, 'USFBpuntReturnYardsPerGame')),
                normalizeStat('USFByardsPerReturn', getStat(homeStats, 'USFByardsPerReturn') - getStat(awayStats, 'USFByardsPerReturn')),
                normalizeStat('USFBthirdDownEfficiency', getStat(homeStats, 'USFBthirdDownEfficiency') - getStat(awayStats, 'USFBthirdDownEfficiency')),
                normalizeStat('USFBtotalPenyards', getStat(homeStats, 'USFBtotalPenyards') - getStat(awayStats, 'USFBtotalPenyards')),
                normalizeStat('USFBaveragePenYardsPerGame', getStat(homeStats, 'USFBaveragePenYardsPerGame') - getStat(awayStats, 'USFBaveragePenYardsPerGame')),
                normalizeStat('USFBgiveaways', getStat(homeStats, 'USFBgiveaways') - getStat(awayStats, 'USFBgiveaways')),
                normalizeStat('USFBtakeaways', getStat(homeStats, 'USFBtakeaways') - getStat(awayStats, 'USFBtakeaways')),
                normalizeStat('USFBturnoverDiff', getStat(homeStats, 'USFBturnoverDiff') - getStat(awayStats, 'USFBturnoverDiff')),
                normalizeStat('USFBtotalFirstDowns', getStat(homeStats, 'USFBtotalFirstDowns') - getStat(awayStats, 'USFBtotalFirstDowns')),

            ];
        case 'icehockey_nhl':
            return [
                normalizeStat('seasonWinLoss', getWinLoss(homeStats) - getWinLoss(awayStats)),
                normalizeStat('homeWinLoss', getHomeAwayWinLoss(homeStats, 'homeWinLoss') - getHomeAwayWinLoss(awayStats, 'awayWinLoss')),
                normalizeStat('pointDiff', getStat(homeStats, 'pointDiff') - getStat(awayStats, 'pointDiff')),
                normalizeStat('HKYgoals', getStat(homeStats, 'HKYgoals') - getStat(awayStats, 'HKYgoals')),
                normalizeStat('HKYgoalsPerGame', getStat(homeStats, 'HKYgoalsPerGame') - getStat(awayStats, 'HKYgoalsPerGame')),
                normalizeStat('HKYassists', getStat(homeStats, 'HKYassists') - getStat(awayStats, 'HKYassists')),
                normalizeStat('HKYassistsPerGame', getStat(homeStats, 'HKYassistsPerGame') - getStat(awayStats, 'HKYassistsPerGame')),
                normalizeStat('HKYshotsIn1st', getStat(homeStats, 'HKYshotsIn1st') - getStat(awayStats, 'HKYshotsIn1st')),
                normalizeStat('HKYshotsIn1stPerGame', getStat(homeStats, 'HKYshotsIn1stPerGame') - getStat(awayStats, 'HKYshotsIn1stPerGame')),
                normalizeStat('HKYshotsIn2nd', getStat(homeStats, 'HKYshotsIn2nd') - getStat(awayStats, 'HKYshotsIn2nd')),
                normalizeStat('HKYshotsIn2ndPerGame', getStat(homeStats, 'HKYshotsIn2ndPerGame') - getStat(awayStats, 'HKYshotsIn2ndPerGame')),
                normalizeStat('HKYshotsIn3rd', getStat(homeStats, 'HKYshotsIn3rd') - getStat(awayStats, 'HKYshotsIn3rd')),
                normalizeStat('HKYshotsIn3rdPerGame', getStat(homeStats, 'HKYshotsIn3rdPerGame') - getStat(awayStats, 'HKYshotsIn3rdPerGame')),
                normalizeStat('HKYtotalShots', getStat(homeStats, 'HKYtotalShots') - getStat(awayStats, 'HKYtotalShots')),
                normalizeStat('HKYtotalShotsPerGame', getStat(homeStats, 'HKYtotalShotsPerGame') - getStat(awayStats, 'HKYtotalShotsPerGame')),
                normalizeStat('HKYshotsMissed', getStat(homeStats, 'HKYshotsMissed') - getStat(awayStats, 'HKYshotsMissed')),
                normalizeStat('HKYshotsMissedPerGame', getStat(homeStats, 'HKYshotsMissedPerGame') - getStat(awayStats, 'HKYshotsMissedPerGame')),
                normalizeStat('HKYppgGoals', getStat(homeStats, 'HKYppgGoals') - getStat(awayStats, 'HKYppgGoals')),
                normalizeStat('HKYppgGoalsPerGame', getStat(homeStats, 'HKYppgGoalsPerGame') - getStat(awayStats, 'HKYppgGoalsPerGame')),
                normalizeStat('HKYppassists', getStat(homeStats, 'HKYppassists') - getStat(awayStats, 'HKYppassists')),
                normalizeStat('HKYppassistsPerGame', getStat(homeStats, 'HKYppassistsPerGame') - getStat(awayStats, 'HKYppassistsPerGame')),
                normalizeStat('HKYpowerplayPct', getStat(homeStats, 'HKYpowerplayPct') - getStat(awayStats, 'HKYpowerplayPct')),
                normalizeStat('HKYshortHandedGoals', getStat(homeStats, 'HKYshortHandedGoals') - getStat(awayStats, 'HKYshortHandedGoals')),
                normalizeStat('HKYshortHandedGoalsPerGame', getStat(homeStats, 'HKYshortHandedGoalsPerGame') - getStat(awayStats, 'HKYshortHandedGoalsPerGame')),
                normalizeStat('HKYshootingPct', getStat(homeStats, 'HKYshootingPct') - getStat(awayStats, 'HKYshootingPct')),
                normalizeStat('HKYfaceoffs', getStat(homeStats, 'HKYfaceoffs') - getStat(awayStats, 'HKYfaceoffs')),
                normalizeStat('HKYfaceoffsPerGame', getStat(homeStats, 'HKYfaceoffsPerGame') - getStat(awayStats, 'HKYfaceoffsPerGame')),
                normalizeStat('HKYfaceoffsWon', getStat(homeStats, 'HKYfaceoffsWon') - getStat(awayStats, 'HKYfaceoffsWon')),
                normalizeStat('HKYfaceoffsWonPerGame', getStat(homeStats, 'HKYfaceoffsWonPerGame') - getStat(awayStats, 'HKYfaceoffsWonPerGame')),
                normalizeStat('HKYfaceoffsLost', getStat(homeStats, 'HKYfaceoffsLost') - getStat(awayStats, 'HKYfaceoffsLost')),
                normalizeStat('HKYfaceoffsLostPerGame', getStat(homeStats, 'HKYfaceoffsLostPerGame') - getStat(awayStats, 'HKYfaceoffsLostPerGame')),
                normalizeStat('HKYfaceoffPct', getStat(homeStats, 'HKYfaceoffPct') - getStat(awayStats, 'HKYfaceoffPct')),
                normalizeStat('HKYfaceoffPctPerGame', getStat(homeStats, 'HKYfaceoffPctPerGame') - getStat(awayStats, 'HKYfaceoffPctPerGame')),
                normalizeStat('HKYgiveaways', getStat(homeStats, 'HKYgiveaways') - getStat(awayStats, 'HKYgiveaways')),
                normalizeStat('HKYgoalsAgainst', getStat(homeStats, 'HKYgoalsAgainst') - getStat(awayStats, 'HKYgoalsAgainst')),
                normalizeStat('HKYgoalsAgainstPerGame', getStat(homeStats, 'HKYgoalsAgainstPerGame') - getStat(awayStats, 'HKYgoalsAgainstPerGame')),
                normalizeStat('HKYshotsAgainst', getStat(homeStats, 'HKYshotsAgainst') - getStat(awayStats, 'HKYshotsAgainst')),
                normalizeStat('HKYshotsAgainstPerGame', getStat(homeStats, 'HKYshotsAgainstPerGame') - getStat(awayStats, 'HKYshotsAgainstPerGame')),
                normalizeStat('HKYpenaltyKillPct', getStat(homeStats, 'HKYpenaltyKillPct') - getStat(awayStats, 'HKYpenaltyKillPct')),
                normalizeStat('HKYpenaltyKillPctPerGame', getStat(homeStats, 'HKYpenaltyKillPctPerGame') - getStat(awayStats, 'HKYpenaltyKillPctPerGame')),
                normalizeStat('HKYppGoalsAgainst', getStat(homeStats, 'HKYppGoalsAgainst') - getStat(awayStats, 'HKYppGoalsAgainst')),
                normalizeStat('HKYppGoalsAgainstPerGame', getStat(homeStats, 'HKYppGoalsAgainstPerGame') - getStat(awayStats, 'HKYppGoalsAgainstPerGame')),
                normalizeStat('HKYshutouts', getStat(homeStats, 'HKYshutouts') - getStat(awayStats, 'HKYshutouts')),
                normalizeStat('HKYsaves', getStat(homeStats, 'HKYsaves') - getStat(awayStats, 'HKYsaves')),
                normalizeStat('HKYsavesPerGame', getStat(homeStats, 'HKYsavesPerGame') - getStat(awayStats, 'HKYsavesPerGame')),
                normalizeStat('HKYsavePct', getStat(homeStats, 'HKYsavePct') - getStat(awayStats, 'HKYsavePct')),
                normalizeStat('HKYblockedShots', getStat(homeStats, 'HKYblockedShots') - getStat(awayStats, 'HKYblockedShots')),
                normalizeStat('HKYblockedShotsPerGame', getStat(homeStats, 'HKYblockedShotsPerGame') - getStat(awayStats, 'HKYblockedShotsPerGame')),
                normalizeStat('HKYhits', getStat(homeStats, 'HKYhits') - getStat(awayStats, 'HKYhits')),
                normalizeStat('HKYhitsPerGame', getStat(homeStats, 'HKYhitsPerGame') - getStat(awayStats, 'HKYhitsPerGame')),
                normalizeStat('HKYtakeaways', getStat(homeStats, 'HKYtakeaways') - getStat(awayStats, 'HKYtakeaways')),
                normalizeStat('HKYtakeawaysPerGame', getStat(homeStats, 'HKYtakeawaysPerGame') - getStat(awayStats, 'HKYtakeawaysPerGame')),
                normalizeStat('HKYshotDifferential', getStat(homeStats, 'HKYshotDifferential') - getStat(awayStats, 'HKYshotDifferential')),
                normalizeStat('HKYshotDifferentialPerGame', getStat(homeStats, 'HKYshotDifferentialPerGame') - getStat(awayStats, 'HKYshotDifferentialPerGame')),
                normalizeStat('HKYgoalDifferentialPerGame', getStat(homeStats, 'HKYgoalDifferentialPerGame') - getStat(awayStats, 'HKYgoalDifferentialPerGame')),
                normalizeStat('HKYpimDifferential', getStat(homeStats, 'HKYpimDifferential') - getStat(awayStats, 'HKYpimDifferential')),
                normalizeStat('HKYpimDifferentialPerGame', getStat(homeStats, 'HKYpimDifferentialPerGame') - getStat(awayStats, 'HKYpimDifferentialPerGame')),
                normalizeStat('HKYtotalPenalties', getStat(homeStats, 'HKYtotalPenalties') - getStat(awayStats, 'HKYtotalPenalties')),
                normalizeStat('HKYpenaltiesPerGame', getStat(homeStats, 'HKYpenaltiesPerGame') - getStat(awayStats, 'HKYpenaltiesPerGame')),
                normalizeStat('HKYpenaltyMinutes', getStat(homeStats, 'HKYpenaltyMinutes') - getStat(awayStats, 'HKYpenaltyMinutes')),
                normalizeStat('HKYpenaltyMinutesPerGame', getStat(homeStats, 'HKYpenaltyMinutesPerGame') - getStat(awayStats, 'HKYpenaltyMinutesPerGame'))

            ];
        case 'baseball_mlb':
            return [
                normalizeStat('seasonWinLoss', getWinLoss(homeStats) - getWinLoss(awayStats)),
                normalizeStat('homeWinLoss', getHomeAwayWinLoss(homeStats, 'homeWinLoss') - getHomeAwayWinLoss(awayStats, 'awayWinLoss')),
                normalizeStat('pointDiff', getStat(homeStats, 'pointDiff') - getStat(awayStats, 'pointDiff')),
                normalizeStat('BSBbattingStrikeouts', getStat(homeStats, 'BSBbattingStrikeouts') - getStat(awayStats, 'BSBbattingStrikeouts')),
                normalizeStat('BSBrunsBattedIn', getStat(homeStats, 'BSBrunsBattedIn') - getStat(awayStats, 'BSBrunsBattedIn')),
                normalizeStat('BSBsacrificeHits', getStat(homeStats, 'BSBsacrificeHits') - getStat(awayStats, 'BSBsacrificeHits')),
                normalizeStat('BSBHitsTotal', getStat(homeStats, 'BSBHitsTotal') - getStat(awayStats, 'BSBHitsTotal')),
                normalizeStat('BSBwalks', getStat(homeStats, 'BSBwalks') - getStat(awayStats, 'BSBwalks')),
                normalizeStat('BSBruns', getStat(homeStats, 'BSBruns') - getStat(awayStats, 'BSBruns')),
                normalizeStat('BSBhomeRuns', getStat(homeStats, 'BSBhomeRuns') - getStat(awayStats, 'BSBhomeRuns')),
                normalizeStat('BSBdoubles', getStat(homeStats, 'BSBdoubles') - getStat(awayStats, 'BSBdoubles')),
                normalizeStat('BSBtotalBases', getStat(homeStats, 'BSBtotalBases') - getStat(awayStats, 'BSBtotalBases')),
                normalizeStat('BSBextraBaseHits', getStat(homeStats, 'BSBextraBaseHits') - getStat(awayStats, 'BSBextraBaseHits')),
                normalizeStat('BSBbattingAverage', getStat(homeStats, 'BSBbattingAverage') - getStat(awayStats, 'BSBbattingAverage')),
                normalizeStat('BSBsluggingPercentage', getStat(homeStats, 'BSBsluggingPercentage') - getStat(awayStats, 'BSBsluggingPercentage')),
                normalizeStat('BSBonBasePercentage', getStat(homeStats, 'BSBonBasePercentage') - getStat(awayStats, 'BSBonBasePercentage')),
                normalizeStat('BSBonBasePlusSlugging', getStat(homeStats, 'BSBonBasePlusSlugging') - getStat(awayStats, 'BSBonBasePlusSlugging')),
                normalizeStat('BSBgroundToFlyRatio', getStat(homeStats, 'BSBgroundToFlyRatio') - getStat(awayStats, 'BSBgroundToFlyRatio')),
                normalizeStat('BSBatBatsPerHomeRun', getStat(homeStats, 'BSBatBatsPerHomeRun') - getStat(awayStats, 'BSBatBatsPerHomeRun')),
                normalizeStat('BSBstolenBasePercentage', getStat(homeStats, 'BSBstolenBasePercentage') - getStat(awayStats, 'BSBstolenBasePercentage')),
                normalizeStat('BSBbatterWalkToStrikeoutRatio', getStat(homeStats, 'BSBbatterWalkToStrikeoutRatio') - getStat(awayStats, 'BSBbatterWalkToStrikeoutRatio')),
                normalizeStat('BSBsaves', getStat(homeStats, 'BSBsaves') - getStat(awayStats, 'BSBsaves')),
                normalizeStat('BSBpitcherStrikeouts', getStat(homeStats, 'BSBpitcherStrikeouts') - getStat(awayStats, 'BSBpitcherStrikeouts')),
                normalizeStat('BSBhitsGivenUp', getStat(homeStats, 'BSBhitsGivenUp') - getStat(awayStats, 'BSBhitsGivenUp')),
                normalizeStat('BSBearnedRuns', getStat(homeStats, 'BSBearnedRuns') - getStat(awayStats, 'BSBearnedRuns')),
                normalizeStat('BSBbattersWalked', getStat(homeStats, 'BSBbattersWalked') - getStat(awayStats, 'BSBbattersWalked')),
                normalizeStat('BSBrunsAllowed', getStat(homeStats, 'BSBrunsAllowed') - getStat(awayStats, 'BSBrunsAllowed')),
                normalizeStat('BSBhomeRunsAllowed', getStat(homeStats, 'BSBhomeRunsAllowed') - getStat(awayStats, 'BSBhomeRunsAllowed')),
                normalizeStat('BSBwins', getStat(homeStats, 'BSBwins') - getStat(awayStats, 'BSBwins')),
                normalizeStat('BSBshutouts', getStat(homeStats, 'BSBshutouts') - getStat(awayStats, 'BSBshutouts')),
                normalizeStat('BSBearnedRunAverage', getStat(homeStats, 'BSBearnedRunAverage') - getStat(awayStats, 'BSBearnedRunAverage')),
                normalizeStat('BSBwalksHitsPerInningPitched', getStat(homeStats, 'BSBwalksHitsPerInningPitched') - getStat(awayStats, 'BSBwalksHitsPerInningPitched')),
                normalizeStat('BSBwinPct', getStat(homeStats, 'BSBwinPct') - getStat(awayStats, 'BSBwinPct')),
                normalizeStat('BSBpitcherCaughtStealingPct', getStat(homeStats, 'BSBpitcherCaughtStealingPct') - getStat(awayStats, 'BSBpitcherCaughtStealingPct')),
                normalizeStat('BSBpitchesPerInning', getStat(homeStats, 'BSBpitchesPerInning') - getStat(awayStats, 'BSBpitchesPerInning')),
                normalizeStat('BSBrunSupportAverage', getStat(homeStats, 'BSBrunSupportAverage') - getStat(awayStats, 'BSBrunSupportAverage')),
                normalizeStat('BSBopponentBattingAverage', getStat(homeStats, 'BSBopponentBattingAverage') - getStat(awayStats, 'BSBopponentBattingAverage')),
                normalizeStat('BSBopponentSlugAverage', getStat(homeStats, 'BSBopponentSlugAverage') - getStat(awayStats, 'BSBopponentSlugAverage')),
                normalizeStat('BSBopponentOnBasePct', getStat(homeStats, 'BSBopponentOnBasePct') - getStat(awayStats, 'BSBopponentOnBasePct')),
                normalizeStat('BSBopponentOnBasePlusSlugging', getStat(homeStats, 'BSBopponentOnBasePlusSlugging') - getStat(awayStats, 'BSBopponentOnBasePlusSlugging')),
                normalizeStat('BSBsavePct', getStat(homeStats, 'BSBsavePct') - getStat(awayStats, 'BSBsavePct')),
                normalizeStat('BSBstrikeoutsPerNine', getStat(homeStats, 'BSBstrikeoutsPerNine') - getStat(awayStats, 'BSBstrikeoutsPerNine')),
                normalizeStat('BSBpitcherStrikeoutToWalkRatio', getStat(homeStats, 'BSBpitcherStrikeoutToWalkRatio') - getStat(awayStats, 'BSBpitcherStrikeoutToWalkRatio')),
                normalizeStat('BSBdoublePlays', getStat(homeStats, 'BSBdoublePlays') - getStat(awayStats, 'BSBdoublePlays')),
                normalizeStat('BSBerrors', getStat(homeStats, 'BSBerrors') - getStat(awayStats, 'BSBerrors')),
                normalizeStat('BSBpassedBalls', getStat(homeStats, 'BSBpassedBalls') - getStat(awayStats, 'BSBpassedBalls')),
                normalizeStat('BSBassists', getStat(homeStats, 'BSBassists') - getStat(awayStats, 'BSBassists')),
                normalizeStat('BSBputouts', getStat(homeStats, 'BSBputouts') - getStat(awayStats, 'BSBputouts')),
                normalizeStat('BSBcatcherCaughtStealing', getStat(homeStats, 'BSBcatcherCaughtStealing') - getStat(awayStats, 'BSBcatcherCaughtStealing')),
                normalizeStat('BSBcatcherCaughtStealingPct', getStat(homeStats, 'BSBcatcherCaughtStealingPct') - getStat(awayStats, 'BSBcatcherCaughtStealingPct')),
                normalizeStat('BSBcatcherStolenBasesAllowed', getStat(homeStats, 'BSBcatcherStolenBasesAllowed') - getStat(awayStats, 'BSBcatcherStolenBasesAllowed')),
                normalizeStat('BSBfieldingPercentage', getStat(homeStats, 'BSBfieldingPercentage') - getStat(awayStats, 'BSBfieldingPercentage')),
                normalizeStat('BSBrangeFactor', getStat(homeStats, 'BSBrangeFactor') - getStat(awayStats, 'BSBrangeFactor'))
            ];
        case 'basketball_ncaab':
            return [
                normalizeStat('seasonWinLoss', getWinLoss(homeStats) - getWinLoss(awayStats)),
                normalizeStat('homeWinLoss', getHomeAwayWinLoss(homeStats, 'homeWinLoss') - getHomeAwayWinLoss(awayStats, 'awayWinLoss')),
                normalizeStat('pointDiff', getStat(homeStats, 'pointDiff') - getStat(awayStats, 'pointDiff')),
                normalizeStat('BSKBtotalPoints', getStat(homeStats, 'BSKBtotalPoints') - getStat(awayStats, 'BSKBtotalPoints')),
                normalizeStat('BSKBpointsPerGame', getStat(homeStats, 'BSKBpointsPerGame') - getStat(awayStats, 'BSKBpointsPerGame')),
                normalizeStat('BSKBassists', getStat(homeStats, 'BSKBassists') - getStat(awayStats, 'BSKBassists')),
                normalizeStat('BSKBassistsPerGame', getStat(homeStats, 'BSKBassistsPerGame') - getStat(awayStats, 'BSKBassistsPerGame')),
                normalizeStat('BSKBassistRatio', getStat(homeStats, 'BSKBassistRatio') - getStat(awayStats, 'BSKBassistRatio')),
                normalizeStat('BSKBeffectiveFgPercent', getStat(homeStats, 'BSKBeffectiveFgPercent') - getStat(awayStats, 'BSKBeffectiveFgPercent')),
                normalizeStat('BSKBfieldGoalPercent', getStat(homeStats, 'BSKBfieldGoalPercent') - getStat(awayStats, 'BSKBfieldGoalPercent')),
                normalizeStat('BSKBfieldGoalsAttempted', getStat(homeStats, 'BSKBfieldGoalsAttempted') - getStat(awayStats, 'BSKBfieldGoalsAttempted')),
                normalizeStat('BSKBfieldGoalsMade', getStat(homeStats, 'BSKBfieldGoalsMade') - getStat(awayStats, 'BSKBfieldGoalsMade')),
                normalizeStat('BSKBfieldGoalsPerGame', getStat(homeStats, 'BSKBfieldGoalsPerGame') - getStat(awayStats, 'BSKBfieldGoalsPerGame')),
                normalizeStat('BSKBfreeThrowPercent', getStat(homeStats, 'BSKBfreeThrowPercent') - getStat(awayStats, 'BSKBfreeThrowPercent')),
                normalizeStat('BSKBfreeThrowsAttempted', getStat(homeStats, 'BSKBfreeThrowsAttempted') - getStat(awayStats, 'BSKBfreeThrowsAttempted')),
                normalizeStat('BSKBfreeThrowsMade', getStat(homeStats, 'BSKBfreeThrowsMade') - getStat(awayStats, 'BSKBfreeThrowsMade')),
                normalizeStat('BSKBfreeThrowsMadePerGame', getStat(homeStats, 'BSKBfreeThrowsMadePerGame') - getStat(awayStats, 'BSKBfreeThrowsMadePerGame')),
                normalizeStat('BSKBoffensiveRebounds', getStat(homeStats, 'BSKBoffensiveRebounds') - getStat(awayStats, 'BSKBoffensiveRebounds')),
                normalizeStat('BSKBoffensiveReboundsPerGame', getStat(homeStats, 'BSKBoffensiveReboundsPerGame') - getStat(awayStats, 'BSKBoffensiveReboundsPerGame')),
                normalizeStat('BSKBoffensiveReboundRate', getStat(homeStats, 'BSKBoffensiveReboundRate') - getStat(awayStats, 'BSKBoffensiveReboundRate')),
                normalizeStat('BSKBoffensiveTurnovers', getStat(homeStats, 'BSKBoffensiveTurnovers') - getStat(awayStats, 'BSKBoffensiveTurnovers')),
                normalizeStat('BSKBturnoversPerGame', getStat(homeStats, 'BSKBturnoversPerGame') - getStat(awayStats, 'BSKBturnoversPerGame')),
                normalizeStat('BSKBturnoverRatio', getStat(homeStats, 'BSKBturnoverRatio') - getStat(awayStats, 'BSKBturnoverRatio')),
                normalizeStat('BSKBthreePointPct', getStat(homeStats, 'BSKBthreePointPct') - getStat(awayStats, 'BSKBthreePointPct')),
                normalizeStat('BSKBthreePointsAttempted', getStat(homeStats, 'BSKBthreePointsAttempted') - getStat(awayStats, 'BSKBthreePointsAttempted')),
                normalizeStat('BSKBthreePointsMade', getStat(homeStats, 'BSKBthreePointsMade') - getStat(awayStats, 'BSKBthreePointsMade')),
                normalizeStat('BSKBtrueShootingPct', getStat(homeStats, 'BSKBtrueShootingPct') - getStat(awayStats, 'BSKBtrueShootingPct')),
                normalizeStat('BSKBpace', getStat(homeStats, 'BSKBpace') - getStat(awayStats, 'BSKBpace')),
                normalizeStat('BSKBpointsInPaint', getStat(homeStats, 'BSKBpointsInPaint') - getStat(awayStats, 'BSKBpointsInPaint')),
                normalizeStat('BSKBshootingEfficiency', getStat(homeStats, 'BSKBshootingEfficiency') - getStat(awayStats, 'BSKBshootingEfficiency')),
                normalizeStat('BSKBscoringEfficiency', getStat(homeStats, 'BSKBscoringEfficiency') - getStat(awayStats, 'BSKBscoringEfficiency')),
                normalizeStat('BSKBblocks', getStat(homeStats, 'BSKBblocks') - getStat(awayStats, 'BSKBblocks')),
                normalizeStat('BSKBblocksPerGame', getStat(homeStats, 'BSKBblocksPerGame') - getStat(awayStats, 'BSKBblocksPerGame')),
                normalizeStat('BSKBdefensiveRebounds', getStat(homeStats, 'BSKBdefensiveRebounds') - getStat(awayStats, 'BSKBdefensiveRebounds')),
                normalizeStat('BSKBdefensiveReboundsPerGame', getStat(homeStats, 'BSKBdefensiveReboundsPerGame') - getStat(awayStats, 'BSKBdefensiveReboundsPerGame')),
                normalizeStat('BSKBsteals', getStat(homeStats, 'BSKBsteals') - getStat(awayStats, 'BSKBsteals')),
                normalizeStat('BSKBstealsPerGame', getStat(homeStats, 'BSKBstealsPerGame') - getStat(awayStats, 'BSKBstealsPerGame')),
                normalizeStat('BSKBreboundRate', getStat(homeStats, 'BSKBreboundRate') - getStat(awayStats, 'BSKBreboundRate')),
                normalizeStat('BSKBreboundsPerGame', getStat(homeStats, 'BSKBreboundsPerGame') - getStat(awayStats, 'BSKBreboundsPerGame')),
                normalizeStat('BSKBfoulsPerGame', getStat(homeStats, 'BSKBfoulsPerGame') - getStat(awayStats, 'BSKBfoulsPerGame')),
                normalizeStat('BSKBteamAssistToTurnoverRatio', getStat(homeStats, 'BSKBteamAssistToTurnoverRatio') - getStat(awayStats, 'BSKBteamAssistToTurnoverRatio'))
            ];
        case 'basketball_wncaab':
            return [
                normalizeStat('seasonWinLoss', getWinLoss(homeStats) - getWinLoss(awayStats)),
                normalizeStat('homeWinLoss', getHomeAwayWinLoss(homeStats, 'homeWinLoss') - getHomeAwayWinLoss(awayStats, 'awayWinLoss')),
                normalizeStat('pointDiff', getStat(homeStats, 'pointDiff') - getStat(awayStats, 'pointDiff')),
                normalizeStat('BSKBtotalPoints', getStat(homeStats, 'BSKBtotalPoints') - getStat(awayStats, 'BSKBtotalPoints')),
                normalizeStat('BSKBpointsPerGame', getStat(homeStats, 'BSKBpointsPerGame') - getStat(awayStats, 'BSKBpointsPerGame')),
                normalizeStat('BSKBassists', getStat(homeStats, 'BSKBassists') - getStat(awayStats, 'BSKBassists')),
                normalizeStat('BSKBassistsPerGame', getStat(homeStats, 'BSKBassistsPerGame') - getStat(awayStats, 'BSKBassistsPerGame')),
                normalizeStat('BSKBassistRatio', getStat(homeStats, 'BSKBassistRatio') - getStat(awayStats, 'BSKBassistRatio')),
                normalizeStat('BSKBeffectiveFgPercent', getStat(homeStats, 'BSKBeffectiveFgPercent') - getStat(awayStats, 'BSKBeffectiveFgPercent')),
                normalizeStat('BSKBfieldGoalPercent', getStat(homeStats, 'BSKBfieldGoalPercent') - getStat(awayStats, 'BSKBfieldGoalPercent')),
                normalizeStat('BSKBfieldGoalsAttempted', getStat(homeStats, 'BSKBfieldGoalsAttempted') - getStat(awayStats, 'BSKBfieldGoalsAttempted')),
                normalizeStat('BSKBfieldGoalsMade', getStat(homeStats, 'BSKBfieldGoalsMade') - getStat(awayStats, 'BSKBfieldGoalsMade')),
                normalizeStat('BSKBfieldGoalsPerGame', getStat(homeStats, 'BSKBfieldGoalsPerGame') - getStat(awayStats, 'BSKBfieldGoalsPerGame')),
                normalizeStat('BSKBfreeThrowPercent', getStat(homeStats, 'BSKBfreeThrowPercent') - getStat(awayStats, 'BSKBfreeThrowPercent')),
                normalizeStat('BSKBfreeThrowsAttempted', getStat(homeStats, 'BSKBfreeThrowsAttempted') - getStat(awayStats, 'BSKBfreeThrowsAttempted')),
                normalizeStat('BSKBfreeThrowsMade', getStat(homeStats, 'BSKBfreeThrowsMade') - getStat(awayStats, 'BSKBfreeThrowsMade')),
                normalizeStat('BSKBfreeThrowsMadePerGame', getStat(homeStats, 'BSKBfreeThrowsMadePerGame') - getStat(awayStats, 'BSKBfreeThrowsMadePerGame')),
                normalizeStat('BSKBoffensiveRebounds', getStat(homeStats, 'BSKBoffensiveRebounds') - getStat(awayStats, 'BSKBoffensiveRebounds')),
                normalizeStat('BSKBoffensiveReboundsPerGame', getStat(homeStats, 'BSKBoffensiveReboundsPerGame') - getStat(awayStats, 'BSKBoffensiveReboundsPerGame')),
                normalizeStat('BSKBoffensiveReboundRate', getStat(homeStats, 'BSKBoffensiveReboundRate') - getStat(awayStats, 'BSKBoffensiveReboundRate')),
                normalizeStat('BSKBoffensiveTurnovers', getStat(homeStats, 'BSKBoffensiveTurnovers') - getStat(awayStats, 'BSKBoffensiveTurnovers')),
                normalizeStat('BSKBturnoversPerGame', getStat(homeStats, 'BSKBturnoversPerGame') - getStat(awayStats, 'BSKBturnoversPerGame')),
                normalizeStat('BSKBturnoverRatio', getStat(homeStats, 'BSKBturnoverRatio') - getStat(awayStats, 'BSKBturnoverRatio')),
                normalizeStat('BSKBthreePointPct', getStat(homeStats, 'BSKBthreePointPct') - getStat(awayStats, 'BSKBthreePointPct')),
                normalizeStat('BSKBthreePointsAttempted', getStat(homeStats, 'BSKBthreePointsAttempted') - getStat(awayStats, 'BSKBthreePointsAttempted')),
                normalizeStat('BSKBthreePointsMade', getStat(homeStats, 'BSKBthreePointsMade') - getStat(awayStats, 'BSKBthreePointsMade')),
                normalizeStat('BSKBtrueShootingPct', getStat(homeStats, 'BSKBtrueShootingPct') - getStat(awayStats, 'BSKBtrueShootingPct')),
                normalizeStat('BSKBpace', getStat(homeStats, 'BSKBpace') - getStat(awayStats, 'BSKBpace')),
                normalizeStat('BSKBpointsInPaint', getStat(homeStats, 'BSKBpointsInPaint') - getStat(awayStats, 'BSKBpointsInPaint')),
                normalizeStat('BSKBshootingEfficiency', getStat(homeStats, 'BSKBshootingEfficiency') - getStat(awayStats, 'BSKBshootingEfficiency')),
                normalizeStat('BSKBscoringEfficiency', getStat(homeStats, 'BSKBscoringEfficiency') - getStat(awayStats, 'BSKBscoringEfficiency')),
                normalizeStat('BSKBblocks', getStat(homeStats, 'BSKBblocks') - getStat(awayStats, 'BSKBblocks')),
                normalizeStat('BSKBblocksPerGame', getStat(homeStats, 'BSKBblocksPerGame') - getStat(awayStats, 'BSKBblocksPerGame')),
                normalizeStat('BSKBdefensiveRebounds', getStat(homeStats, 'BSKBdefensiveRebounds') - getStat(awayStats, 'BSKBdefensiveRebounds')),
                normalizeStat('BSKBdefensiveReboundsPerGame', getStat(homeStats, 'BSKBdefensiveReboundsPerGame') - getStat(awayStats, 'BSKBdefensiveReboundsPerGame')),
                normalizeStat('BSKBsteals', getStat(homeStats, 'BSKBsteals') - getStat(awayStats, 'BSKBsteals')),
                normalizeStat('BSKBstealsPerGame', getStat(homeStats, 'BSKBstealsPerGame') - getStat(awayStats, 'BSKBstealsPerGame')),
                normalizeStat('BSKBreboundRate', getStat(homeStats, 'BSKBreboundRate') - getStat(awayStats, 'BSKBreboundRate')),
                normalizeStat('BSKBreboundsPerGame', getStat(homeStats, 'BSKBreboundsPerGame') - getStat(awayStats, 'BSKBreboundsPerGame')),
                normalizeStat('BSKBfoulsPerGame', getStat(homeStats, 'BSKBfoulsPerGame') - getStat(awayStats, 'BSKBfoulsPerGame')),
                normalizeStat('BSKBteamAssistToTurnoverRatio', getStat(homeStats, 'BSKBteamAssistToTurnoverRatio') - getStat(awayStats, 'BSKBteamAssistToTurnoverRatio'))
            ];
        case 'basketball_nba':
            return [
                normalizeStat('seasonWinLoss', getWinLoss(homeStats) - getWinLoss(awayStats)),
                normalizeStat('homeWinLoss', getHomeAwayWinLoss(homeStats, 'homeWinLoss') - getHomeAwayWinLoss(awayStats, 'awayWinLoss')),
                normalizeStat('pointDiff', getStat(homeStats, 'pointDiff') - getStat(awayStats, 'pointDiff')),
                normalizeStat('BSKBtotalPoints', getStat(homeStats, 'BSKBtotalPoints') - getStat(awayStats, 'BSKBtotalPoints')),
                normalizeStat('BSKBpointsPerGame', getStat(homeStats, 'BSKBpointsPerGame') - getStat(awayStats, 'BSKBpointsPerGame')),
                normalizeStat('BSKBassists', getStat(homeStats, 'BSKBassists') - getStat(awayStats, 'BSKBassists')),
                normalizeStat('BSKBassistsPerGame', getStat(homeStats, 'BSKBassistsPerGame') - getStat(awayStats, 'BSKBassistsPerGame')),
                normalizeStat('BSKBassistRatio', getStat(homeStats, 'BSKBassistRatio') - getStat(awayStats, 'BSKBassistRatio')),
                normalizeStat('BSKBeffectiveFgPercent', getStat(homeStats, 'BSKBeffectiveFgPercent') - getStat(awayStats, 'BSKBeffectiveFgPercent')),
                normalizeStat('BSKBfieldGoalPercent', getStat(homeStats, 'BSKBfieldGoalPercent') - getStat(awayStats, 'BSKBfieldGoalPercent')),
                normalizeStat('BSKBfieldGoalsAttempted', getStat(homeStats, 'BSKBfieldGoalsAttempted') - getStat(awayStats, 'BSKBfieldGoalsAttempted')),
                normalizeStat('BSKBfieldGoalsMade', getStat(homeStats, 'BSKBfieldGoalsMade') - getStat(awayStats, 'BSKBfieldGoalsMade')),
                normalizeStat('BSKBfieldGoalsPerGame', getStat(homeStats, 'BSKBfieldGoalsPerGame') - getStat(awayStats, 'BSKBfieldGoalsPerGame')),
                normalizeStat('BSKBfreeThrowPercent', getStat(homeStats, 'BSKBfreeThrowPercent') - getStat(awayStats, 'BSKBfreeThrowPercent')),
                normalizeStat('BSKBfreeThrowsAttempted', getStat(homeStats, 'BSKBfreeThrowsAttempted') - getStat(awayStats, 'BSKBfreeThrowsAttempted')),
                normalizeStat('BSKBfreeThrowsMade', getStat(homeStats, 'BSKBfreeThrowsMade') - getStat(awayStats, 'BSKBfreeThrowsMade')),
                normalizeStat('BSKBfreeThrowsMadePerGame', getStat(homeStats, 'BSKBfreeThrowsMadePerGame') - getStat(awayStats, 'BSKBfreeThrowsMadePerGame')),
                normalizeStat('BSKBoffensiveRebounds', getStat(homeStats, 'BSKBoffensiveRebounds') - getStat(awayStats, 'BSKBoffensiveRebounds')),
                normalizeStat('BSKBoffensiveReboundsPerGame', getStat(homeStats, 'BSKBoffensiveReboundsPerGame') - getStat(awayStats, 'BSKBoffensiveReboundsPerGame')),
                normalizeStat('BSKBoffensiveReboundRate', getStat(homeStats, 'BSKBoffensiveReboundRate') - getStat(awayStats, 'BSKBoffensiveReboundRate')),
                normalizeStat('BSKBoffensiveTurnovers', getStat(homeStats, 'BSKBoffensiveTurnovers') - getStat(awayStats, 'BSKBoffensiveTurnovers')),
                normalizeStat('BSKBturnoversPerGame', getStat(homeStats, 'BSKBturnoversPerGame') - getStat(awayStats, 'BSKBturnoversPerGame')),
                normalizeStat('BSKBturnoverRatio', getStat(homeStats, 'BSKBturnoverRatio') - getStat(awayStats, 'BSKBturnoverRatio')),
                normalizeStat('BSKBthreePointPct', getStat(homeStats, 'BSKBthreePointPct') - getStat(awayStats, 'BSKBthreePointPct')),
                normalizeStat('BSKBthreePointsAttempted', getStat(homeStats, 'BSKBthreePointsAttempted') - getStat(awayStats, 'BSKBthreePointsAttempted')),
                normalizeStat('BSKBthreePointsMade', getStat(homeStats, 'BSKBthreePointsMade') - getStat(awayStats, 'BSKBthreePointsMade')),
                normalizeStat('BSKBtrueShootingPct', getStat(homeStats, 'BSKBtrueShootingPct') - getStat(awayStats, 'BSKBtrueShootingPct')),
                normalizeStat('BSKBpace', getStat(homeStats, 'BSKBpace') - getStat(awayStats, 'BSKBpace')),
                normalizeStat('BSKBpointsInPaint', getStat(homeStats, 'BSKBpointsInPaint') - getStat(awayStats, 'BSKBpointsInPaint')),
                normalizeStat('BSKBshootingEfficiency', getStat(homeStats, 'BSKBshootingEfficiency') - getStat(awayStats, 'BSKBshootingEfficiency')),
                normalizeStat('BSKBscoringEfficiency', getStat(homeStats, 'BSKBscoringEfficiency') - getStat(awayStats, 'BSKBscoringEfficiency')),
                normalizeStat('BSKBblocks', getStat(homeStats, 'BSKBblocks') - getStat(awayStats, 'BSKBblocks')),
                normalizeStat('BSKBblocksPerGame', getStat(homeStats, 'BSKBblocksPerGame') - getStat(awayStats, 'BSKBblocksPerGame')),
                normalizeStat('BSKBdefensiveRebounds', getStat(homeStats, 'BSKBdefensiveRebounds') - getStat(awayStats, 'BSKBdefensiveRebounds')),
                normalizeStat('BSKBdefensiveReboundsPerGame', getStat(homeStats, 'BSKBdefensiveReboundsPerGame') - getStat(awayStats, 'BSKBdefensiveReboundsPerGame')),
                normalizeStat('BSKBsteals', getStat(homeStats, 'BSKBsteals') - getStat(awayStats, 'BSKBsteals')),
                normalizeStat('BSKBstealsPerGame', getStat(homeStats, 'BSKBstealsPerGame') - getStat(awayStats, 'BSKBstealsPerGame')),
                normalizeStat('BSKBreboundRate', getStat(homeStats, 'BSKBreboundRate') - getStat(awayStats, 'BSKBreboundRate')),
                normalizeStat('BSKBreboundsPerGame', getStat(homeStats, 'BSKBreboundsPerGame') - getStat(awayStats, 'BSKBreboundsPerGame')),
                normalizeStat('BSKBfoulsPerGame', getStat(homeStats, 'BSKBfoulsPerGame') - getStat(awayStats, 'BSKBfoulsPerGame')),
                normalizeStat('BSKBteamAssistToTurnoverRatio', getStat(homeStats, 'BSKBteamAssistToTurnoverRatio') - getStat(awayStats, 'BSKBteamAssistToTurnoverRatio'))
            ];
        default:
            return [];
    }
}

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

const loadOrCreateModel = async (xs) => {
        // Define the path to the model
        const modelPath = `./model_checkpoint/${sport.name}_model/model.json`;
        // Define the path to the model directory
        const modelDir = `./model_checkpoint/${sport.name}_model`;
    try {
        if (fs.existsSync(modelPath)) {
            return await tf.loadLayersModel(`file://./model_checkpoint/${sport.name}_model/model.json`);
        } else {
            let newModel = tf.sequential();
            // Using the correct L2 regularization
            const l2Regularizer = tf.regularizers.l2({ l2: sport.l2Reg });  // Adjust the value to suit your needs


            newModel.add(tf.layers.dense({ units: xs[0].length, inputShape: [xs[0].length], activation: 'relu', kernelInitializer: sport.kernelInitializer, kernelRegularizer: l2Regularizer, biasInitializer: 'zeros' }));
            for(let layers = 0; layers<sport.hiddenLayerNum;layers++){
                newModel.add(tf.layers.dense({ units: layerNeurons, activation: 'relu', kernelInitializer: sport.kernelInitializer, kernelRegularizer: l2Regularizer, biasInitializer: 'zeros' }));
                newModel.add(tf.layers.dropout({ rate: sport.dropoutReg }));  //Dropout range from .2 up to .7, lower keeps performance intact while still preventing overfitting
            }
            newModel.add(tf.layers.dense({ units: 1, activation: 'sigmoid', kernelInitializer: sport.kernelInitializer, kernelRegularizer: l2Regularizer, biasInitializer: 'zeros' }));

            // Compile the model

            return newModel
        }
    } catch (err) {
        console.log(err)
    }
}

const mlModelTraining = async (gameData, xs, ys, sport) => {
    // Function to calculate decay weight based on number of games processed
    function decayCalcByGames(gamesProcessed, decayFactor) { //FOR USE TO DECAY BY GAMES PROCESSED
        // Full strength for the last 25 games
        const gamesDecayThreshold = sport.gameDecayThreshold;
        if (gamesProcessed <= gamesDecayThreshold) {
            return 1; // No decay for the most recent 25 games
        } else {
            // Apply decay based on the number of games processed
            const decayFactorAdjusted = decayFactor || 0.99;  // Use a default decay factor if none is provided
            const decayAmount = Math.pow(decayFactorAdjusted, (gamesProcessed - gamesDecayThreshold));
            return decayAmount;  // Decay decreases as the games processed increases
        }
    }





    let gamesProcessed = 0; // Track how many games have been processed
    // FOR USE TO DECAY BY GAMES PROCESSED
    gameData.forEach(game => {
        const homeStats = game.homeTeamStats;
        const awayStats = game.awayTeamStats;

        // Extract features based on sport
        let features = extractSportFeatures(homeStats, awayStats, sport.name);

        // Calculate decay based on the number of games processed
        const decayWeight = decayCalcByGames(gamesProcessed, sport.decayFactor);  // get the decay weight based on gamesProcessed

        // Apply decay to each feature
        features = features.map(feature => feature * decayWeight);

        // Set label to 1 if home team wins, 0 if away team wins
        const correctPrediction = game.winner === 'home' ? 1 : 0;
        checkNaNValues(features, game);  // Check features

        xs.push(features);
        ys.push(correctPrediction);

        gamesProcessed++;  // Increment the counter for games processed
    });

    // Convert arrays to tensors
    const xsTensor = tf.tensor2d(xs);

    const ysTensor = tf.tensor2d(ys, [ys.length, 1]);
    // Define the path to the model
    const modelPath = `./model_checkpoint/${sport.name}_model/model.json`;
    // Define the path to the model directory
    const modelDir = `./model_checkpoint/${sport.name}_model`;

    // Define the model

    const model = await loadOrCreateModel(xs)
    function exponentialDecay(epoch) {
        const initialLearningRate = learningRate;  // Set your initial learning rate
        const decayRate = sport.learningDecayFactor;             // Rate at which the learning rate decays
        const decaySteps = 10;              // The number of epochs after which decay occurs

        return initialLearningRate * Math.pow(decayRate, Math.floor(epoch / decaySteps));
    }
    const learningRateScheduler = {
        onEpochBegin: (epoch, logs) => {
            if (epoch === 0) {
                // console.log(`Starting Learning Rate: ${learningRate}`);
            }
            // Get the new learning rate using the exponential decay function
            const newLearningRate = exponentialDecay(epoch);

            // Update the optimizer with the new learning rate
            model.optimizer.learningRate = newLearningRate;
            if (epoch === 99) {
                // console.log(`Final Learning Rate: ${newLearningRate}`);
            }
        }
    };
    // Flatten ysTensor to convert it to a 1D array
    const ysArray = await ysTensor.reshape([-1]).array();
    // Dynamically calculate class weights
    const classWeights = calculateClassWeights(ysArray);
    // console.log("Class Weights: ", classWeights)
    model.compile({
        optimizer: tf.train.adam(sport.learningRate),
        loss: 'binaryCrossentropy',
        metrics: ['accuracy']
    });
    let bestValLoss = Infinity;  // Initialize to a high value
    let bestWeights = null;      // Store the best weights
    let epochsWithoutImprovement = 0;
    const patience = 5;  // Set the number of epochs for early stopping (patience)
    const earlyStopping = async (epoch, logs) => {
        const valLoss = logs.val_loss;
        if (valLoss < bestValLoss) {
            bestValLoss = valLoss;
            bestWeights = model.getWeights();  // Save the current weights as the best weights
            epochsWithoutImprovement = 0;  // Reset counter if improvement is found
        } else {
            epochsWithoutImprovement++;
        }

        if (epochsWithoutImprovement >= patience) {
            if (bestWeights) {
                model.setWeights(bestWeights);  // Restore the best weights
            }
            return true;  // Stop training
        }
        return false;  // Continue training
    };
    await model.fit(xsTensor, ysTensor, {
        epochs: sport.epochs,
        batchSize: sport.batchSize,
        validationSplit: 0.3,
        classWeight: classWeights,
        verbose: false,
        shuffle: false,
        callbacks: [{ onEpochEnd: earlyStopping }, learningRateScheduler]
    });
    if (!fs.existsSync(modelDir)) {
        console.log('Creating model directory...');
        // Create the directory (including any necessary parent directories)
        fs.mkdirSync(modelDir, { recursive: true });
    }
    // Save model specific to the sport
    await model.save(`file://./model_checkpoint/${sport.name}_model`);

    return { model, xsTensor, ysTensor }
    // Log loss and accuracy

}
const predictions = async (sportOdds, ff, model) => {
    if (sportOdds.length > 0) {
        // Step 1: Extract the features for each game
        for (const game of sportOdds) {
            if (game.homeTeamStats && game.awayTeamStats) {
                const homeStats = game.homeTeamStats;
                const awayStats = game.awayTeamStats;

                // Extract features based on sport
                const features = extractSportFeatures(homeStats, awayStats, game.sport_key);
                ff.push(features);  // Add the features for each game
            }
        }

        // Step 2: Create a Tensor for the features array
        const ffTensor = tf.tensor2d(ff);

        // const logits = model.predict(ffTensor); // logits without sigmoid
        // logits.print(); // Check the raw values before sigmoid

        // Step 3: Get the predictions
        const predictions = await model.predict(ffTensor);

        // Step 4: Convert predictions tensor to array
        const probabilities = await predictions.array();  // Resolves to an array
        // console.log(probabilities)

        // Step 5: Loop through each game and update with predicted probabilities
        for (let index = 0; index < sportOdds.length; index++) {
            const game = sportOdds[index];
            if (game.homeTeamStats && game.awayTeamStats) {
                const predictedWinPercent = probabilities[index][0]; // Probability for the home team win

                // Make sure to handle NaN values safely
                const predictionStrength = Number.isNaN(predictedWinPercent) ? 0 : predictedWinPercent;

                // Step 6: Determine the predicted winner
                const predictedWinner = predictedWinPercent >= 0.5 ? 'home' : 'away';

                // Update the game with prediction strength
                await Odds.findOneAndUpdate(
                    { id: game.id },
                    {
                        predictionStrength: predictionStrength > .50 ? predictionStrength : 1 - predictionStrength,
                        predictedWinner: predictedWinner
                    }
                );
            }
        }
    }
}
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
const trainSportModelKFold = async (sport, gameData) => {
    currentOdds = await Odds.find({ sport_key: sport.name }).sort({ commence_time: -1 }) //USE THIS TO POPULATE UPCOMING GAME ODDS
    const numFolds = sport.KFolds;  // Number of folds (you can adjust based on your data)
    const foldSize = Math.floor(gameData.length / numFolds);  // Size of each fold

    let allFolds = [];

    // Split gameData into `numFolds` folds
    for (let i = 0; i < numFolds; i++) {
        const foldStart = i * foldSize;
        const foldEnd = (i + 1) * foldSize;

        // Ensure the last fold gets the remaining games
        const foldData = gameData.slice(foldStart, foldEnd);
        allFolds.push(foldData);
    }

    let foldResults = [];
    let finalModel
    // Perform training and testing on each fold
    for (let foldIndex = 0; foldIndex < allFolds.length; foldIndex++) {
        const testFold = allFolds[foldIndex];
        const trainingData = [];
        const testData = [];

        // Prepare training and test data: train on all but the current fold, test on the current fold
        for (let i = 0; i < allFolds.length; i++) {
            if (i !== foldIndex) {
                trainingData.push(...allFolds[i]);  // Add all data except the current fold to training data
            } else {
                testData.push(...allFolds[i]);  // Current fold will be used as the test data
            }
        }

        // Train the model with training data
        const { model, xsTensor, ysTensor } = await mlModelTraining(trainingData, [], [], sport);

        finalModel = model


        // Evaluate the model on the test data
        const testXs = testData.map(game => extractSportFeatures(game.homeTeamStats, game.awayTeamStats, sport.name)); // Extract features for test data
        const testYs = testData.map(game => game.winner === 'home' ? 1 : 0);  // Extract labels for test data

        const testXsTensor = tf.tensor2d(testXs);
        const testYsTensor = tf.tensor2d(testYs, [testYs.length, 1]);

        const evaluation = model.evaluate(testXsTensor, testYsTensor);
        const loss = evaluation[0].arraySync();
        const accuracy = evaluation[1].arraySync();

        const metrics = evaluateMetrics(testYsTensor, model.predict(testXsTensor));

        // // Log metrics for each fold
        // console.log(`Fold ${foldIndex + 1}:`);
        // console.log(`Model Loss:`, loss);
        // console.log(`Model Accuracy:`, accuracy);
        // console.log(`Model Precision:`, metrics.precision);
        // console.log(`Model Recall:`, metrics.recall);
        // console.log(`Model F1-Score:`, metrics.f1Score);
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
    }

    // After all folds, calculate and log the overall performance
    const avgLoss = foldResults.reduce((sum, fold) => sum + fold.loss, 0) / foldResults.length;
    const avgAccuracy = foldResults.reduce((sum, fold) => sum + fold.accuracy, 0) / foldResults.length;
    const avgPrecision = foldResults.reduce((sum, fold) => sum + fold.precision, 0) / foldResults.length;
    const avgRecall = foldResults.reduce((sum, fold) => sum + fold.recall, 0) / foldResults.length;
    const avgF1Score = foldResults.reduce((sum, fold) => sum + fold.f1Score, 0) / foldResults.length;
    const totalTruePositives = foldResults.reduce((sum, fold) => sum + fold.truePositives, 0)
    const totalFalsePositives = foldResults.reduce((sum, fold) => sum + fold.falsePositives, 0)
    const totalTrueNegatives = foldResults.reduce((sum, fold) => sum + fold.trueNegatives, 0)
    const totalFalseNegatives = foldResults.reduce((sum, fold) => sum + fold.falseNegatives, 0)

    console.log(`--- Overall Performance ---`);

    console.log(`truePositives: ${totalTruePositives}`);
    console.log(`falsePositives: ${totalFalsePositives}`);
    console.log(`falseNegatives: ${totalFalseNegatives}`);
    console.log(`trueNegatives: ${totalTrueNegatives}`);
    console.log(`Avg F1-Score: ${avgF1Score}`);
    console.log(`Avg Loss: ${avgLoss}`);
    console.log(`Avg Accuracy: ${avgAccuracy}`);
    console.log(`Avg Precision: ${avgPrecision}`);
    console.log(`Avg Recall: ${avgRecall}`);
    console.log(`Avg F1-Score: ${avgF1Score}`);

    let ff = []
    let sportOdds = await Odds.find({ sport_key: sport.name })
    predictions(sportOdds, ff, finalModel)

    // Handle the weights extraction after training
    await handleSportWeights(finalModel, sport);

    let allPastGames = await PastGameOdds.find()
    indexAdjuster(currentOdds, sport, allPastGames)
};

const trainSportModel = async (sport, gameData) => {
    currentOdds = await Odds.find({ sport_key: sport.name }).sort({ commence_time: -1 }) //USE THIS TO POPULATE UPCOMING GAME ODDS
    if (gameData.length === 0) {
        // Handle the case where there is no data for this sport
        console.log(`No data available for ${sport.league}. Skipping model training.`);
        // You could also add logic to handle this case more gracefully, 
        // such as logging the missing sport and providing a default model.
        return;
    }
    // Function to convert the game data into tensors
    const xs = []; // Features
    const ys = []; // Labels
    // Helper function to safely extract stats with fallback
    console.log(`------------${sport.name} Model Metrics----------`);
    const { model, xsTensor, ysTensor } = await mlModelTraining(gameData, xs, ys, sport)

    // After model is trained and evaluated, integrate the weight extraction
    const evaluation = model.evaluate(xsTensor, ysTensor);
    const loss = evaluation[0].arraySync();
    const accuracy = evaluation[1].arraySync();
    // Now, calculate precision, recall, and F1-score

    const metrics = evaluateMetrics(ysTensor, model.predict(xsTensor));
    // Log the metrics
    console.log(`${sport.name} Model Loss:`, loss);
    console.log(`${sport.name} Model Accuracy:`, accuracy);
    console.log(`${sport.name} Model Precision:`, metrics.precision);
    console.log(`${sport.name} Model Recall:`, metrics.recall);
    console.log(`${sport.name} Model F1-Score:`, metrics.f1Score);
    // Balanced Metrics (Precision ≈ Recall): This indicates a well-performing model, especially if your dataset is balanced.
    // High Precision, Low Recall: The model is good at predicting the positive class but misses a lot of actual positives. You need to improve recall.
    // High Recall, Low Precision: The model is identifying most of the positive instances, but is making many false positive predictions. Precision needs improvement.
    // Low Precision, Low Recall: Likely an underfitting model, not learning effectively. Consider improving your features or the model itself.
    // Perfect Precision and Recall (1.0): A sign of overfitting. This needs further testing to ensure it generalizes well to unseen data.

    let ff = []
    let sportOdds = await Odds.find({ sport_key: sport.name })
    predictions(sportOdds, ff, model)

    // Handle the weights extraction after training
    await handleSportWeights(model, sport);

    let allPastGames = await PastGameOdds.find()
    indexAdjuster(currentOdds, sport, allPastGames)
}

module.exports = { getStat, getWinLoss, getHomeAwayWinLoss, normalizeStat, extractSportFeatures, mlModelTraining, predictions, trainSportModel, trainSportModelKFold, loadOrCreateModel, handleSportWeights, evaluateMetrics }