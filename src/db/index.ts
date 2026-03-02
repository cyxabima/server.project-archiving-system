import { Pool } from "pg";
import 'dotenv/config';


const pool = new Pool({
  //  connectionString: process.env.DATABASE_URL,
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DATABASE,
  port: Number(process.env.DB_PORT),
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  maxLifetimeSeconds: 60
});

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err)
  process.exit(-1)
});

// i am writing simple example for writing sql for future refernecnce
// ; (async () => {
//   console.log(process.env.DATABASE_URL)
//   const res = await pool.query('SELECT * FROM users')
//   console.log('user:', res.rows[0])
// })();


export default pool;

