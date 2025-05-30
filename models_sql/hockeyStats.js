module.exports = (sequelize, DataTypes) => {
    const HockeyStats = sequelize.define('HockeyStats', {
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
        HKYgoals: { type: DataTypes.FLOAT, allowNull: true },
        HKYgoalsPerGame: { type: DataTypes.FLOAT, allowNull: true },
        HKYassists: { type: DataTypes.FLOAT, allowNull: true },
        HKYassistsPerGame: { type: DataTypes.FLOAT, allowNull: true },
        HKYshotsIn1st: { type: DataTypes.FLOAT, allowNull: true },
        HKYshotsIn1stPerGame: { type: DataTypes.FLOAT, allowNull: true },
        HKYshotsIn2nd: { type: DataTypes.FLOAT, allowNull: true },
        HKYshotsIn2ndPerGame: { type: DataTypes.FLOAT, allowNull: true },
        HKYshotsIn3rd: { type: DataTypes.FLOAT, allowNull: true },
        HKYshotsIn3rdPerGame: { type: DataTypes.FLOAT, allowNull: true },
        HKYtotalShots: { type: DataTypes.FLOAT, allowNull: true },
        HKYtotalShotsPerGame: { type: DataTypes.FLOAT, allowNull: true },
        HKYshotsMissed: { type: DataTypes.FLOAT, allowNull: true },
        HKYshotsMissedPerGame: { type: DataTypes.FLOAT, allowNull: true },
        HKYppgGoals: { type: DataTypes.FLOAT, allowNull: true },
        HKYppgGoalsPerGame: { type: DataTypes.FLOAT, allowNull: true },
        HKYppassists: { type: DataTypes.FLOAT, allowNull: true },
        HKYppassistsPerGame: { type: DataTypes.FLOAT, allowNull: true },
        HKYpowerplayPct: { type: DataTypes.FLOAT, allowNull: true },
        HKYshortHandedGoals: { type: DataTypes.FLOAT, allowNull: true },
        HKYshortHandedGoalsPerGame: { type: DataTypes.FLOAT, allowNull: true },
        HKYshootingPct: { type: DataTypes.FLOAT, allowNull: true },
        HKYfaceoffs: { type: DataTypes.FLOAT, allowNull: true },
        HKYfaceoffsPerGame: { type: DataTypes.FLOAT, allowNull: true },
        HKYfaceoffsWon: { type: DataTypes.FLOAT, allowNull: true },
        HKYfaceoffsWonPerGame: { type: DataTypes.FLOAT, allowNull: true },
        HKYfaceoffsLost: { type: DataTypes.FLOAT, allowNull: true },
        HKYfaceoffsLostPerGame: { type: DataTypes.FLOAT, allowNull: true },
        HKYfaceoffPct: { type: DataTypes.FLOAT, allowNull: true },
        HKYfaceoffPctPerGame: { type: DataTypes.FLOAT, allowNull: true },
        HKYgiveaways: { type: DataTypes.FLOAT, allowNull: true },
        HKYgoalsAgainst: { type: DataTypes.FLOAT, allowNull: true },
        HKYgoalsAgainstPerGame: { type: DataTypes.FLOAT, allowNull: true },
        HKYshotsAgainst: { type: DataTypes.FLOAT, allowNull: true },
        HKYshotsAgainstPerGame: { type: DataTypes.FLOAT, allowNull: true },
        HKYpenaltyKillPct: { type: DataTypes.FLOAT, allowNull: true },
        HKYpenaltyKillPctPerGame: { type: DataTypes.FLOAT, allowNull: true },
        HKYppGoalsAgainst: { type: DataTypes.FLOAT, allowNull: true },
        HKYppGoalsAgainstPerGame: { type: DataTypes.FLOAT, allowNull: true },
        HKYshutouts: { type: DataTypes.FLOAT, allowNull: true },
        HKYsaves: { type: DataTypes.FLOAT, allowNull: true },
        HKYsavesPerGame: { type: DataTypes.FLOAT, allowNull: true },
        HKYsavePct: { type: DataTypes.FLOAT, allowNull: true },
        HKYblockedShots: { type: DataTypes.FLOAT, allowNull: true },
        HKYblockedShotsPerGame: { type: DataTypes.FLOAT, allowNull: true },
        HKYhits: { type: DataTypes.FLOAT, allowNull: true },
        HKYhitsPerGame: { type: DataTypes.FLOAT, allowNull: true },
        HKYtakeaways: { type: DataTypes.FLOAT, allowNull: true },
        HKYtakeawaysPerGame: { type: DataTypes.FLOAT, allowNull: true },
        HKYshotDifferential: { type: DataTypes.FLOAT, allowNull: true },
        HKYshotDifferentialPerGame: { type: DataTypes.FLOAT, allowNull: true },
        HKYgoalDifferentialPerGame: { type: DataTypes.FLOAT, allowNull: true },
        HKYpimDifferential: { type: DataTypes.FLOAT, allowNull: true },
        HKYpimDifferentialPerGame: { type: DataTypes.FLOAT, allowNull: true },
        HKYtotalPenalties: { type: DataTypes.FLOAT, allowNull: true },
        HKYpenaltiesPerGame: { type: DataTypes.FLOAT, allowNull: true },
        HKYpenaltyMinutes: { type: DataTypes.FLOAT, allowNull: true },
        HKYpenaltyMinutesPerGame: { type: DataTypes.FLOAT, allowNull: true },
    });

    HockeyStats.associate = (models) => {
        HockeyStats.belongsTo(models.Games, {
            foreignKey: 'gameId',
            as: 'game'
        })

        HockeyStats.belongsTo(models.PastGames, {
            foreignKey: 'gameId',
            as: 'PastGame'
        })

        HockeyStats.belongsTo(models.Teams, {
            foreignKey: 'teamId',
            as: 'teamDetails'
        });
    }
    return HockeyStats;
}