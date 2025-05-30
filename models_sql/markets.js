module.exports = (sequelize, DataTypes) => {

    const Markets = sequelize.define('Markets', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        bookmakerID: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        key: {
            type: DataTypes.STRING,
            allowNull: false,
        }
    });

    Markets.associate = (models) => {
        Markets.belongsTo(models.Bookmakers, {
            foreignKey: 'bookmakerID',
            as: 'bookmakerDetails'
        });

        Markets.hasMany(models.Outcomes, {
            foreignKey: 'marketID',
            as: 'outcomes'
        });
    };
    return Markets;
}