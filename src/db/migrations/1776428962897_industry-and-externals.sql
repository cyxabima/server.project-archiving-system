-- Up Migration
CREATE TABLE Industry (
    industryID VARCHAR(20) PRIMARY KEY,
    industryName VARCHAR(150) NOT NULL,
    location VARCHAR(200),
    industrytype VARCHAR(100),
    industryEmail VARCHAR(100)
);

CREATE TABLE External_Superv (
    extEmail VARCHAR(100) PRIMARY KEY,
    extName VARCHAR(100) NOT NULL,
    extDesignation VARCHAR(100),
    industryID VARCHAR(20) NOT NULL,
    CONSTRAINT fk_ext_ind FOREIGN KEY (industryID) 
    REFERENCES Industry(industryID)
);

-- Down Migration
DROP TABLE IF EXISTS External_Superv;
DROP TABLE IF EXISTS Industry;