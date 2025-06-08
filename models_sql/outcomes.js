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