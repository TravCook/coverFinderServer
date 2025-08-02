'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('HyperParams', 'scoreMAE', {
      type: Sequelize.FLOAT, // or whatever type it is
      allowNull: true,
    });
    await queryInterface.addColumn('HyperParams', 'spreadMAE', {
      type: Sequelize.FLOAT, // or whatever type it is
      allowNull: true,
    });
    await queryInterface.addColumn('HyperParams', 'totalMAE', {
      type: Sequelize.FLOAT, // or whatever type it is
      allowNull: true,
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('HyperParams', 'scoreMAE', {
      type: Sequelize.FLOAT, // or whatever type it is
      allowNull: true,
    });
    await queryInterface.removeColumn('HyperParams', 'spreadMAE', {
      type: Sequelize.FLOAT, // or whatever type it is
      allowNull: true,
    });
    await queryInterface.removeColumn('HyperParams', 'totalMAE', {
      type: Sequelize.FLOAT, // or whatever type it is
      allowNull: true,
    });
  }
};
