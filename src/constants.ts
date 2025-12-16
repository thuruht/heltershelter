// src/constants.ts

// --- Authentication ---
export const ADMIN_SESSION_COOKIE_NAME = 'admin_session';
export const KV_SESSION_PREFIX = 'session:';
export const ADMIN_SETUP_NOT_ALLOWED_ERROR = 'Admin setup is not allowed';
export const INVALID_CREDENTIALS_ERROR = 'Invalid credentials';
export const UNAUTHORIZED_ERROR = 'Unauthorized';
export const ADMIN_ALREADY_EXISTS_ERROR = 'Admin already exists';

// --- PBKDF2 Configuration ---
export const PBKDF2_ITERATIONS = 100000;
export const PBKDF2_KEY_LEN_BYTES = 32; // 32 bytes = 256 bits
export const PBKDF2_HASH_ALG = 'SHA-256';
export const SALT_BYTE_LENGTH = 16; // 16 bytes = 128 bits

// --- Cart ---
export const CART_COOKIE_NAME = 'cart_id';
export const KV_CART_PREFIX = 'cart:';
export const INVALID_PRODUCT_ID_ERROR = 'Invalid productId';
export const INVALID_QUANTITY_ERROR = 'Quantity must be a positive integer';
export const PRODUCT_NOT_FOUND_ERROR = 'Product not found';

// --- PayPal ---
export const NO_CART_ERROR = 'No cart';
export const CART_EMPTY_ERROR = 'Cart empty';
export const INVALID_ORDER_ID_ERROR = 'Invalid orderID';
export const FAILED_PAYPAL_TOKEN_ERROR = 'Failed to get PayPal token';
export const PAYMENT_FAILED_ERROR = 'Payment failed';

// --- Products ---
export const PRODUCT_NAME_INVALID_ERROR = 'Product name is required and must be between 1 and 255 characters.';
export const PRODUCT_DESCRIPTION_INVALID_ERROR = 'Product description must be less than 1000 characters.';
export const PRODUCT_PRICE_INVALID_ERROR = 'Price must be a positive number.';
export const PRODUCT_STOCK_INVALID_ERROR = 'Stock must be a non-negative integer.';
export const NOT_FOUND_ERROR = 'Not found';