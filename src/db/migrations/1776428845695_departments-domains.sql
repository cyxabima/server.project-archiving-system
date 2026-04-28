-- Up Migration
CREATE TABLE department (
    dept_abbreviation VARCHAR(10) PRIMARY KEY,
    dept_name VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE domains (
    domain_id VARCHAR(20) PRIMARY KEY,
    domain_name VARCHAR(100) NOT NULL,
    domain_description TEXT,
    dept_abbreviation VARCHAR(10) NOT NULL,
    CONSTRAINT fk_domain_dept FOREIGN KEY (dept_abbreviation)
    REFERENCES department(dept_abbreviation) ON UPDATE CASCADE
);

-- Down Migration
DROP TABLE IF EXISTS domains;
DROP TABLE IF EXISTS department;