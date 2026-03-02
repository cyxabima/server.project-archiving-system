-- Up Migration
CREATE TABLE test (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Down Migration
DROP TABLE IF EXISTS test;
