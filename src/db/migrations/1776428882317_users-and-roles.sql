-- Up Migration
CREATE TABLE users (
    user_id VARCHAR(20) PRIMARY KEY,
    user_name VARCHAR(100) NOT NULL,
    user_email VARCHAR(100) UNIQUE NOT NULL,
    user_contact_no VARCHAR(20),
    password VARCHAR(255) NOT NULL,
    dept_abbreviation VARCHAR(10) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    CONSTRAINT fk_user_dept FOREIGN KEY (dept_abbreviation)
    REFERENCES department(dept_abbreviation) ON UPDATE CASCADE
);

CREATE TABLE admin (
    user_id VARCHAR(20) PRIMARY KEY,
    admin_lvl INT CHECK (admin_lvl IN (1, 2)),
    CONSTRAINT fk_admin_user FOREIGN KEY (user_id) 
    REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE faculty (
    user_id VARCHAR(20) PRIMARY KEY,
    designation VARCHAR(50) NOT NULL,
    area_of_research VARCHAR(150),
    CONSTRAINT fk_faculty_user FOREIGN KEY (user_id) 
    REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE staff (
    user_id VARCHAR(20) PRIMARY KEY,
    job_title VARCHAR(50) NOT NULL,
    CONSTRAINT fk_staff_user FOREIGN KEY (user_id) 
    REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE CASCADE
);

-- Down Migration
DROP TABLE IF EXISTS staff;
DROP TABLE IF EXISTS faculty;
DROP TABLE IF EXISTS admin;
DROP TABLE IF EXISTS users;