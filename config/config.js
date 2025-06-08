require('dotenv').config();

const config = {
  development: {
    username: "postgres",
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST_TEST,
    dialect: "postgres"
  },
  test: {
    username: "postgres",
    password:  process.env.POSTGRES_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST_TEST,
    dialect: "postgres"
  },
  production: {
    username: "postgres",
    password:  process.env.POSTGRES_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST_PRODUCTION,
    dialect: "postgres"
  }
}

module.exports = config[process.env.NODE_ENV || 'development'];
