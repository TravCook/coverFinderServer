module.exports = (sequelize, DataTypes) => {
    const Bookmakers = sequelize.define('Bookmakers', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        gameId: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        title: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        key: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        
    });

    Bookmakers.associate = (models) => {
        Bookmakers.belongsTo(models.Games, {
            foreignKey: 'gameId',
            as: 'gameDetails'
        });

        Bookmakers.hasMany(models.Markets, {
            foreignKey: 'bookmakerId',
            as: 'markets'
        });
    }
    return Bookmakers;
}