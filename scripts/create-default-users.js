// Script to create default admin and regular users
const { pool, db } = require('../server/db');
const { users } = require('../shared/schema');
const crypto = require('crypto');
const { eq } = require('drizzle-orm');

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
    console.log('Checking if users already exist...');
    
    // Check if admin exists
    const existingAdmin = await db.select().from(users).where(eq(users.username, 'admin')).execute();
    if (existingAdmin.length === 0) {
      console.log('Creating admin user...');
      const adminPassword = await hashPassword('admin123');
      await db.insert(users).values({
        username: 'admin',
        password: adminPassword,
        name: 'Administrator',
        email: 'admin@example.com',
        isAdmin: true
      }).execute();
      console.log('Admin user created successfully');
    } else {
      console.log('Admin user already exists');
    }
    
    // Check if regular user exists
    const existingUser = await db.select().from(users).where(eq(users.username, 'user')).execute();
    if (existingUser.length === 0) {
      console.log('Creating regular user...');
      const userPassword = await hashPassword('user123');
      await db.insert(users).values({
        username: 'user',
        password: userPassword,
        name: 'Regular User',
        email: 'user@example.com',
        isAdmin: false
      }).execute();
      console.log('Regular user created successfully');
    } else {
      console.log('Regular user already exists');
    }

    console.log('\nDefault users created with the following credentials:');
    console.log('Admin User:');
    console.log('  Username: admin');
    console.log('  Password: admin123');
    console.log('\nRegular User:');
    console.log('  Username: user');
    console.log('  Password: user123');
    
  } catch (error) {
    console.error('Error creating users:', error);
  } finally {
    // Close the database connection
    await pool.end();
  }
}

createUsers();