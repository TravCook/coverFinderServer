module.exports = (sequelize, DataTypes) => {

    const Outcomes = sequelize.define('Outcomes', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        marketID: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        teamID: {
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
        }
    });

    Outcomes.associate = (models) => {
        Outcomes.belongsTo(models.Markets, {
            foreignKey: 'marketID',
            as: 'marketDetails'
        });

        Outcomes.belongsTo(models.Teams, {
            foreignKey: 'teamID',
            as: 'teamDetails'
        });
    };

    return Outcomes;
}