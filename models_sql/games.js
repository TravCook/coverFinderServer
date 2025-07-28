const { unique } = require("@tensorflow/tfjs-node");
const { modelName } = require("../models/Odds");

module.exports = (sequelize, DataTypes) => {
    const Games = sequelize.define('Games', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        oddsApiID: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
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
            type: DataTypes.FLOAT,
            allowNull: false,
            defaultValue: 0.0
        },
        awayTeamIndex: {
            type: DataTypes.FLOAT,
            allowNull: false,
            defaultValue: 0.0
        },
        homeTeamScaledIndex: {
            type: DataTypes.FLOAT,
            allowNull: false,
            defaultValue: 0.0
        },
        awayTeamScaledIndex: {
            type: DataTypes.FLOAT,
            allowNull: false,
            defaultValue: 0.0
        },
        winPercent: {
            type: DataTypes.FLOAT,
            allowNull: false,
            defaultValue: 0.0
        },
        predictedWinner: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: ''
        },
        predictionConfidence: {
            type: DataTypes.FLOAT,
            allowNull: false,
            defaultValue: 0.0
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
        },
        predictedHomeScore: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        predictedAwayScore: {
            type: DataTypes.INTEGER,
            allowNull: true
        }
    }, {
        sequelize,
        modelName: 'Games',
        indexes: [
            {
                unique: true,
                fields: ['homeTeam', 'awayTeam', 'commence_time', 'sport']
            },
            {
                fields: ['sport_key', 'complete']
            }
        ]
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
            as: 'bookmakers',
            onDelete: 'CASCADE',
        })

        Games.hasOne(models.Stats, {
            foreignKey: 'gameId',
            as: 'homeStats',
            onDelete: 'CASCADE',
        })
        
        Games.hasOne(models.Stats, {
            foreignKey: 'gameId',
            as: 'awayStats',
            onDelete: 'CASCADE',
        })

    }
    return Games
}