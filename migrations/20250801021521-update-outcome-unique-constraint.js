'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Remove the old constraint
    await queryInterface.removeIndex('Outcomes', ['marketId', 'teamId', 'name']);

    // Add the new constraint
    await queryInterface.addIndex('Outcomes', ['marketId', 'name'], {
      unique: true,
    });
  },

  async down(queryInterface, Sequelize) {
    // Revert back to the original constraint
    await queryInterface.removeIndex('Outcomes', ['marketId', 'name']);
    await queryInterface.addIndex('Outcomes', ['marketId', 'teamId', 'name'], {
      unique: true,
    });
  },
};

