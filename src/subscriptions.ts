import { Hono } from 'hono';
import { Bindings } from './types';

export const subscriptionsRouter = new Hono<{ Bindings: Bindings }>();

// 8. Subscription Routes
subscriptionsRouter.get('/plans', (c) => {
    return c.json({
        'five': c.env.PLAN_FIVE,
        'ten': c.env.PLAN_TEN,
        'twenty': c.env.PLAN_TWENTY
    });
});