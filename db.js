import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
  port: 4000,
  user: 'KWUGWJ75TQhhbcs.root',
  password: 'Z1KHkkGcVt54krse',
  database: 'test',
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
  ssl: { rejectUnauthorized: true },
});

export default pool;
