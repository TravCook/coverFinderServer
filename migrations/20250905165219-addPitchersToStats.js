'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Teams', 'pitcherStats', {
      type: Sequelize.JSONB, // or whatever type it is
      allowNull: true,
    });
    await queryInterface.addColumn('Games', 'probablePitcher', {
      type: Sequelize.JSONB, // or whatever type it is
      allowNull: true,
    });

  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Teams', 'pitcherStats', {
      type: Sequelize.JSONB, // or whatever type it is
      allowNull: true,
    });
    await queryInterface.removeColumn('Games', 'probablePitcher', {
      type: Sequelize.JSONB, // or whatever type it is
      allowNull: true,
    });
  }
};
