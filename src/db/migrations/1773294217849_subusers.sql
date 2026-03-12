-- Up Migration
CREATE TABLE faculty (
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  employee_id VARCHAR(20) UNIQUE NOT NULL,
  designation VARCHAR(50),
  department VARCHAR(100),
  research_area TEXT,
  is_available BOOLEAN DEFAULT TRUE
);

CREATE TABLE staff (
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  staff_id VARCHAR(20) UNIQUE NOT NULL,
  department VARCHAR(100),
  desk_location VARCHAR(100),
  office_extension VARCHAR(15)
);

CREATE TABLE admins (
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  department VARCHAR(100),
  admin_level INT DEFAULT 2 CHECK (admin_level IN (1,2))
);

CREATE TABLE guests (
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  organization_name VARCHAR(100),
  job_title VARCHAR(50),
  created_by UUID REFERENCES users(id),
  expires_at TIMESTAMPTZ
);

-- Down Migration
DROP TABLE IF EXISTS guests;
DROP TABLE IF EXISTS admins;
DROP TABLE IF EXISTS staff;
DROP TABLE IF EXISTS faculty;
