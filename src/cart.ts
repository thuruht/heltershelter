import { Hono } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { Bindings, Cart, CartItem, Product } from './types';
import {
  CART_COOKIE_NAME,
  KV_CART_PREFIX,
  INVALID_PRODUCT_ID_ERROR,
  INVALID_QUANTITY_ERROR,
  PRODUCT_NOT_FOUND_ERROR
} from './constants';

export const cartRouter = new Hono<{ Bindings: Bindings }>();

// 6. Cart (KV)
cartRouter.get('/', async (c) => {
    let cartId = getCookie(c, CART_COOKIE_NAME);
    if (!cartId) {
        cartId = crypto.randomUUID();
        setCookie(c, CART_COOKIE_NAME, cartId, { path: '/', maxAge: 60 * 60 * 24 * 7 });
        return c.json({ items: [] });
    }
    
    const cartData = await c.env.SHOP_SESSION.get<Cart>(`${KV_CART_PREFIX}${cartId}`, 'json');
    return c.json(cartData || { items: [] });
});

cartRouter.post('/', async (c) => {
    let cartId = getCookie(c, CART_COOKIE_NAME);
    if (!cartId) {
        cartId = crypto.randomUUID();
        setCookie(c, CART_COOKIE_NAME, cartId, { path: '/', maxAge: 60 * 60 * 24 * 7 });
    }

    const { productId, quantity } = await c.req.json();

    // Basic validation
    if (typeof productId !== 'string' || productId.length === 0) {
        return c.json({ error: INVALID_PRODUCT_ID_ERROR }, 400);
    }
    if (typeof quantity !== 'number' || quantity <= 0 || !Number.isInteger(quantity)) {
        return c.json({ error: INVALID_QUANTITY_ERROR }, 400);
    }

    let cart: Cart = await c.env.SHOP_SESSION.get<Cart>(`${KV_CART_PREFIX}${cartId}`, 'json') || { items: [] };
    
    const existingItem = cart.items.find((i: CartItem) => i.productId === productId);
    if (existingItem) {
        existingItem.quantity += quantity;
    } else {
        const product = await c.env.SHOP_DB.prepare('SELECT name, price FROM products WHERE id = ?').bind(productId).first<Product>();
        if(product) {
            cart.items.push({ productId, quantity, name: product.name, price: product.price });
        } else {
            return c.json({ error: PRODUCT_NOT_FOUND_ERROR }, 404);
        }
    }
    
    await c.env.SHOP_SESSION.put(`${KV_CART_PREFIX}${cartId}`, JSON.stringify(cart));
    return c.json(cart);
});

cartRouter.delete('/:productId', async (c) => {
    let cartId = getCookie(c, CART_COOKIE_NAME);
    if (!cartId) return c.json({ items: [] });
    
    const productId = c.req.param('productId');

    if (typeof productId !== 'string' || productId.length === 0) {
        return c.json({ error: INVALID_PRODUCT_ID_ERROR }, 400);
    }

    let cart: Cart = await c.env.SHOP_SESSION.get<Cart>(`${KV_CART_PREFIX}${cartId}`, 'json') || { items: [] };
    
    cart.items = cart.items.filter((i: CartItem) => i.productId !== productId);
    
    await c.env.SHOP_SESSION.put(`${KV_CART_PREFIX}${cartId}`, JSON.stringify(cart));
    return c.json(cart);
});