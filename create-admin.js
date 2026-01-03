// Create admin user directly
const { pool, db } = require('./server/db');
const { users } = require('./shared/schema');
const crypto = require('crypto');
const { eq } = require('drizzle-orm');

async function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      resolve(`${derivedKey.toString('hex')}.${salt}`);
    });
  });
}

async function createAdminUser() {
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
    }).execute();
    
    console.log('Admin user created successfully with:');
    console.log('Username: admin');
    console.log('Password: admin123');
    
  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    await pool.end();
  }
}

createAdminUser();