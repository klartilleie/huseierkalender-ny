// ES module script to create users with proper password hashing
import crypto from 'crypto';
import { promisify } from 'util';
import { createPool } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
dotenv.config();

// Password hashing function (same as used in auth.ts)
const scryptAsync = promisify(crypto.scrypt);

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const buffer = await scryptAsync(password, salt, 64);
  return `${buffer.toString('hex')}.${salt}`;
}

async function createUsers() {
  // Connect to database
  const pool = createPool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('Creating admin user...');
    // Hash the password exactly as in the application
    const adminPassword = await hashPassword('admin123');
    
    // Create admin user
    await pool.query(`
      INSERT INTO users (username, password, name, email, is_admin)
      VALUES ('admin', $1, 'Administrator', 'admin@example.com', true)
    `, [adminPassword]);
    
    console.log('Creating regular user...');
    const userPassword = await hashPassword('user123');
    
    // Create regular user
    await pool.query(`
      INSERT INTO users (username, password, name, email, is_admin)
      VALUES ('user', $1, 'Regular User', 'user@example.com', false)
    `, [userPassword]);
    
    console.log('Users created successfully!');
    console.log('Admin user: username = admin, password = admin123');
    console.log('Regular user: username = user, password = user123');
    
  } catch (error) {
    console.error('Error creating users:', error);
  } finally {
    // Close the connection
    await pool.end();
  }
}

createUsers().catch(console.error);