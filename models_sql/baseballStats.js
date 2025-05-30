module.exports = (sequelize, DataTypes) => {
    const BaseballStats = sequelize.define('BaseballStats', {
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
        BSBbattingStrikeouts: { type: DataTypes.FLOAT, allowNull: true },
        BSBrunsBattedIn: { type: DataTypes.FLOAT, allowNull: true },
        BSBsacrificeHits: { type: DataTypes.FLOAT, allowNull: true },
        BSBHitsTotal: { type: DataTypes.FLOAT, allowNull: true },
        BSBwalks: { type: DataTypes.FLOAT, allowNull: true },
        BSBruns: { type: DataTypes.FLOAT, allowNull: true },
        BSBhomeRuns: { type: DataTypes.FLOAT, allowNull: true },
        BSBdoubles: { type: DataTypes.FLOAT, allowNull: true },
        BSBtotalBases: { type: DataTypes.FLOAT, allowNull: true },
        BSBextraBaseHits: { type: DataTypes.FLOAT, allowNull: true },
        BSBbattingAverage: { type: DataTypes.FLOAT, allowNull: true },
        BSBsluggingPercentage: { type: DataTypes.FLOAT, allowNull: true },
        BSBonBasePercentage: { type: DataTypes.FLOAT, allowNull: true },
        BSBonBasePlusSlugging: { type: DataTypes.FLOAT, allowNull: true },
        BSBgroundToFlyRatio: { type: DataTypes.FLOAT, allowNull: true },
        BSBatBatsPerHomeRun: { type: DataTypes.FLOAT, allowNull: true },
        BSBstolenBasePercentage: { type: DataTypes.FLOAT, allowNull: true },
        BSBbatterWalkToStrikeoutRatio: { type: DataTypes.FLOAT, allowNull: true },
        BSBsaves: { type: DataTypes.FLOAT, allowNull: true },
        BSBpitcherStrikeouts: { type: DataTypes.FLOAT, allowNull: true },
        BSBhitsGivenUp: { type: DataTypes.FLOAT, allowNull: true },
        BSBearnedRuns: { type: DataTypes.FLOAT, allowNull: true },
        BSBbattersWalked: { type: DataTypes.FLOAT, allowNull: true },
        BSBrunsAllowed: { type: DataTypes.FLOAT, allowNull: true },
        BSBhomeRunsAllowed: { type: DataTypes.FLOAT, allowNull: true },
        BSBwins: { type: DataTypes.FLOAT, allowNull: true },
        BSBshutouts: { type: DataTypes.FLOAT, allowNull: true },
        BSBearnedRunAverage: { type: DataTypes.FLOAT, allowNull: true },
        BSBwalksHitsPerInningPitched: { type: DataTypes.FLOAT, allowNull: true },
        BSBwinPct: { type: DataTypes.FLOAT, allowNull: true },
        BSBpitcherCaughtStealingPct: { type: DataTypes.FLOAT, allowNull: true },
        BSBpitchesPerInning: { type: DataTypes.FLOAT, allowNull: true },
        BSRunSupportAverage: { type: DataTypes.FLOAT, allowNull: true },
        BSBopponentBattingAverage: { type: DataTypes.FLOAT, allowNull: true },
        BSBopponentSlugAverage: { type: DataTypes.FLOAT, allowNull: true },
        BSBopponentOnBasePct: { type: DataTypes.FLOAT, allowNull: true },
        BSBopponentOnBasePlusSlugging: { type: DataTypes.FLOAT, allowNull: true },
        BSBsavePct: { type: DataTypes.FLOAT, allowNull: true },
        BSBstrikeoutsPerNine: { type: DataTypes.FLOAT, allowNull: true },
        BSBpitcherStrikeoutToWalkRatio: { type: DataTypes.FLOAT, allowNull: true },
        BSBdoublePlays: { type: DataTypes.FLOAT, allowNull: true },
        BSBerrors: { type: DataTypes.FLOAT, allowNull: true },
        BSBpassedBalls: { type: DataTypes.FLOAT, allowNull: true },
        BSBassists: { type: DataTypes.FLOAT, allowNull: true },
        BSBputouts: { type: DataTypes.FLOAT, allowNull: true },
        BSBcatcherCaughtStealing: { type: DataTypes.FLOAT, allowNull: true },
        BSBcatcherCaughtStealingPct: { type: DataTypes.FLOAT, allowNull: true },
        BSBcatcherStolenBasesAllowed: { type: DataTypes.FLOAT, allowNull: true },
        BSBfieldingPercentage: { type: DataTypes.FLOAT, allowNull: true },
        BSBrangeFactor: { type: DataTypes.FLOAT, allowNull: true },
    });

    BaseballStats.associate = (models) => {

        BaseballStats.belongsTo(models.Games, {
            foreignKey: 'gameId',
            as: 'game'
        })

        BaseballStats.belongsTo(models.PastGames, {
            foreignKey: 'gameId',
            as: 'PastGame'
        })

        BaseballStats.belongsTo(models.Teams, {
            foreignKey: 'teamId',
            as: 'teamDetails'
        });
    }
    return BaseballStats;
}
