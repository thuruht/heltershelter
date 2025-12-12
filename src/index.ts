// index.ts

import { Fetcher } from '@cloudflare/workers-types/experimental';
import { Hono } from 'hono';

type Bindings = {
  PAYPAL_CLIENT_ID: string;
  ASSETS: Fetcher;
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

// Serve Static Assets (fallback)
app.get('*', async (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
