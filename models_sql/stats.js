module.exports = (sequelize, DataTypes) => {

    const Stats = sequelize.define('Stats', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        gameId: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        teamId: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        sport: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        data: {
          type: DataTypes.JSONB, // Flexible structure
          allowNull: true,
        },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
      }, {
        tableName: 'Stats'
      });

    Stats.associate = (models) => {
        Stats.belongsTo(models.Games, {
            foreignKey: 'gameId',
            as: 'game'
        })
        Stats.belongsTo(models.Teams, {
            foreignKey: 'teamId',
            as: 'teamDetails'
        });
    };
    return Stats;
}