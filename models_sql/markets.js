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
        },
        key: {
            type: DataTypes.STRING,
            allowNull: false,
        },
    });

    Markets.associate = (models) => {
        Markets.belongsTo(models.Bookmakers, {
            foreignKey: 'bookmakerId',
            as: 'bookmakerDetails'
        });

        Markets.hasMany(models.Outcomes, {
            foreignKey: 'marketId',
            as: 'outcomes'
        });
    };
    return Markets;
}