const { recreateDatabase, applySchema } = require("../../db/setup");

const TEST_DB = "pos_test";
process.env.DB_NAME = TEST_DB;

async function resetTestDb() {
  await recreateDatabase(TEST_DB);
  await applySchema(TEST_DB);
}

module.exports = { TEST_DB, resetTestDb };
