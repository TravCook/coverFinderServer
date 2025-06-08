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
        sport_title: {
            type: DataTypes.STRING,
            allowNull: false
        },
        sport_key: {
            type: DataTypes.STRING,
            allowNull: false
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
        predictionCorrect: {
            type: DataTypes.BOOLEAN,
            allowNull: true,
        },
        winner: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        complete: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            default: false
        }
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

        Games.hasMany(models.Bookmakers, {
            foreignKey: 'gameId',
            as: 'bookmakers'
        })

        Games.hasOne(models.Stats, {
            foreignKey: 'gameId',
            as: 'homeStats'
        })
        
        Games.hasOne(models.Stats, {
            foreignKey: 'gameId',
            as: 'awayStats'
        })

    }
    return Games
}