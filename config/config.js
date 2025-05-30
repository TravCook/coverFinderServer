require('dotenv').config();

const config = {
  development: {
    username: "root",
    password: process.env.MYSQL_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST_TEST,
    dialect: "mysql"
  },
  test: {
    username: "root",
    password:  process.env.MYSQL_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST_TEST,
    dialect: "mysql"
  },
  production: {
    username: "root",
    password:  process.env.MYSQL_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST_PRODUCTION,
    dialect: "mysql"
  }
}

module.exports = config[process.env.NODE_ENV || 'development'];
