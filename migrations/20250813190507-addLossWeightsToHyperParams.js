'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('HyperParams', 'scoreLoss', {
      type: Sequelize.FLOAT, // or whatever type it is
      allowNull: false,
      defaultValue: 1.0 // Set a default value if needed
    });
    await queryInterface.addColumn('HyperParams', 'winPctLoss', {
      type: Sequelize.FLOAT, // or whatever type it is
      allowNull: false,
      defaultValue: 1.0 // Set a default value if needed
    });
    await queryInterface.addColumn('HyperParams', 'earlyStopPatience', {
      type: Sequelize.INTEGER, // or whatever type it is
      allowNull: false,
      defaultValue: 10 // Set a default value if needed
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('HyperParams', 'scoreLoss', {
      type: Sequelize.FLOAT, // or whatever type it is
      allowNull: false,
      defaultValue: 1.0 // Set a default value if needed
    });
    await queryInterface.removeColumn('HyperParams', 'winPctLoss', {
      type: Sequelize.FLOAT, // or whatever type it is
      allowNull: false,
      defaultValue: 1.0 // Set a default value if needed
    });
    await queryInterface.removeColumn('HyperParams', 'earlyStopPatience', {
      type: Sequelize.INTEGER, // or whatever type it is
      allowNull: false,
      defaultValue: 10 // Set a default value if needed
    });
  }
};
