import { pool } from "./db";

// Clean up expired sessions from the database
export async function cleanupExpiredSessions(): Promise<number> {
  try {
    const result = await pool.query(
      `DELETE FROM session 
       WHERE expire < NOW() 
       RETURNING sid`
    );
    
    const deletedCount = result.rowCount || 0;
    if (deletedCount > 0) {
      console.log(`Cleaned up ${deletedCount} expired sessions`);
    }
    return deletedCount;
  } catch (error) {
    console.error('Error cleaning up sessions:', error);
    return 0;
  }
}

// Clean up sessions older than specified days
export async function cleanupOldSessions(daysOld: number = 7): Promise<number> {
  try {
    const result = await pool.query(
      `DELETE FROM session 
       WHERE expire < NOW() - INTERVAL '${daysOld} days'
       RETURNING sid`
    );
    
    const deletedCount = result.rowCount || 0;
    if (deletedCount > 0) {
      console.log(`Cleaned up ${deletedCount} sessions older than ${daysOld} days`);
    }
    return deletedCount;
  } catch (error) {
    console.error('Error cleaning up old sessions:', error);
    return 0;
  }
}

// Schedule automatic session cleanup
export function scheduleSessionCleanup(): NodeJS.Timeout {
  // Run cleanup every hour
  const interval = setInterval(async () => {
    await cleanupExpiredSessions();
    // Also clean up very old sessions (older than 30 days)
    await cleanupOldSessions(30);
  }, 60 * 60 * 1000); // 1 hour

  // Run initial cleanup
  cleanupExpiredSessions();
  
  console.log('Scheduled automatic session cleanup (runs every hour)');
  
  return interval;
}