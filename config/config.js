require('dotenv').config();

const config = {
  local: {
    username: "postgres",
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST_TEST,
    dialect: "postgres",
    logging: false
  },
  development: {
    username: "postgres",
    password: process.env.POSTGRES_PASSWORD_DEVELOPMENT,
    database: process.env.DB_NAME_DEVELOPMENT,
    host: process.env.DB_HOST_DEVELOPMENT,
    dialect: "postgres",
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false // This is important for self-signed certificates
      }
    },
    logging: false
  },
  test: {
    username: "postgres",
    password:  process.env.POSTGRES_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST_TEST,
    dialect: "postgres",
    logging: false
  },
  production: {
    username: "postgres",
    password:  process.env.POSTGRES_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST_PRODUCTION,
    dialect: "postgres",
    logging: false
  }
}

module.exports = config[process.env.NODE_ENV || 'development'];
