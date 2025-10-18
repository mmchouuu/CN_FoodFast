const { Sequelize } = require("sequelize");

/**
 * Tạo kết nối Sequelize cho service
 */
function createSequelize({ db, user, pass, host, port }) {
  return new Sequelize(db, user, pass, {
    host,
    port,
    dialect: "postgres",
    logging: false
  });
}

async function testConnection(sequelize) {
  try {
    await sequelize.authenticate();
    console.log("Database connected successfully.");
  } catch (err) {
    console.error("Unable to connect to DB:", err);
    process.exit(1);
  }
}

module.exports = { createSequelize, testConnection };
