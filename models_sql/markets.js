module.exports = (sequelize, DataTypes) => {

    const Markets = sequelize.define('Markets', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        bookmakerId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'Bookmakers',
                key: 'id'
            },
            onDelete: 'CASCADE', // If a bookmaker is deleted, delete associated markets
        },
        key: {
            type: DataTypes.STRING,
            allowNull: false,
        },
    },{
        sequelize,
        modelName: 'Markets',
        indexes: [
            {
                unique: true,
                fields: ['bookmakerId', 'key']
            }
        ]
    });

    Markets.associate = (models) => {
        Markets.belongsTo(models.Bookmakers, {
            foreignKey: 'bookmakerId',
            as: 'bookmakerDetails'
        });

        Markets.hasMany(models.Outcomes, {
            foreignKey: 'marketId',
            as: 'outcomes',
            onDelete: 'CASCADE',
        });
    };
    return Markets;
}