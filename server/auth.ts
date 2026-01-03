import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import { Request, Response, NextFunction } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import { sendPasswordResetEmail } from "./notification";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  console.log(`Comparing passwords: supplied='${supplied}', stored format='${stored.includes(".") ? "hashed" : "plain"}'`);
  
  // For debugging purposes, allow direct password comparison
  if (supplied === stored) {
    console.log("Password matched directly!");
    return true;
  }
  
  // Only attempt crypto comparison if the password is properly formatted (has a salt)
  if (stored.includes(".")) {
    try {
      const [hashed, salt] = stored.split(".");
      if (!salt) {
        console.error("No salt found in stored password");
        return false;
      }
      
      const hashedBuf = Buffer.from(hashed, "hex");
      const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
      const match = timingSafeEqual(hashedBuf, suppliedBuf);
      console.log(`Crypto comparison result: ${match}`);
      return match;
    } catch (error) {
      console.error("Error comparing passwords:", error);
      return false;
    }
  }
  
  console.log("Password comparison failed");
  return false;
}

export async function generatePasswordResetToken(userId: number): Promise<string> {
  // Generer en unik token
  const token = randomBytes(32).toString("hex");
  
  // Sett utløpstidspunkt til 24 timer fra nå
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);
  
  // Lagre token i databasen
  await storage.createPasswordResetToken({
    userId,
    token,
    expiresAt,
  });
  
  return token;
}

export async function validatePasswordResetToken(token: string): Promise<number | null> {
  const resetToken = await storage.getPasswordResetTokenByToken(token);
  
  // Sjekk om token eksisterer, er gyldig og ikke er utløpt
  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    return null;
  }
  
  return resetToken.userId;
}

export async function markTokenAsUsed(token: string): Promise<boolean> {
  return await storage.markPasswordResetTokenAsUsed(token);
}

