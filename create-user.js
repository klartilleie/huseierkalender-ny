// Create regular user directly
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

async function createRegularUser() {
  try {
    console.log('Creating regular user...');
    const userPassword = await hashPassword('user123');
    
    // Insert regular user
    await db.insert(users).values({
      username: 'user',
      password: userPassword,
      name: 'Regular User',
      email: 'user@example.com',
      isAdmin: false
    }).execute();
    
    console.log('Regular user created successfully with:');
    console.log('Username: user');
    console.log('Password: user123');
    
  } catch (error) {
    console.error('Error creating regular user:', error);
  } finally {
    await pool.end();
  }
}

createRegularUser();