module.exports = (sequelize, DataTypes) => {
    const ValueBetSettings = sequelize.define('ValueBetSettings', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    indexDiffSmall: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0.0
    },
    indexDiffRange: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0.0
    },
    confidenceSmall: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0.0
    },
    confidenceRange: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0.0
    },
    bestWinrate: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0.0
    },
    bestTotalGames: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    bestConfidenceInterval:{
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {}
    },
    bookmaker: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: ''
    },
    sport: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
});

ValueBetSettings.associate = (models) => {
    ValueBetSettings.belongsTo(models.Sports, {
        foreignKey: 'sport',
        as: 'sportDetails'
    })
}
return ValueBetSettings;
}