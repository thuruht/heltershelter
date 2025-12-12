import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';

type Bindings = {
  SHOP_DB: D1Database;
  SHOP_SESSION: KVNamespace;
  SHOP_MEDIA: R2Bucket;
  PAYPAL_CLIENT_ID: string;
  PAYPAL_SECRET: string;
  PAYPAL_SANDBOX_CLIENT_ID: string;
  PAYPAL_SANDBOX_SECRET: string;
  PLAN_TWENTY: string;
  PLAN_TEN: string;
  PLAN_FIVE: string;
  IS_SANDBOX?: string; 
};

const shop = new Hono<{ Bindings: Bindings }>();

// --- Helpers ---

async function getPaypalCredentials(c: any) {
    // Default to Sandbox if not explicitly set to false or 'live'
    // But since we have specific secrets, we can just check if we are in dev/prod environment if we wanted.
    // For now, let's use a simple heuristic or env var. 
    // If IS_SANDBOX is 'false', use LIVE.
    const isSandbox = c.env.IS_SANDBOX !== 'false'; 
    
    if (isSandbox) {
        return {
            clientId: c.env.PAYPAL_SANDBOX_CLIENT_ID,
            secret: c.env.PAYPAL_SANDBOX_SECRET,
            baseUrl: 'https://api-m.sandbox.paypal.com'
        };
    }
    return {
        clientId: c.env.PAYPAL_CLIENT_ID,
        secret: c.env.PAYPAL_SECRET,
        baseUrl: 'https://api-m.paypal.com'
    };
}

async function getPaypalAccessToken(c: any): Promise<string> {
    const { clientId, secret, baseUrl } = await getPaypalCredentials(c);
    const auth = btoa(`${clientId}:${secret}`);
    
    const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
    });
    
    if (!response.ok) {
        const txt = await response.text();
        console.error('PayPal Token Error:', txt);
        throw new Error('Failed to get PayPal token');
    }

    const data: any = await response.json();
    return data.access_token;
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function isAuthenticated(c: any): Promise<boolean> {
  const sessionToken = getCookie(c, 'admin_session');
  if (!sessionToken) return false;
  const username = await c.env.SHOP_SESSION.get(`session:${sessionToken}`);
  return !!username;
}

// --- Middleware ---

const adminAuth = async (c: any, next: any) => {
  if (await isAuthenticated(c)) {
    await next();
  } else {
    return c.json({ error: 'Unauthorized' }, 401);
  }
};

// --- Routes ---

// 1. Setup (Create first admin if none exists)
shop.post('/setup-admin', async (c) => {
  const { username, password } = await c.req.json();
  if (!username || !password) return c.json({ error: 'Missing fields' }, 400);

  const existing = await c.env.SHOP_DB.prepare('SELECT * FROM admins LIMIT 1').first();
  if (existing) return c.json({ error: 'Admin already exists' }, 403);

  const hash = await hashPassword(password);
  const id = crypto.randomUUID();
  
  await c.env.SHOP_DB.prepare('INSERT INTO admins (id, username, password_hash) VALUES (?, ?, ?)')
    .bind(id, username, hash)
    .run();

  return c.json({ success: true, message: 'Admin created' });
});

// 2. Login
shop.post('/login', async (c) => {
  const { username, password } = await c.req.json();
  
  const admin = await c.env.SHOP_DB.prepare('SELECT * FROM admins WHERE username = ?')
    .bind(username)
    .first();

  if (!admin) return c.json({ error: 'Invalid credentials' }, 401);

  const hash = await hashPassword(password);
  // @ts-ignore
  if (hash !== admin.password_hash) return c.json({ error: 'Invalid credentials' }, 401);

  const token = crypto.randomUUID();
  await c.env.SHOP_SESSION.put(`session:${token}`, username, { expirationTtl: 86400 }); // 24h
  setCookie(c, 'admin_session', token, { 
    httpOnly: true, 
    path: '/', 
    secure: true, 
    sameSite: 'Strict' 
  });

  return c.json({ success: true });
});

shop.post('/logout', async (c) => {
  const token = getCookie(c, 'admin_session');
  if (token) {
    await c.env.SHOP_SESSION.delete(`session:${token}`);
    deleteCookie(c, 'admin_session');
  }
  return c.json({ success: true });
});

shop.get('/me', async (c) => {
    if (await isAuthenticated(c)) {
        return c.json({ authenticated: true });
    }
    return c.json({ authenticated: false });
});


// 3. Products (Public)
shop.get('/products', async (c) => {
  const { results } = await c.env.SHOP_DB.prepare('SELECT * FROM products ORDER BY created_at DESC').all();
  return c.json(results);
});

shop.get('/products/:id', async (c) => {
  const id = c.req.param('id');
  const product = await c.env.SHOP_DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first();
  if (!product) return c.json({ error: 'Not found' }, 404);
  return c.json(product);
});

