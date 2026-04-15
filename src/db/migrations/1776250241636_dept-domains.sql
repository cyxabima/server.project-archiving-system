-- Up Migration
CREATE TABLE Department (
deptAbbreviation VARCHAR (10) PRIMARY KEY ,
deptName VARCHAR (100) NOT NULL
);
-- 2. Domains
CREATE TABLE Domains (
domainName VARCHAR (100) PRIMARY KEY ,
domainDescription TEXT ,
deptAbbreviation VARCHAR (10) NOT NULL ,
CONSTRAINT fk_domain_dept FOREIGN KEY ( deptAbbreviation )
REFERENCES Department ( deptAbbreviation )
)
-- Down Migration

DROP TABLE IF EXITS Department;
DROP TABLE IF EXITS Domains;
