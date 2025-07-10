module.exports = (sequelize, DataTypes) => {

const MlModelWeights = sequelize.define('MlModelWeights', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    featureImportanceScores: {
        type: DataTypes.JSON,
        allowNull: true
    },
    hiddenToOutputWeights: {
        type: DataTypes.JSON,
        allowNull: true
    },
    inputToHiddenWeights: {
        type: DataTypes.JSON,
        allowNull: true
    },
    sport:{
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'Sports',
            key: 'id'
        }
    }
}, 
{
    tableName: 'MlModelWeights',
    timestamps: true,
    indexes: [
        {
            unique: true,
            fields: ['sport']
        }
    ]
});

MlModelWeights.associate = (models) => {
    MlModelWeights.belongsTo(models.Sports, {
        foreignKey: 'sport',
        as: 'MlModelWeights'
    })
}

return MlModelWeights;
}