const { DataTypes } = require('sequelize');
const sequelize = require('../database/connection');

const PastGames = sequelize.define('PastGames', {
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
    PastGames.belongsTo(models.Team, {
        foreignKey: 'homeTeam',
        as: 'homeTeamData'
    });
    PastGames.belongsTo(models.Team, {
        foreignKey: 'awayTeam',
        as: 'awayTeamData'
    });
    PastGames.hasMany(models.Bookmakers, {
        foreignKey: 'gameId',
        as: 'bookmakersData'
    });
    PastGames.belongsTo(models.Sport, {
        foreignKey: 'sport',
        as: 'sportData'
    });
    PastGames.hasMany(models.Baseballstats, {
        foreignKey: 'gameId',
        as: 'homeBaseballStatsData',
    });
    PastGames.hasMany(models.Basketballstats, {
        foreignKey: 'gameId',
        as: 'homeBasketballStatsData',
    });
    PastGames.hasMany(models.Hockeystats, {
        foreignKey: 'gameId',
        as: 'homeHockeyStatsData',
    });
    PastGames.hasMany(models.Usafootballstats, {
        foreignKey: 'gameId',
        as: 'homeUsafootballStatsData',
    });
    PastGames.hasMany(models.Baseballstats, {
        foreignKey: 'gameId',
        as: 'awayBaseballStatsData',
    });
    PastGames.hasMany(models.Basketballstats, {
        foreignKey: 'gameId',
        as: 'awayBasketballStatsData',
    });
    PastGames.hasMany(models.Hockeystats, {
        foreignKey: 'gameId',
        as: 'awayHockeyStatsData',
    });
    PastGames.hasMany(models.Usafootballstats, {
        foreignKey: 'gameId',
        as: 'awayUsafootballStatsData',
    });
    
}

module.exports = PastGames;