const { DataTypes } = require('sequelize');
const sequelize = require('../database/connection');

const Games = sequelize.define('Games', {
    id : {
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
    }
});

Games.associate = (models) => {
    Games.belongsTo(models.Team, {
        foreignKey: 'homeTeam',
        as: 'homeTeamData'
    });
    Games.belongsTo(models.Team, {
        foreignKey: 'awayTeam',
        as: 'awayTeamData'
    });
    Games.hasMany(models.Bookmakers, {
        foreignKey: 'gameId',
        as: 'bookmakersData'
    });
    Games.belongsTo(models.Sport, {
        foreignKey: 'sport',
        as: 'sportData'
    });
    Games.hasMany(models.Baseballstats, {
        foreignKey: 'gameId',
        as: 'homeBaseballStatsData',
    });
    Games.hasMany(models.Basketballstats, {
        foreignKey: 'gameId',
        as: 'homeBasketballStatsData',
    });
    Games.hasMany(models.Hockeystats, {
        foreignKey: 'gameId',
        as: 'homeHockeyStatsData',
    });
    Games.hasMany(models.Usafootballstats, {
        foreignKey: 'gameId',
        as: 'homeUsafootballStatsData',
    });
    Games.hasMany(models.Baseballstats, {
        foreignKey: 'gameId',
        as: 'awayBaseballStatsData',
    });
    Games.hasMany(models.Basketballstats, {
        foreignKey: 'gameId',
        as: 'awayBasketballStatsData',
    });
    Games.hasMany(models.Hockeystats, {
        foreignKey: 'gameId',
        as: 'awayHockeyStatsData',
    });
    Games.hasMany(models.Usafootballstats, {
        foreignKey: 'gameId',
        as: 'awayUsafootballStatsData',
    });
    
}

module.exports = Games;