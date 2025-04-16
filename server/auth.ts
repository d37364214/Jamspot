import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

// Crée un utilisateur administrateur si celui-ci n'existe pas
async function createAdminUserIfNotExists() {
  try {
    const adminUsername = "Admin";
    console.log("Vérification de l'existence du compte administrateur:", adminUsername);
    
    const existingAdmin = await storage.getUserByUsername(adminUsername);
    
    if (!existingAdmin) {
      console.log("Création du compte administrateur par défaut");
      const hashedPassword = await hashPassword("admin");
      const admin = await storage.createUser({
        username: adminUsername,
        password: hashedPassword,
        isAdmin: true
      });
      console.log("Compte administrateur créé avec succès:", admin);
      return admin;
    } else {
      console.log("Compte administrateur existant trouvé:", existingAdmin.username);
      return existingAdmin;
    }
  } catch (error) {
    console.error("Erreur lors de la création du compte administrateur:", error);
    throw error;
  }
}

export function setupAuth(app: Express) {
  // Création de l'administrateur par défaut
  createAdminUserIfNotExists().catch(err => {
    console.error("Erreur lors de la création du compte admin:", err);
  });
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      const user = await storage.getUserByUsername(username);
      if (!user || !(await comparePasswords(password, user.password))) {
        return done(null, false);
      } else {
        return done(null, user);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    const user = await storage.getUser(id);
    done(null, user);
  });

  app.post("/api/register", async (req, res, next) => {
    const existingUser = await storage.getUserByUsername(req.body.username);
    if (existingUser) {
      return res.status(400).send("Username already exists");
    }

    const user = await storage.createUser({
      ...req.body,
      password: await hashPassword(req.body.password),
    });

    req.login(user, (err) => {
      if (err) return next(err);
      res.status(201).json(user);
    });
  });

  app.post("/api/login", (req, res, next) => {
    console.log("Tentative de connexion pour l'utilisateur:", req.body.username);
    
    passport.authenticate("local", (err: any, user: Express.User | false, info: any) => {
      if (err) {
        console.error("Erreur d'authentification:", err);
        return next(err);
      }
      
      if (!user) {
        console.error("Échec d'authentification pour l'utilisateur:", req.body.username);
        return res.status(401).json({ message: "Identifiants invalides" });
      }
      
      req.login(user, (err) => {
        if (err) {
          console.error("Erreur lors de la connexion:", err);
          return next(err);
        }
        console.log("Utilisateur connecté avec succès:", user.username);
        return res.status(200).json(user);
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
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(req.user);
  });
}
