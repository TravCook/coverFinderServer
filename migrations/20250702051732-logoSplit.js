'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('Teams', 'lightLogo', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('Teams', 'darkLogo', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.removeColumn('Teams', 'logo', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('Teams', 'lightLogo', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.removeColumn('Teams', 'darkLogo', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('Teams', 'logo', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  }
};
