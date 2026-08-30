-- Database schema
CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    balance INTEGER DEFAULT 0
);
