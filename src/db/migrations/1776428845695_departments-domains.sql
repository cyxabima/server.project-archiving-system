-- Up Migration
CREATE TABLE Department (
    deptAbbreviation VARCHAR(10) PRIMARY KEY,
    deptName VARCHAR(100) NOT NULL
);

CREATE TABLE Domains (
    domainID VARCHAR(20) PRIMARY KEY,
    domainName VARCHAR(100),
    domainDescription TEXT,
    deptAbbreviation VARCHAR(10) NOT NULL,
    CONSTRAINT fk_domain_dept FOREIGN KEY (deptAbbreviation)
    REFERENCES Department(deptAbbreviation)
);

-- Down Migration
DROP TABLE IF EXISTS Domains;
DROP TABLE IF EXISTS Department;