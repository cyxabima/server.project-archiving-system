-- Up Migration
CREATE TABLE Projects (
    projectID VARCHAR(20) PRIMARY KEY,
    projectTitle VARCHAR(200) NOT NULL,
    academicYear VARCHAR(10) NOT NULL,
    domainID VARCHAR(20) NOT NULL,
    CONSTRAINT fk_proj_domain FOREIGN KEY (domainID) 
    REFERENCES Domains(domainID)
);

CREATE TABLE Students (
    seatNo VARCHAR(20) PRIMARY KEY,
    stdName VARCHAR(100) NOT NULL,
    stdEmail VARCHAR(100) UNIQUE NOT NULL,
    batch VARCHAR(10) NOT NULL,
    projectID VARCHAR(20),
    CONSTRAINT fk_std_proj FOREIGN KEY (projectID) 
    REFERENCES Projects(projectID) ON DELETE SET NULL
);

-- Down Migration
DROP TABLE IF EXISTS Students;
DROP TABLE IF EXISTS Projects;