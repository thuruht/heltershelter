import { Hono, Context, Next } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { Bindings, Admin } from './types';
import {
  ADMIN_SESSION_COOKIE_NAME,
  KV_SESSION_PREFIX,
  PBKDF2_ITERATIONS,
  PBKDF2_KEY_LEN_BYTES,
  PBKDF2_HASH_ALG,
  SALT_BYTE_LENGTH,
  ADMIN_SETUP_NOT_ALLOWED_ERROR,
  INVALID_CREDENTIALS_ERROR,
  UNAUTHORIZED_ERROR,
  ADMIN_ALREADY_EXISTS_ERROR
} from './constants';

export const authRouter = new Hono<{ Bindings: Bindings }>();



export async function hashPassword(password: string, salt?: string): Promise<{ hash: string, salt: string }> {
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);

  const actualSaltBytes = salt
    ? new Uint8Array(salt.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)))
    : crypto.getRandomValues(new Uint8Array(SALT_BYTE_LENGTH_AUTH));

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: actualSaltBytes,
      iterations: PBKDF2_ITERATIONS_AUTH,
      hash: PBKDF2_HASH_ALG_AUTH,
    },
    keyMaterial,
    PBKDF2_KEY_LEN_BYTES_AUTH * 8 // key length in bits
  );

  const hashArray = Array.from(new Uint8Array(derivedBits));
  const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  const saltArray = Array.from(actualSaltBytes);
  const saltString = saltArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return { hash, salt: saltString };
}

export async function isAuthenticated(c: Context<{ Bindings: Bindings }>): Promise<boolean> {
  const sessionToken = getCookie(c, ADMIN_SESSION_COOKIE_NAME);
  if (!sessionToken) return false;
  const username = await c.env.SHOP_SESSION.get(`${KV_SESSION_PREFIX}${sessionToken}`);
  return !!username;
}

export const adminAuth = async (c: Context<{ Bindings: Bindings }>, next: Next) => {
  if (await isAuthenticated(c)) {
    await next();
  } else {
    return c.json({ error: UNAUTHORIZED_ERROR }, 401);
  }
};

// --- Validation Helpers ---
function isValidUsername(username: unknown): boolean {
  return typeof username === 'string' && username.length >= 3 && username.length <= 50;
}

function isValidPassword(password: unknown): boolean {
  return typeof password === 'string' && password.length >= 8; // Example: Minimum 8 characters
}

// 1. Setup (Create first admin if none exists)
authRouter.post('/setup-admin', async (c) => {
  if (c.env.ALLOW_ADMIN_SETUP !== 'true') {
    return c.json({ error: ADMIN_SETUP_NOT_ALLOWED_ERROR }, 403);
  }
  const { username, password } = await c.req.json();

  if (!isValidUsername(username) || !isValidPassword(password)) {
    return c.json({ error: 'Invalid username or password format' }, 400);
  }

  const existing = await c.env.SHOP_DB.prepare('SELECT * FROM admins LIMIT 1').first();
  if (existing) return c.json({ error: ADMIN_ALREADY_EXISTS_ERROR }, 403);

  const { hash, salt } = await hashPassword(password);
  const id = crypto.randomUUID();
  
  await c.env.SHOP_DB.prepare('INSERT INTO admins (id, username, password_hash, salt) VALUES (?, ?, ?, ?)')
    .bind(id, username, hash, salt)
    .run();

  return c.json({ success: true, message: 'Admin created' });
});

// 2. Login
authRouter.post('/login', async (c) => {
  const { username, password } = await c.req.json();
  
  if (!isValidUsername(username) || !isValidPassword(password)) {
    return c.json({ error: 'Invalid username or password format' }, 400);
  }

  const admin = await c.env.SHOP_DB.prepare('SELECT * FROM admins WHERE username = ?')
    .bind(username)
    .first<Admin>();

  if (!admin) return c.json({ error: INVALID_CREDENTIALS_ERROR }, 401);

  const { hash } = await hashPassword(password, admin.salt);
  if (hash !== admin.password_hash) return c.json({ error: INVALID_CREDENTIALS_ERROR }, 401);

  const token = crypto.randomUUID();
  await c.env.SHOP_SESSION.put(`${KV_SESSION_PREFIX}${token}`, username, { expirationTtl: 86400 }); // 24h
  setCookie(c, ADMIN_SESSION_COOKIE_NAME, token, { 
    httpOnly: true, 
    path: '/', 
    secure: true, 
    sameSite: 'Strict' 
  });

  return c.json({ success: true });
});

authRouter.post('/logout', async (c) => {
  const token = getCookie(c, ADMIN_SESSION_COOKIE_NAME);
  if (token) {
    await c.env.SHOP_SESSION.delete(`${KV_SESSION_PREFIX}${token}`);
    deleteCookie(c, ADMIN_SESSION_COOKIE_NAME);
  }
  return c.json({ success: true });
});

authRouter.get('/me', async (c) => {
    if (await isAuthenticated(c)) {
        return c.json({ authenticated: true });
    }
    return c.json({ authenticated: false });
});
