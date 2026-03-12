-- Up Migration

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), 
  user_name VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('admin', 'faculty', 'staff', 'guest')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Down Migration

DROP TABLE IF EXISTS USERS;