// 4. Products (Admin)
shop.post('/products', adminAuth, async (c) => {
  const formData = await c.req.parseBody();
  const name = formData['name'] as string;
  const description = formData['description'] as string;
  const price = parseFloat(formData['price'] as string);
  const stock = parseInt(formData['stock'] as string);
  const image = formData['image'] as File;

  if (!name || isNaN(price)) return c.json({ error: 'Invalid data' }, 400);

  let imageKey = null;
  if (image) {
    imageKey = `products/${crypto.randomUUID()}-${image.name}`;
    await c.env.SHOP_MEDIA.put(imageKey, await image.arrayBuffer(), {
      httpMetadata: { contentType: image.type }
    });
  }

  const id = crypto.randomUUID();
  await c.env.SHOP_DB.prepare(
    'INSERT INTO products (id, name, description, price, stock, image_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, name, description || '', price, stock || 0, imageKey, Date.now()).run();

  return c.json({ success: true, id });
});

shop.delete('/products/:id', adminAuth, async (c) => {
  const id = c.req.param('id');
  
  // Get image key to delete from R2
  const product = await c.env.SHOP_DB.prepare('SELECT image_key FROM products WHERE id = ?').bind(id).first();
  
  // @ts-ignore
  if (product && product.image_key) {
      // @ts-ignore
    await c.env.SHOP_MEDIA.delete(product.image_key);
  }

  await c.env.SHOP_DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

shop.get('/orders', adminAuth, async (c) => {
    const { results } = await c.env.SHOP_DB.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
    return c.json(results);
});

// 5. Image Proxy
shop.get('/media/:key', async (c) => {
    const key = c.req.param('key');
    const object = await c.env.SHOP_MEDIA.get(key);
    
    if (!object) return c.json({ error: 'Not found' }, 404);
    
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    
    return new Response(object.body, { headers });
});


// 6. Cart (KV)
shop.get('/cart', async (c) => {
    let cartId = getCookie(c, 'cart_id');
    if (!cartId) {
        cartId = crypto.randomUUID();
        setCookie(c, 'cart_id', cartId, { path: '/', maxAge: 60 * 60 * 24 * 7 });
        return c.json({ items: [] });
    }
    
    const cartData = await c.env.SHOP_SESSION.get(`cart:${cartId}`, 'json');
    return c.json(cartData || { items: [] });
});

shop.post('/cart', async (c) => {
    let cartId = getCookie(c, 'cart_id');
    if (!cartId) {
        cartId = crypto.randomUUID();
        setCookie(c, 'cart_id', cartId, { path: '/', maxAge: 60 * 60 * 24 * 7 });
    }

    const { productId, quantity } = await c.req.json();
    let cart: any = await c.env.SHOP_SESSION.get(`cart:${cartId}`, 'json') || { items: [] };
    
    const existingItem = cart.items.find((i: any) => i.productId === productId);
    if (existingItem) {
        existingItem.quantity += quantity;
    } else {
        const product = await c.env.SHOP_DB.prepare('SELECT name, price FROM products WHERE id = ?').bind(productId).first();
        if(product) {
            cart.items.push({ productId, quantity, ...product });
        }
    }
    
    await c.env.SHOP_SESSION.put(`cart:${cartId}`, JSON.stringify(cart));
    return c.json(cart);
});

shop.delete('/cart/:productId', async (c) => {
    let cartId = getCookie(c, 'cart_id');
    if (!cartId) return c.json({ items: [] });
    
    const productId = c.req.param('productId');
    let cart: any = await c.env.SHOP_SESSION.get(`cart:${cartId}`, 'json') || { items: [] };
    
    cart.items = cart.items.filter((i: any) => i.productId !== productId);
    
    await c.env.SHOP_SESSION.put(`cart:${cartId}`, JSON.stringify(cart));
    return c.json(cart);
});

// 7. PayPal Checkout
shop.post('/create-order', async (c) => {
    let cartId = getCookie(c, 'cart_id');
    if (!cartId) return c.json({ error: 'No cart' }, 400);
    const cart: any = await c.env.SHOP_SESSION.get(`cart:${cartId}`, 'json');
    if (!cart || cart.items.length === 0) return c.json({ error: 'Cart empty' }, 400);

    let total = 0;
    cart.items.forEach((item: any) => {
        total += item.price * item.quantity;
    });

    try {
        const accessToken = await getPaypalAccessToken(c);
        const { baseUrl } = await getPaypalCredentials(c);

        const orderPayload = {
            intent: "CAPTURE",
            purchase_units: [
                {
                    amount: {
                        currency_code: "USD",
                        value: total.toFixed(2)
                    }
                }
            ]
        };

        const response = await fetch(`${baseUrl}/v2/checkout/orders`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${accessToken}`
            },
            body: JSON.stringify(orderPayload)
        });

        const orderData = await response.json();
        return c.json(orderData);
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

shop.post('/capture-order', async (c) => {
    const { orderID } = await c.req.json();
    try {
        const accessToken = await getPaypalAccessToken(c);
        const { baseUrl } = await getPaypalCredentials(c);

        const response = await fetch(`${baseUrl}/v2/checkout/orders/${orderID}/capture`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${accessToken}`
            }
        });

        const data: any = await response.json();

        if (data.status === 'COMPLETED') {
            let cartId = getCookie(c, 'cart_id');
            const cart: any = await c.env.SHOP_SESSION.get(`cart:${cartId}`, 'json');
            const customerEmail = data.payer.email_address;
            
            await c.env.SHOP_DB.prepare(
                'INSERT INTO orders (id, customer_email, items, total, status, created_at) VALUES (?, ?, ?, ?, ?, ?)'
            ).bind(
                data.id, 
                customerEmail, 
                JSON.stringify(cart ? cart.items : []), 
                data.purchase_units[0].payments.captures[0].amount.value, 
                'paid', 
                Date.now()
            ).run();

            // Clear cart
            if (cartId) await c.env.SHOP_SESSION.delete(`cart:${cartId}`);
            return c.json({ success: true, orderID: data.id });
        }

        return c.json({ error: 'Payment failed', details: data }, 400);
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// 8. Subscription Routes
shop.get('/subscription-plans', (c) => {
    return c.json({
        'five': c.env.PLAN_FIVE,
        'ten': c.env.PLAN_TEN,
        'twenty': c.env.PLAN_TWENTY
    });
});

export default shop;