PRAGMA foreign_keys = ON;

DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS posts;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS users;
DROP VIEW  IF EXISTS active_users;
DROP VIEW  IF EXISTS recent_orders;

CREATE TABLE users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT    NOT NULL UNIQUE,
  name       TEXT    NOT NULL,
  is_active  INTEGER NOT NULL DEFAULT 1,
  bio        TEXT,
  avatar     BLOB,
  created_at TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_users_active ON users(is_active);

CREATE TABLE products (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  sku        TEXT    NOT NULL UNIQUE,
  name       TEXT    NOT NULL,
  price      REAL    NOT NULL,
  stock      INTEGER NOT NULL DEFAULT 0,
  metadata   TEXT,
  created_at TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_products_sku ON products(sku);

CREATE TABLE posts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT    NOT NULL,
  body       TEXT,
  published  INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_posts_user ON posts(user_id);

CREATE TABLE orders (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status      TEXT    NOT NULL CHECK (status IN ('pending','paid','shipped','cancelled')),
  total_cents INTEGER NOT NULL,
  placed_at   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_orders_user_status ON orders(user_id, status);

CREATE TABLE order_items (
  order_id    INTEGER NOT NULL REFERENCES orders(id)   ON DELETE CASCADE,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity    INTEGER NOT NULL CHECK (quantity > 0),
  unit_cents  INTEGER NOT NULL,
  PRIMARY KEY (order_id, product_id)
);

CREATE VIEW active_users AS
  SELECT id, email, name, created_at FROM users WHERE is_active = 1;

CREATE VIEW recent_orders AS
  SELECT o.id, u.email, o.status, o.total_cents, o.placed_at
  FROM orders o JOIN users u ON u.id = o.user_id
  ORDER BY o.placed_at DESC;

INSERT INTO users (email, name, is_active, bio) VALUES
  ('ada@example.com',     'Ada Lovelace',    1, 'Mathematician'),
  ('alan@example.com',    'Alan Turing',     1, 'Cryptanalyst'),
  ('grace@example.com',   'Grace Hopper',    1, NULL),
  ('linus@example.com',   'Linus Torvalds',  1, 'Kernel hacker'),
  ('dormant@example.com', 'Dormant Account', 0, NULL);

INSERT INTO products (sku, name, price, stock, metadata) VALUES
  ('SKU-001', 'Mechanical keyboard', 129.99, 42, '{"layout":"ANSI"}'),
  ('SKU-002', 'Trackball mouse',      79.50, 17, '{"dpi":1600}'),
  ('SKU-003', 'USB-C hub',            45.00,  0, NULL),
  ('SKU-004', '4K monitor',          599.00,  8, '{"size":"27in"}');

INSERT INTO posts (user_id, title, body, published) VALUES
  (1, 'Notes on the Analytical Engine', 'A long body...',   1),
  (1, 'Draft: unfinished thoughts',     NULL,               0),
  (2, 'On computable numbers',          'Body text here.',  1),
  (3, 'COBOL retrospective',            'Body text here.',  1),
  (4, 'git rebase patterns',            'Body text here.',  1);

INSERT INTO orders (user_id, status, total_cents) VALUES
  (1, 'paid',    12999),
  (2, 'shipped',  7950),
  (3, 'pending',  4500),
  (4, 'paid',    67400),
  (1, 'cancelled',  0);

INSERT INTO order_items (order_id, product_id, quantity, unit_cents) VALUES
  (1, 1, 1, 12999),
  (2, 2, 1,  7950),
  (3, 3, 1,  4500),
  (4, 4, 1, 59900),
  (4, 1, 1,  7500);
