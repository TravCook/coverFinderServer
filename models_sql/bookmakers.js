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
            references: {
                model: 'Games',
                key: 'id'
            },
            onDelete: 'CASCADE', // If a game is deleted, delete associated bookmakers
        },
        title: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        key: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        
    },{
        sequelize,
        modelName: 'Bookmakers',
        indexes: [
            {
                unique: true,
                fields: ['gameId', 'key']
            }
        ]
    });

    Bookmakers.associate = (models) => {
        Bookmakers.belongsTo(models.Games, {
            foreignKey: 'gameId',
            as: 'gameDetails'
        });

        Bookmakers.hasMany(models.Markets, {
            foreignKey: 'bookmakerId',
            as: 'markets',
            onDelete: 'CASCADE',
        });
    }
    return Bookmakers;
}