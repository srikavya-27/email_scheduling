import { Router, type Request, type Response, type NextFunction } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import session from 'express-session';
import { RedisStore } from 'connect-redis';
import { config } from '../config/env.js';
import { pool } from '../config/db.js';
import { redis } from '../config/redis.js';
import { logger } from '../config/logger.js';
import type { AuthedUser } from '../types/index.js';
import { ok, fail } from '../utils/response.js';
import { UnauthorizedError } from '../utils/errors.js';
import type { RowDataPacket } from 'mysql2';

const router = Router();

passport.serializeUser((user: any, done: any) => {
  done(null, (user as AuthedUser).id);
});

passport.deserializeUser(async (id: number, done: any) => {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT id, google_id, email, display_name, avatar_url FROM users WHERE id = ?',
      [id],
    );
    if (rows.length === 0) return done(null, false);
    const r = rows[0] as any;
    done(null, {
      id: r.id,
      google_id: r.google_id,
      email: r.email,
      display_name: r.display_name,
      avatar_url: r.avatar_url,
    } as AuthedUser);
  } catch (err) {
    done(err as Error);
  }
});

passport.use(
  new GoogleStrategy(
    {
      clientID: config.GOOGLE_CLIENT_ID,
      clientSecret: config.GOOGLE_CLIENT_SECRET,
      callbackURL: config.GOOGLE_CALLBACK_URL,
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const googleId = profile.id;
        const email = profile.emails?.[0]?.value || '';
        const displayName = profile.displayName || email;
        const avatarUrl = profile.photos?.[0]?.value || '';

        if (!email) {
          return done(new Error('No email in Google profile'), false);
        }

        const [existing] = await pool.execute<RowDataPacket[]>(
          'SELECT id, google_id, email, display_name, avatar_url FROM users WHERE google_id = ?',
          [googleId],
        );

        if (existing.length > 0) {
          const r = existing[0] as any;
          return done(null, {
            id: r.id,
            google_id: r.google_id,
            email: r.email,
            display_name: r.display_name,
            avatar_url: r.avatar_url,
          } as AuthedUser);
        }

        const [result] = await pool.execute(
          'INSERT INTO users (google_id, email, display_name, avatar_url) VALUES (?, ?, ?, ?)',
          [googleId, email, displayName, avatarUrl],
        );
        const insertId = (result as any).insertId as number;

        await pool.execute(
          'INSERT INTO sender_configs (user_id, from_name, from_email, hourly_limit, min_delay_sec) VALUES (?, ?, ?, 50, 60)',
          [insertId, displayName, email],
        );

        done(null, {
          id: insertId,
          google_id: googleId,
          email,
          display_name: displayName,
          avatar_url: avatarUrl,
        } as AuthedUser);
      } catch (err) {
        done(err as Error);
      }
    },
  ),
);

export const sessionMiddleware = session({
  store: new RedisStore({ client: redis as any, prefix: 'eos:sess:' }),
  secret: config.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  name: 'eos.sid',
  cookie: {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: config.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
});

router.use(sessionMiddleware);
router.use(passport.initialize());
router.use(passport.session());

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${config.CLIENT_ORIGIN}/login?error=auth_failed`,
  }),
  (_req, res) => {
    res.redirect(`${config.CLIENT_ORIGIN}/dashboard`);
  },
);

router.get('/me', (req, res) => {
  if (!req.user) return fail(res, 'Not authenticated', 401);
  return ok(res, req.user);
});

router.post('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy(() => {
      res.clearCookie('eos.sid');
      return ok(res, { message: 'Logged out' });
    });
  });
});

export function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(new UnauthorizedError());
  next();
}

export default router;
