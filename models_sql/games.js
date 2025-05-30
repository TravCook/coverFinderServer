module.exports = (sequelize, DataTypes) => {
    const Games = sequelize.define('Games', {
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
        sport: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        homeStats: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        awayStats: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
    });

    Games.associate = (models) => {

        Games.belongsTo(models.Teams, {
            foreignKey: 'homeTeam',
            as: 'homeTeamDetails'
        });
        Games.belongsTo(models.Teams, {
            foreignKey: 'awayTeam',
            as: 'awayTeamDetails'
        });

        Games.belongsTo(models.Sports, {
            foreignKey: 'sport',
            as: 'sportDetails'
        });

        Games.belongsTo(models.BaseballStats, {
            foreignKey: 'homeStats',
            as: 'homeBaseballStatsDetails'
        })
        Games.belongsTo(models.BasketballStats, {
            foreignKey: 'homeStats',
            as: 'homeBasketballStatsDetails'
        })
        Games.belongsTo(models.HockeyStats, {
            foreignKey: 'homeStats',
            as: 'homeHockeyStatsDetails'
        })
        Games.belongsTo(models.UsaFootballStats, {
            foreignKey: 'homeStats',
            as: 'homeUsaFootballStatsDetails'
        })

        Games.belongsTo(models.BaseballStats, {
            foreignKey: 'awayStats',
            as: 'awayBaseballStatsDetails'
        })
        Games.belongsTo(models.BasketballStats, {
            foreignKey: 'awayStats',
            as: 'awayBasketballStatsDetails'
        })
        Games.belongsTo(models.HockeyStats, {
            foreignKey: 'awayStats',
            as: 'awayHockeyStatsDetails'
        })
        Games.belongsTo(models.UsaFootballStats, {
            foreignKey: 'awayStats',
            as: 'awayUsaFootballStatsDetails'
        })
    }
    return Games
}