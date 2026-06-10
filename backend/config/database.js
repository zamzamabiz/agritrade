import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
console.log("DATABASE_URL: ", connectionString ? "✅ Found" : "❌ Not Found");
console.log("Full DATABASE_URL: ", connectionString);

if (!connectionString) {
  throw new Error('DATABASE_URL is required. Please set it in your .env file.');
}

console.log('🔌 Connecting to database...');

// Create PostgreSQL client with connection pooling
const sql = postgres(connectionString, {
  max: 8,           // Maximum number of connections
  idle_timeout: 1000,  // Close idle connections after 1000 milliseconds
  connect_timeout: 20, // Timeout after 20 seconds
  types: {
    // Handle JSON/JSONB properly
    json: {
      to: 3802,
      from: [3802],
      serialize: (value) => JSON.stringify(value),
      parse: (value) => JSON.parse(value)
    }
  },
  onnotice: (notice) => {
    console.log('📢 Database notice:', notice.message);
  }
});

// Test connection on startup
sql`
  SELECT current_database() as db, current_user as user
`.then((result) => {
  console.log(`✅ Database connected successfully!`);
}).catch((error) => {
  console.error('❌ Database connection failed:', error.message);
  process.exit(1);
});

export default sql;