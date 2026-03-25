import dotenv from 'dotenv';
import express from 'express';
import session from 'express-session';
import cors from 'cors';
import passport from 'passport';
import pgSession from 'connect-pg-simple';
import { configurePassport } from './config/passport';

import authRoutes from './routes/auth';
import familyRoutes from './routes/family';
import dishesRoutes from './routes/dishes';
import mealsRoutes from './routes/meals';
import suggestionsRoutes from './routes/suggestions';
import shoppingRoutes from './routes/shopping';
import weatherRoutes from './routes/weather';
import statsRoutes from './routes/stats';
import notificationsRoutes from './routes/notifications';
import chatRoutes from './routes/chat';
import advancedRoutes from './routes/advanced';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.set('trust proxy', 1);
app.use(express.json());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })
);

// Session configuration
const PgSession = pgSession(session);
app.use(
  session({
    store: new PgSession({
      conString: process.env.DATABASE_URL,
      tableName: 'user_sessions',
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    },
  })
);

// Passport
configurePassport();
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use('/auth', authRoutes);
app.use('/api/family', familyRoutes);
app.use('/api/dishes', dishesRoutes);
app.use('/api/meals', mealsRoutes);
app.use('/api/suggestions', suggestionsRoutes);
app.use('/api/shopping', shoppingRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/advanced', advancedRoutes);

app.get('/', (req, res) => {
  res.type('html').send(`<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>FamilyNoStress API</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f4efe6;
      --card: #fffaf2;
      --text: #1f2a1f;
      --muted: #5f6b5f;
      --accent: #2c7a51;
      --border: #d9cfbf;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
      background:
        radial-gradient(circle at top, rgba(44, 122, 81, 0.12), transparent 30%),
        linear-gradient(180deg, var(--bg), #efe7db);
      font-family: Georgia, "Times New Roman", serif;
      color: var(--text);
    }
    main {
      max-width: 560px;
      width: 100%;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 32px;
      box-shadow: 0 18px 50px rgba(70, 54, 32, 0.12);
    }
    h1 {
      margin: 0 0 10px;
      font-size: 2rem;
      line-height: 1.1;
    }
    p {
      margin: 0 0 14px;
      color: var(--muted);
      font-size: 1rem;
      line-height: 1.6;
    }
    .badge {
      display: inline-block;
      margin-bottom: 18px;
      padding: 6px 12px;
      border-radius: 999px;
      background: rgba(44, 122, 81, 0.12);
      color: var(--accent);
      font-size: 0.9rem;
      font-weight: 700;
      letter-spacing: 0.03em;
      text-transform: uppercase;
    }
    a {
      color: var(--accent);
      text-decoration: none;
      font-weight: 700;
    }
    a:hover { text-decoration: underline; }
    code {
      font-family: "SFMono-Regular", Consolas, monospace;
      font-size: 0.95em;
    }
  </style>
</head>
<body>
  <main>
    <div class="badge">API attiva</div>
    <h1>FamilyNoStress API</h1>
    <p>Questo subdominio espone il backend applicativo di FamilyNoStress.</p>
    <p>Se stai facendo un controllo tecnico, l'endpoint di stato è <a href="/health"><code>/health</code></a>.</p>
    <p>Per usare l'applicazione vai su <a href="https://familynostress.com">familynostress.com</a>.</p>
  </main>
</body>
</html>`);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
