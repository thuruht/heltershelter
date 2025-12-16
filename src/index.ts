// index.ts

import { Hono } from 'hono';
import { Fetcher } from '@cloudflare/workers-types/experimental';
import { authRouter } from './auth';
import { productsRouter } from './products';
import { cartRouter } from './cart';
import { paypalRouter } from './paypal';
import { mediaRouter } from './media';
import { subscriptionsRouter } from './subscriptions';

type Bindings = {
  PAYPAL_CLIENT_ID: string;
  ASSETS: Fetcher;
  SHOP_DB: D1Database;
  SHOP_SESSION: KVNamespace;
  SHOP_MEDIA: R2Bucket;
  PAYPAL_SECRET: string;
  PAYPAL_SANDBOX_CLIENT_ID: string;
  PAYPAL_SANDBOX_SECRET: string;
  PLAN_TWENTY: string;
  PLAN_TEN: string;
  PLAN_FIVE: string;
  IS_SANDBOX?: string;
  ALLOW_ADMIN_SETUP?: string;
}

const app = new Hono<{ Bindings: Bindings }>();

// API Route for PayPal Config
app.get('/api/paypal-config', (c) => {
  const clientId = c.env.PAYPAL_CLIENT_ID;

  if (!clientId) {
    return c.json({ error: "PAYPAL_CLIENT_ID not configured" }, 500);
  }

  return c.json({ clientId });
});

// Mount modular routers
app.route('/auth', authRouter);
app.route('/products', productsRouter);
app.route('/cart', cartRouter);
app.route('/paypal', paypalRouter);
app.route('/media', mediaRouter);
app.route('/subscriptions', subscriptionsRouter);

// Serve Static Assets (fallback)
app.get('*', async (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

app.get('*', async (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

app.onError((err, c) => {
  console.error(`Error: ${err.message}`, err.stack);
  return c.json({ error: err.message || 'Internal Server Error' }, 500);
});

export default app;
