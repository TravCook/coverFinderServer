module.exports = (sequelize, DataTypes) => {
    const UsaFootballStats = sequelize.define('UsaFootballStats', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        gameId: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        teamId: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        seasonWinLoss: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        homeWinLoss: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        awayWinLoss: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        pointDifferential: {
            type: DataTypes.FLOAT,
            allowNull: true,
        },
        USFBpointsPerGame: { type: DataTypes.FLOAT, allowNull: true },
        USFBtotalPoints: { type: DataTypes.FLOAT, allowNull: true },
        USFBtotalTouchdowns: { type: DataTypes.FLOAT, allowNull: true },
        USFBtouchdownsPerGame: { type: DataTypes.FLOAT, allowNull: true },
        USFBcompletionPercent: { type: DataTypes.FLOAT, allowNull: true },
        USFBcompletions: { type: DataTypes.FLOAT, allowNull: true },
        USFBcompletionsPerGame: { type: DataTypes.FLOAT, allowNull: true },
        USFBnetPassingYards: { type: DataTypes.FLOAT, allowNull: true },
        USFBnetPassingYardsPerGame: { type: DataTypes.FLOAT, allowNull: true },
        USFBpassingFirstDowns: { type: DataTypes.FLOAT, allowNull: true },
        USFBpassingYards: { type: DataTypes.FLOAT, allowNull: true },
        USFBpassingYardsPerGame: { type: DataTypes.FLOAT, allowNull: true },
        USFBpassingAttempts: { type: DataTypes.FLOAT, allowNull: true },
        USFBpassingAttemptsPerGame: { type: DataTypes.FLOAT, allowNull: true },
        USFByardsPerPassAttempt: { type: DataTypes.FLOAT, allowNull: true },
        USFBrushingAttempts: { type: DataTypes.FLOAT, allowNull: true },
        USFBrushingFirstDowns: { type: DataTypes.FLOAT, allowNull: true },
        USFBrushingTouchdowns: { type: DataTypes.FLOAT, allowNull: true },
        USFBrushingYards: { type: DataTypes.FLOAT, allowNull: true },
        USFBrushingYardsPerGame: { type: DataTypes.FLOAT, allowNull: true },
        USFByardsPerRushAttempt: { type: DataTypes.FLOAT, allowNull: true },
        USFBreceivingFirstDowns: { type: DataTypes.FLOAT, allowNull: true },
        USFBreceivingTouchdowns: { type: DataTypes.FLOAT, allowNull: true },
        USFBreceivingYards: { type: DataTypes.FLOAT, allowNull: true },
        USFBreceivingYardsPerGame: { type: DataTypes.FLOAT, allowNull: true },
        USFBreceivingYardsPerReception: { type: DataTypes.FLOAT, allowNull: true },
        USFBreceivingYardsAfterCatch: { type: DataTypes.FLOAT, allowNull: true },
        USFBreceivingYardsAfterCatchPerGame: { type: DataTypes.FLOAT, allowNull: true },
        USFBtacklesforLoss: { type: DataTypes.FLOAT, allowNull: true },
        USFBtacklesforLossPerGame: { type: DataTypes.FLOAT, allowNull: true },
        USFBinterceptions: { type: DataTypes.FLOAT, allowNull: true },
        USFByardsPerInterception: { type: DataTypes.FLOAT, allowNull: true },
        USFBsacksTotal: { type: DataTypes.FLOAT, allowNull: true },
        USFBsacksPerGame: { type: DataTypes.FLOAT, allowNull: true },
        USFBsackYards: { type: DataTypes.FLOAT, allowNull: true },
        USFBsackYardsPerGame: { type: DataTypes.FLOAT, allowNull: true },
        USFBstuffs: { type: DataTypes.FLOAT, allowNull: true },
        USFBstuffsPerGame: { type: DataTypes.FLOAT, allowNull: true },
        USFBstuffYards: { type: DataTypes.FLOAT, allowNull: true },
        USFBpassesDefended: { type: DataTypes.FLOAT, allowNull: true },
        USFBpassesDefendedPerGame: { type: DataTypes.FLOAT, allowNull: true },
        USFBsafties: { type: DataTypes.FLOAT, allowNull: true },
        USFBaverageKickoffYards: { type: DataTypes.FLOAT, allowNull: true },
        USFBaverageKickoffYardsPerGame: { type: DataTypes.FLOAT, allowNull: true },
        USFBextraPointAttempts: { type: DataTypes.FLOAT, allowNull: true },
        USFBextraPointAttemptsPerGame: { type: DataTypes.FLOAT, allowNull: true },
        USFBextraPointsMade: { type: DataTypes.FLOAT, allowNull: true },
        USFBextraPointsMadePerGame: { type: DataTypes.FLOAT, allowNull: true },
        USFBextraPointPercent: { type: DataTypes.FLOAT, allowNull: true },
        USFBextraPointPercentPerGame: { type: DataTypes.FLOAT, allowNull: true },
        USFBfieldGoalAttempts: { type: DataTypes.FLOAT, allowNull: true },
        USFBfieldGoalAttemptsPerGame: { type: DataTypes.FLOAT, allowNull: true },
        USFBfieldGoalsMade: { type: DataTypes.FLOAT, allowNull: true },
        USFBfieldGoalsMadePerGame: { type: DataTypes.FLOAT, allowNull: true },
        USFBfieldGoalPct: { type: DataTypes.FLOAT, allowNull: true },
        USFBfieldGoalPercentPerGame: { type: DataTypes.FLOAT, allowNull: true },
        USFBtouchbacks: { type: DataTypes.FLOAT, allowNull: true },
        USFBtouchbacksPerGame: { type: DataTypes.FLOAT, allowNull: true },
        USFBtouchBackPercentage: { type: DataTypes.FLOAT, allowNull: true },
        USFBkickReturns: { type: DataTypes.FLOAT, allowNull: true },
        USFBkickReturnsPerGame: { type: DataTypes.FLOAT, allowNull: true },
        USFBkickReturnYards: { type: DataTypes.FLOAT, allowNull: true },
        USFBkickReturnYardsPerGame: { type: DataTypes.FLOAT, allowNull: true },
        USFBpuntReturns: { type: DataTypes.FLOAT, allowNull: true },
        USFBpuntReturnsPerGame: { type: DataTypes.FLOAT, allowNull: true },
        USFBpuntReturnFairCatchPct: { type: DataTypes.FLOAT, allowNull: true },
        USFBpuntReturnYards: { type: DataTypes.FLOAT, allowNull: true },
        USFBpuntReturnYardsPerGame: { type: DataTypes.FLOAT, allowNull: true },
        USFByardsPerReturn: { type: DataTypes.FLOAT, allowNull: true },
        USFBthirdDownEfficiency: { type: DataTypes.FLOAT, allowNull: true },
        USFBtotalPenyards: { type: DataTypes.FLOAT, allowNull: true },
        USFBaveragePenYardsPerGame: { type: DataTypes.FLOAT, allowNull: true },
        USFBgiveaways: { type: DataTypes.FLOAT, allowNull: true },
        USFBtakeaways: { type: DataTypes.FLOAT, allowNull: true },
        USFBturnoverDiff: { type: DataTypes.FLOAT, allowNull: true },
        USFBtotalFirstDowns: { type: DataTypes.FLOAT, allowNull: true }
    });

    UsaFootballStats.associate = (models) => {
        UsaFootballStats.belongsTo(models.Games, {
            foreignKey: 'gameId',
            as: 'game'
        })

        UsaFootballStats.belongsTo(models.PastGames, {
            foreignKey: 'gameId',
            as: 'PastGame'
        })

        UsaFootballStats.belongsTo(models.Teams, {
            foreignKey: 'teamId',
            as: 'teamDetails'
        });
    }

    return UsaFootballStats;
}