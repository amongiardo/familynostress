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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
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
