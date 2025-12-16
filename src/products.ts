import { Hono } from 'hono';
import { Bindings, Product, Order } from './types';
import { adminAuth } from './auth'; // Assuming adminAuth is exported from auth.ts
import {
  PRODUCT_NAME_INVALID_ERROR,
  PRODUCT_DESCRIPTION_INVALID_ERROR,
  PRODUCT_PRICE_INVALID_ERROR,
  PRODUCT_STOCK_INVALID_ERROR,
  NOT_FOUND_ERROR
} from './constants';

export const productsRouter = new Hono<{ Bindings: Bindings }>();

// 3. Products (Public)
productsRouter.get('/', async (c) => {
  const { results } = await c.env.SHOP_DB.prepare('SELECT * FROM products ORDER BY created_at DESC').all<Product>();
  return c.json(results);
});

productsRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const product = await c.env.SHOP_DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first<Product>();
  if (!product) return c.json({ error: NOT_FOUND_ERROR }, 404);
  return c.json(product);
});

// 4. Products (Admin)
productsRouter.post('/', adminAuth, async (c) => {
  const formData = await c.req.parseBody();
  const name = formData['name'] as string;
  const description = formData['description'] as string;
  const price = parseFloat(formData['price'] as string);
  const stock = parseInt(formData['stock'] as string);
  const image = formData['image'] as File;

  // Input Validation
  if (typeof name !== 'string' || name.trim().length === 0 || name.trim().length > 255) {
      return c.json({ error: PRODUCT_NAME_INVALID_ERROR }, 400);
  }
  if (description && (typeof description !== 'string' || description.trim().length > 1000)) {
      return c.json({ error: PRODUCT_DESCRIPTION_INVALID_ERROR }, 400);
  }
  if (isNaN(price) || price <= 0) {
      return c.json({ error: PRODUCT_PRICE_INVALID_ERROR }, 400);
  }
  if (isNaN(stock) || stock < 0 || !Number.isInteger(stock)) {
      return c.json({ error: PRODUCT_STOCK_INVALID_ERROR }, 400);
  }

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

productsRouter.delete('/:id', adminAuth, async (c) => {
  const id = c.req.param('id');
  
  // Get image key to delete from R2
  const product = await c.env.SHOP_DB.prepare('SELECT image_key FROM products WHERE id = ?').bind(id).first<Product>();
  
  if (product && product.image_key) {
    await c.env.SHOP_MEDIA.delete(product.image_key);
  }

  await c.env.SHOP_DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

productsRouter.get('/orders', adminAuth, async (c) => {
    const { results } = await c.env.SHOP_DB.prepare('SELECT * FROM orders ORDER BY created_at DESC').all<Order>();
    return c.json(results);
});