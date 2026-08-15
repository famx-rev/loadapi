import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: 'reva-reva.b.aivencloud.com',
  port: 11703,
  user: 'avnadmin',
  password: 'AVNS_RXK6Q8dM3mKo9IHkuk7',
  database: 'test',
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
  ssl: { rejectUnauthorized: false },
});

export default pool;
