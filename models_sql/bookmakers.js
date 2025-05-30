module.exports = (sequelize, DataTypes) => {
    const Bookmakers = sequelize.define('Bookmakers', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        gameID: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        key: {
            type: DataTypes.STRING,
            allowNull: false,
        }
    });

    Bookmakers.associate = (models) => {
        Bookmakers.belongsTo(models.Games, {
            foreignKey: 'gameID',
            as: 'gameDetails'
        });

        Bookmakers.belongsTo(models.PastGames, {
            foreignKey: 'gameID',
            as: 'pastGameDetails'
        });

        Bookmakers.hasMany(models.Markets, {
            foreignKey: 'bookmakerID',
            as: 'markets'
        });
    }
    return Bookmakers;
}