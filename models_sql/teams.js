module.exports = (sequelize, DataTypes) => {
    const Teams = sequelize.define('Teams', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        teamName: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        logo: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        school: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        league: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        espnID: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        abbreviation: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        espnDisplayName: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        mainColor: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        secondaryColor: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        currentStats: {
          type: DataTypes.JSONB, // Flexible structure
          allowNull: true,
        },
    });

    Teams.associate = (models) => {

        Teams.hasMany(models.Games, {
            foreignKey: 'homeTeam',
            as: 'homeGames'
        });


        Teams.hasMany(models.Games, {
            foreignKey: 'awayTeam',
            as: 'awayGames'
        });


        Teams.hasMany(models.Outcomes, {
            foreignKey: 'teamId',
            as: 'outcomes'
        })

    }

    return Teams
}