export function setupAuth(app: Express) {
  const sessionSecret = process.env.SESSION_SECRET || "calendar-app-session-secret";
  
  const sessionSettings: session.SessionOptions = {
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    rolling: true, // Reset cookie expiry on activity
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours instead of 1 week
      httpOnly: true, // Prevent XSS attacks
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      sameSite: 'lax', // CSRF protection
      path: '/' // Ensure cookie is available for all paths
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Maintenance mode middleware - AFTER session middleware so req.user is available
  app.use(async (req, res, next) => {
    try {
      // Allow maintenance status endpoint and admin endpoints
      if (req.path === '/api/maintenance-status' || 
          req.path.startsWith('/api/admin/maintenance') ||
          req.path === '/login' ||
          req.path === '/api/login' ||
          req.path === '/api/logout' ||
          req.path.startsWith('/api/auth/') ||
          req.method === 'OPTIONS') {
        return next();
      }

      // Check maintenance mode status
      const maintenanceSetting = await storage.getSystemSettingByKey("maintenance.enabled");
      const maintenanceEnabled = maintenanceSetting?.value;
      const isMaintenanceMode = maintenanceEnabled === 'true';
      
      // If maintenance mode is active
      if (isMaintenanceMode) {
        // For API requests
        if (req.path.startsWith('/api/')) {
          // Check if user is authenticated and is admin
          if (req.isAuthenticated && req.isAuthenticated()) {
            const user = (req as any).user;
            if (user && user.isAdmin) {
              return next(); // Allow admin API access
            }
          }
          
          // Block non-admin API access
          const messageSetting = await storage.getSystemSettingByKey("maintenance.message");
          const maintenanceMessage = messageSetting?.value || "Siden er under ombygging og vil være snart tilbake";
          return res.status(503).json({ 
            maintenance: true, 
            message: maintenanceMessage 
          });
        }
        
        // For page requests - let them through to show maintenance page on frontend
        return next();
      }
      
      next();
    } catch (error) {
      console.error('Error in maintenance mode middleware:', error);
      next(); // Continue on error to avoid breaking the system
    }
  });

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        console.log(`Attempting login for user: ${username}`);
        const user = await storage.getUserByUsername(username);
        
        if (!user) {
          console.log(`User ${username} not found`);
          return done(null, false);
        }
        
        // Log user data for debugging (don't include full password)
        console.log(`Found user: ${JSON.stringify({
          id: user.id,
          username: user.username,
          isAdmin: user.isAdmin,
          passwordLength: user.password ? user.password.length : 0
        })}`);
        
        const passwordMatches = await comparePasswords(password, user.password);
        console.log(`Password comparison result: ${passwordMatches}`);
        
        if (!passwordMatches) {
          return done(null, false);
        } else {
          // Update last login timestamp
          await storage.updateUserLastLogin(user.id);
          return done(null, user);
        }
      } catch (err) {
        console.error('Error in authentication:', err);
        return done(err);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const user = await storage.createUser({
        ...req.body,
        password: await hashPassword(req.body.password),
      });

      req.login(user, (err) => {
        if (err) return next(err);
        // Return user without password
        const { password, ...userWithoutPassword } = user;
        res.status(201).json(userWithoutPassword);
      });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: "Invalid username or password" });
      
      req.login(user, (err) => {
        if (err) return next(err);
        // Return user without password
        const { password, ...userWithoutPassword } = user;
        res.status(200).json(userWithoutPassword);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      // Return 401 but with proper headers to prevent caching
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      return res.sendStatus(401);
    }
    // Return user without password
    const { password, ...userWithoutPassword } = req.user;
    res.json(userWithoutPassword);
  });
  
  // User profile management routes
  app.put("/api/user/profile", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const { name, email } = req.body;
      
      if (!name || !email) {
        return res.status(400).json({ message: "Name and email are required" });
      }
      
      const userId = req.user!.id;
      
      storage.updateUser(userId, { name, email })
        .then(updatedUser => {
          if (!updatedUser) {
            return res.status(404).json({ message: "User not found" });
          }
          
          // Remove sensitive data before sending response
          const { password, ...safeUser } = updatedUser;
          
          res.json(safeUser);
        })
        .catch(error => {
          console.error("Error updating user profile:", error);
          res.status(500).json({ message: "Failed to update profile" });
        });
    } catch (error) {
      console.error("Error in profile update route:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });
  
  app.put("/api/user/password", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current password and new password are required" });
      }
      
      const userId = req.user!.id;
      
      // Verify current password
      storage.getUser(userId)
        .then(async user => {
          if (!user) {
            return res.status(404).json({ message: "User not found" });
          }
          
          const passwordMatch = await comparePasswords(currentPassword, user.password);
          
          if (!passwordMatch) {
            return res.status(400).json({ message: "Current password is incorrect" });
          }
          
          // Update password
          const hashedPassword = await hashPassword(newPassword);
          const updatedUser = await storage.updateUser(userId, { password: hashedPassword });
          
          if (!updatedUser) {
            return res.status(404).json({ message: "User not found" });
          }
          
          res.json({ message: "Password updated successfully" });
        })
        .catch(error => {
          console.error("Error updating password:", error);
          res.status(500).json({ message: "Failed to update password" });
        });
    } catch (error) {
      console.error("Error in password update route:", error);
      res.status(500).json({ message: "Failed to update password" });
    }
  });
  
  app.delete("/api/user/account", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const userId = req.user!.id;
      
      // Use Promise.all to handle deletions in parallel
      Promise.all([
        // Get and delete user's events
        storage.getEvents(userId).then(events => 
          Promise.all(events.map(event => storage.deleteEvent(event.id)))
        ),
        
        // Get and delete user's iCal feeds
        storage.getIcalFeeds(userId).then(feeds => 
          Promise.all(feeds.map(feed => storage.deleteIcalFeed(feed.id)))
        )
      ])
      .then(() => storage.deleteUser(userId))
      .then(result => {
        if (!result) {
          return res.status(404).json({ message: "User not found" });
        }
        
        req.logout(err => {
          if (err) {
            return res.status(500).json({ message: "Failed to logout after account deletion" });
          }
          res.json({ message: "Account deleted successfully" });
        });
      })
      .catch(error => {
        console.error("Error deleting account:", error);
        res.status(500).json({ message: "Failed to delete account" });
      });
    } catch (error) {
      console.error("Error in account deletion route:", error);
      res.status(500).json({ message: "Failed to delete account" });
    }
  });
}
