'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('Outcomes', 'teamId', {
      type: Sequelize.INTEGER, // or whatever type it is
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('Outcomes', 'teamId', {
      type: Sequelize.INTEGER,
      allowNull: false,
    });
  }
};
