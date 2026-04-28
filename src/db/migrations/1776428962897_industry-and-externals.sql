-- Up Migration
CREATE TABLE industry (
    industry_id VARCHAR(20) PRIMARY KEY,
    industry_name VARCHAR(150) UNIQUE NOT NULL,
    location VARCHAR(200),
    industry_type VARCHAR(100),
    industry_email VARCHAR(100) UNIQUE
);

CREATE TABLE external_superv (
    ext_email VARCHAR(100) PRIMARY KEY,
    ext_name VARCHAR(100) NOT NULL,
    ext_designation VARCHAR(100),
    industry_id VARCHAR(20) NOT NULL,
    CONSTRAINT fk_ext_ind FOREIGN KEY (industry_id) 
    REFERENCES industry(industry_id) ON UPDATE CASCADE
);

-- Down Migration
DROP TABLE IF EXISTS external_superv;
DROP TABLE IF EXISTS industry;