'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
   await queryInterface.addColumn('Teams', 'statIndex', {
      type: Sequelize.DOUBLE,
      allowNull: true,
    });

    await queryInterface.addColumn('Teams', 'statCategoryIndexes', {
      type: Sequelize.JSONB, // Flexible structure for multiple categories
      allowNull: true,
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('Teams', 'statIndex', {
      type: Sequelize.DOUBLE,
      allowNull: true,
    });

    await queryInterface.removeColumn('Teams', 'statCategoryIndexes', {
      type: Sequelize.JSONB, // Flexible structure for multiple categories
      allowNull: true,
    });
  }
};
