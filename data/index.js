const sql = require('mssql');
const { insertData } = require('./insert.js');
require('dotenv').config();


const config = {
	user: process.env.SQL_USER,
	password: process.env.SQL_PASS,
	database: process.env.SQL_DATABASE,
	server: process.env.SQL_SERVER,
	options: {
		enableArithAbort: true,
	},
};

const poolPromise = new sql.ConnectionPool(config)
	.connect()
	.then(pool => {
		return pool;
	})
	.catch(err => console.log('Database Connection Failed! Bad Config: ', err));

module.exports = {
	sql, poolPromise, insertData,
};