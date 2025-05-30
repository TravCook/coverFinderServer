module.exports = (sequelize, DataTypes) => {
    const BasketballStats = sequelize.define('BasketballStats', {
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
        BSKBtotalPoints: { type: DataTypes.FLOAT, allowNull: true },
        BSKBpointsPerGame: { type: DataTypes.FLOAT, allowNull: true },
        BSKBassists: { type: DataTypes.FLOAT, allowNull: true },
        BSKBassistsPerGame: { type: DataTypes.FLOAT, allowNull: true },
        BSKBassistRatio: { type: DataTypes.FLOAT, allowNull: true },
        BSKBeffectiveFgPercent: { type: DataTypes.FLOAT, allowNull: true },
        BSKBfieldGoalPercent: { type: DataTypes.FLOAT, allowNull: true },
        BSKBfieldGoalsAttempted: { type: DataTypes.FLOAT, allowNull: true },
        BSKBfieldGoalsMade: { type: DataTypes.FLOAT, allowNull: true },
        BSKBfieldGoalsPerGame: { type: DataTypes.FLOAT, allowNull: true },
        BSKBfreeThrowPercent: { type: DataTypes.FLOAT, allowNull: true },
        BSKBfreeThrowsAttempted: { type: DataTypes.FLOAT, allowNull: true },
        BSKBfreeThrowsMade: { type: DataTypes.FLOAT, allowNull: true },
        BSKBfreeThrowsMadePerGame: { type: DataTypes.FLOAT, allowNull: true },
        BSKBoffensiveRebounds: { type: DataTypes.FLOAT, allowNull: true },
        BSKBoffensiveReboundsPerGame: { type: DataTypes.FLOAT, allowNull: true },
        BSKBoffensiveReboundRate: { type: DataTypes.FLOAT, allowNull: true },
        BSKBoffensiveTurnovers: { type: DataTypes.FLOAT, allowNull: true },
        BSKBturnoversPerGame: { type: DataTypes.FLOAT, allowNull: true },
        BSKBturnoverRatio: { type: DataTypes.FLOAT, allowNull: true },
        BSKBthreePointPct: { type: DataTypes.FLOAT, allowNull: true },
        BSKBthreePointsAttempted: { type: DataTypes.FLOAT, allowNull: true },
        BSKBthreePointsMade: { type: DataTypes.FLOAT, allowNull: true },
        BSKBtrueShootingPct: { type: DataTypes.FLOAT, allowNull: true },
        BSKBpace: { type: DataTypes.FLOAT, allowNull: true },
        BSKBpointsInPaint: { type: DataTypes.FLOAT, allowNull: true },
        BSKBshootingEfficiency: { type: DataTypes.FLOAT, allowNull: true },
        BSKBscoringEfficiency: { type: DataTypes.FLOAT, allowNull: true },
        BSKBblocks: { type: DataTypes.FLOAT, allowNull: true },
        BSKBblocksPerGame: { type: DataTypes.FLOAT, allowNull: true },
        BSKBdefensiveRebounds: { type: DataTypes.FLOAT, allowNull: true },
        BSKBdefensiveReboundsPerGame: { type: DataTypes.FLOAT, allowNull: true },
        BSKBsteals: { type: DataTypes.FLOAT, allowNull: true },
        BSKBstealsPerGame: { type: DataTypes.FLOAT, allowNull: true },
        BSKBreboundRate: { type: DataTypes.FLOAT, allowNull: true },
        BSKBreboundsPerGame: { type: DataTypes.FLOAT, allowNull: true },
        BSKBfoulsPerGame: { type: DataTypes.FLOAT, allowNull: true },
        BSKBteamAssistToTurnoverRatio: { type: DataTypes.FLOAT, allowNull: true }
    });

    BasketballStats.associate = (models) => {
        BasketballStats.belongsTo(models.Games, {
            foreignKey: 'gameId',
            as: 'game'
        })

        BasketballStats.belongsTo(models.PastGames, {
            foreignKey: 'gameId',
            as: 'PastGame'
        })

        BasketballStats.belongsTo(models.Teams, {
            foreignKey: 'teamId',
            as: 'teamDetails'
        });
    }
    return BasketballStats;
}