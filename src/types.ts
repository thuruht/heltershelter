export type Bindings = {
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
  ALLOW_ADMIN_SETUP?: string;
};

export type Admin = {
  id: string;
  username: string;
  password_hash: string;
  salt: string;
};

export type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_key: string | null;
  stock: number;
  created_at: number;
};

export type OrderItem = {
  productId: string;
  name: string;
  price: number;
  quantity: number;
};

export type Order = {
  id: string;
  customer_email: string;
  items: string; // JSON string of OrderItem[]
  total: number;
  status: 'pending' | 'paid' | 'shipped';
  created_at: number;
};

export type CartItem = {
    productId: string;
    name: string;
    price: number;
    quantity: number;
}

export type Cart = {
    items: CartItem[];
}