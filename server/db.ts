import pg from "pg";
const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined, // depending on the easypanel setup
});

// Test the connection immediately
pool.connect((err, client, release) => {
  if (err) {
    console.error("Error acquiring client from postgres pool", err.stack);
  } else {
    console.log("PostgreSQL connected successfully via Pool.");
    release();
  }
});
