import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { Bindings, Cart, OrderItem } from './types';
import {
  NO_CART_ERROR,
  CART_EMPTY_ERROR,
  INVALID_ORDER_ID_ERROR,
  FAILED_PAYPAL_TOKEN_ERROR,
  PAYMENT_FAILED_ERROR
} from './constants';

export const paypalRouter = new Hono<{ Bindings: Bindings }>();

async function getPaypalCredentials(c: { env: Bindings }) {
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

// Global variable to cache the PayPal access token
let cachedPaypalAccessToken: { token: string; expiry: number } | null = null;

async function getPaypalAccessToken(c: { env: Bindings }): Promise<string> {
    const now = Date.now();
    // Check if token is still valid (e.g., within 5 minutes of expiry)
    if (cachedPaypalAccessToken && cachedPaypalAccessToken.expiry > now + 300 * 1000) { // 5 minutes buffer
        return cachedPaypalAccessToken.token;
    }

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
        throw new Error(FAILED_PAYPAL_TOKEN_ERROR);
    }

    const data: any = await response.json();
    cachedPaypalAccessToken = {
        token: data.access_token,
        expiry: now + (data.expires_in * 1000) // expires_in is in seconds
    };
    return data.access_token;
}


// 7. PayPal Checkout
paypalRouter.post('/create-order', async (c) => {
    let cartId = getCookie(c, 'cart_id');
    if (!cartId) return c.json({ error: NO_CART_ERROR }, 400);
    const cart: Cart | null = await c.env.SHOP_SESSION.get<Cart>(`cart:${cartId}`, 'json');
    if (!cart || cart.items.length === 0) return c.json({ error: CART_EMPTY_ERROR }, 400);

    let total = 0;
    cart.items.forEach((item: OrderItem) => {
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

paypalRouter.post('/capture-order', async (c) => {
    const { orderID } = await c.req.json();
    if (typeof orderID !== 'string' || orderID.length === 0) {
        return c.json({ error: INVALID_ORDER_ID_ERROR }, 400);
    }

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
            const cart: Cart | null = await c.env.SHOP_SESSION.get<Cart>(`cart:${cartId}`, 'json');
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

        return c.json({ error: PAYMENT_FAILED_ERROR, details: data }, 400);
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});