module.exports = (sequelize, DataTypes) => {
    const Sports = sequelize.define('Sports', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
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
            allowNull: true,
        },
        sigmoidIQRSharpness: {
            type: DataTypes.FLOAT,
            allowNull: true,
        },
        averageIndex: {
            type: DataTypes.FLOAT,
            allowNull: true,
        }
    });

    Sports.associate = (models) => {
        Sports.hasMany(models.Games, {
            foreignKey: 'sport',
            as: 'games'
        })
        Sports.hasMany(models.PastGames, {
            foreignKey: 'sport',
            as: 'pastGames'
        })
        Sports.hasMany(models.ValueBetSettings, {
            foreignKey: 'sport',
            as: 'valueBetSettings'
        })
        Sports.hasOne(models.MlModelWeights, {
            foreignKey: 'sport',
            as: 'MlModelWeights'
        })
        Sports.hasMany(models.HyperParams, {
            foreignKey: 'sport',
            as: 'hyperParams'
        })
        Sports.hasMany(models.Bookmakers, {
            foreignKey: 'sport',
            as: 'bookmakers'
        })
    }
    return Sports
}