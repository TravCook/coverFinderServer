module.exports = (sequelize, DataTypes) => {

    const HyperParams = sequelize.define('HyperParams', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        bestAccuracy: {
            type: DataTypes.FLOAT,
            allowNull: false,
            defaultValue: 0.0
        },
        epochs: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        batchSize: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        kFolds: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        hiddenLayers: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        learningRate: {
            type: DataTypes.FLOAT,
            allowNull: false,
            defaultValue: 0.0
        },
        l2Reg: {
            type: DataTypes.FLOAT,
            allowNull: false,
            defaultValue: 0.0
        },
        dropoutReg: {
            type: DataTypes.FLOAT,
            allowNull: false,
            defaultValue: 0.0
        },
        kernalInitializer: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'glorotUniform'
        },
        layerNeurons: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        decayFactor: {
            type: DataTypes.FLOAT,
            allowNull: false,
            defaultValue: 0.0
        },
        gameDecayThreshold: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        sport: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        }
    });

    HyperParams.associate = (models) => {
        HyperParams.belongsTo(models.Sports, {
            foreignKey: 'sport',
            as: 'sportDetails'
        });
    }
    return HyperParams;
}