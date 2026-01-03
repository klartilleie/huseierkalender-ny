import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';
import { pool } from './server/db.js';

const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString('hex')}.${salt}`;
}

async function updateAdminUser() {
  try {
    // Krypter passordet
    const hashedPassword = await hashPassword('admin2025');
    
    // Oppdater admin brukernavn og passord
    const result = await pool.query(
      `UPDATE users 
       SET username = $1, password = $2 
       WHERE id = 3 RETURNING *`,
      ['kundeservice@smarthjem.as', hashedPassword]
    );
    
    if (result.rows.length > 0) {
      console.log('Admin bruker oppdatert:');
      console.log('Brukernavn:', result.rows[0].username);
      console.log('Navn:', result.rows[0].name);
      console.log('E-post:', result.rows[0].email);
      console.log('Admin:', result.rows[0].is_admin);
    } else {
      console.log('Ingen bruker ble oppdatert');
    }
  } catch (error) {
    console.error('Feil ved oppdatering av admin bruker:', error);
  } finally {
    // Lukk pool-tilkoblingen
    pool.end();
  }
}

// Kjør funksjonen
updateAdminUser();