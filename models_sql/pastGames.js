module.exports = (sequelize, DataTypes) => {

    const PastGames = sequelize.define('PastGames', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        homeTeam: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        awayTeam: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        commence_time: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        homeTeamIndex: {
            type: DataTypes.DECIMAL,
            allowNull: false,
        },
        awayTeamIndex: {
            type: DataTypes.DECIMAL,
            allowNull: false,
        },
        homeTeamScaledIndex: {
            type: DataTypes.DECIMAL,
            allowNull: false,
        },
        awayTeamScaledIndex: {
            type: DataTypes.DECIMAL,
            allowNull: false,
        },
        winPercent: {
            type: DataTypes.DECIMAL,
            allowNull: false,
        },
        predictedWinner: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        predictionConfidence: {
            type: DataTypes.DECIMAL,
            allowNull: false,
        },
        homeScore: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        awayScore: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        timeRemaining: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        bookmakers: {
            type: DataTypes.JSON,
            allowNull: true,
        },
        homeStats: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        awayStats: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        sport: {
            type: DataTypes.INTEGER,
            allowNull: false
        }
    });

    PastGames.associate = (models) => {
        PastGames.belongsTo(models.Teams, {
            foreignKey: 'homeTeam',
            as: 'homeTeamDetails'
        });
        PastGames.belongsTo(models.Teams, {
            foreignKey: 'awayTeam',
            as: 'awayTeamDetails'
        });

        PastGames.belongsTo(models.Sports, {
            foreignKey: 'sport',
            as: 'sportDetails'
        });

    }
    return PastGames
}