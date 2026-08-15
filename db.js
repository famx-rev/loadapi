import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
  port: 4000,
  user: '2EDLV5HMvmjV4ar.root',
  password: 'bR0VNnodsJAj9i1J',
  database: 'test',
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
  ssl: { rejectUnauthorized: true },
});

export default pool;
