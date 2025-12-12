CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    image_key TEXT,
    stock INTEGER DEFAULT 0,
    created_at INTEGER
);

CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    customer_email TEXT,
    items TEXT, -- JSON string of items
    total REAL,
    status TEXT, -- 'pending', 'paid', 'shipped'
    created_at INTEGER
);

CREATE TABLE IF NOT EXISTS admins (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
);
