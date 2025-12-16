import { Hono } from 'hono';
import { Bindings } from './types';

export const mediaRouter = new Hono<{ Bindings: Bindings }>();

// 5. Image Proxy
mediaRouter.get('/:key', async (c) => {
    const key = c.req.param('key');
    const object = await c.env.SHOP_MEDIA.get(key);
    
    if (!object) return c.json({ error: 'Not found' }, 404);
    
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    
    return new Response(object.body, { headers });
});