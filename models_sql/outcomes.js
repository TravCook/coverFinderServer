module.exports = (sequelize, DataTypes) => {

    const Outcomes = sequelize.define('Outcomes', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        marketId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'Markets',
                key: 'id'
            },
            onDelete: 'CASCADE', // If a market is deleted, delete associated outcomes
        },
        teamId: {
            type: DataTypes.INTEGER,
            allowNull: true, // Allow null for non-team outcomes
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        price: {
            type: DataTypes.FLOAT,
            allowNull: false,
        },
        impliedProbability: {
            type: DataTypes.FLOAT,
            allowNull: false,
        },
        
    },{
        sequelize,
        modelName: 'Outcomes',
        indexes: [
            {
                unique: true,
                fields: ['marketId', 'teamId', 'name']
            }
        ]
    });

    Outcomes.associate = (models) => {
        Outcomes.belongsTo(models.Markets, {
            foreignKey: 'marketId',
            as: 'marketDetails'
        });

        Outcomes.belongsTo(models.Teams, {
            foreignKey: 'teamId',
            as: 'teamDetails'
        });
    };

    return Outcomes;
}