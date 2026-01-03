// Create users directly with ES modules
import { pool, db } from './server/db.js';
import { users } from './shared/schema.js';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';

// Password hashing function (same as used in auth.ts)
async function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      resolve(`${derivedKey.toString('hex')}.${salt}`);
    });
  });
}

async function createUsers() {
  try {
    console.log('Creating admin user...');
    const adminPassword = await hashPassword('admin123');
    
    // Insert admin user
    await db.insert(users).values({
      username: 'admin',
      password: adminPassword,
      name: 'Administrator',
      email: 'admin@example.com',
      isAdmin: true
    });
    
    console.log('Creating regular user...');
    const userPassword = await hashPassword('user123');
    
    // Insert regular user
    await db.insert(users).values({
      username: 'user',
      password: userPassword,
      name: 'Regular User',
      email: 'user@example.com',
      isAdmin: false
    });
    
    console.log('\nUsers created with the following credentials:');
    console.log('Admin User:');
    console.log('  Username: admin');
    console.log('  Password: admin123');
    console.log('\nRegular User:');
    console.log('  Username: user');
    console.log('  Password: user123');
  } catch (error) {
    console.error('Error creating users:', error);
  } finally {
    await pool.end();
  }
}

createUsers();