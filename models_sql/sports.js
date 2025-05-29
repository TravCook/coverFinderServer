const { DataTypes } = require('sequelize');
const sequelize = require('../database/connection');

const Sports = sequelize.define('Sports', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    espnSport: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    league: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    startMonth: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    endMonth: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    multiYear: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
    },
    statYear: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    prevStatYear: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    sigmoidIQRSharpness: {
        type: DataTypes.FLOAT,
        allowNull: false,
    },
    averageIndex: {
        type: DataTypes.FLOAT,
        allowNull: false,
    }, 
    mlModelWeights: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    hyperParams: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    valueBetSettings: {
        type: DataTypes.JSON,
        allowNull: false,
    }
});

module.exports = Sports;