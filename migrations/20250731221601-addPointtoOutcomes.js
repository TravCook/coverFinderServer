'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Outcomes', 'point', {
      type: Sequelize.FLOAT, // or whatever type it is
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Outcomes', 'point', {
      type: Sequelize.FLOAT,
      allowNull: true,
    });
  }
};

