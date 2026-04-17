-- Up Migration
CREATE TABLE Resources (
    projectID VARCHAR(20) NOT NULL,
    resourceName VARCHAR(100) NOT NULL,
    resourcePath VARCHAR(255) NOT NULL,
    mimeType VARCHAR(50) NOT NULL,
    PRIMARY KEY (projectID, resourceName),
    CONSTRAINT fk_res_proj FOREIGN KEY (projectID) 
    REFERENCES Projects(projectID) ON DELETE CASCADE
);

CREATE TABLE Grants (
    projectID VARCHAR(20) NOT NULL,
    grantName VARCHAR(150) NOT NULL,
    recievedDate DATE NOT NULL,
    grantAmount DECIMAL(12, 2) NOT NULL,
    industryID VARCHAR(20) NOT NULL, 
    PRIMARY KEY (projectID, grantName),
    CONSTRAINT fk_grant_proj FOREIGN KEY (projectID) 
    REFERENCES Projects(projectID) ON DELETE CASCADE,
    CONSTRAINT fk_grant_ind FOREIGN KEY (industryID) 
    REFERENCES Industry(industryID)
);

CREATE TABLE Project_Domains (
    projectID VARCHAR(20) NOT NULL,
    domainID VARCHAR(20) NOT NULL,
    PRIMARY KEY (projectID, domainID),
    CONSTRAINT fk_pd_proj FOREIGN KEY (projectID) 
    REFERENCES Projects(projectID) ON DELETE CASCADE,
    CONSTRAINT fk_pd_dom FOREIGN KEY (domainID) 
    REFERENCES Domains(domainID) ON DELETE CASCADE
);

CREATE TABLE Project_Industry (
    projectID VARCHAR(20) NOT NULL,
    industryID VARCHAR(20) NOT NULL,
    associationType VARCHAR(50) NOT NULL,
    PRIMARY KEY (projectID, industryID),
    CONSTRAINT fk_pi_proj FOREIGN KEY (projectID) 
    REFERENCES Projects(projectID) ON DELETE CASCADE,
    CONSTRAINT fk_pi_ind FOREIGN KEY (industryID) 
    REFERENCES Industry(industryID) ON DELETE CASCADE
);

CREATE TABLE Project_External (
    projectID VARCHAR(20) NOT NULL,
    extEmail VARCHAR(100) NOT NULL,
    industryFeedback TEXT,
    PRIMARY KEY (projectID, extEmail),
    CONSTRAINT fk_pe_proj FOREIGN KEY (projectID) 
    REFERENCES Projects(projectID) ON DELETE CASCADE,
    CONSTRAINT fk_pe_ext FOREIGN KEY (extEmail) 
    REFERENCES External_Superv(extEmail) ON DELETE CASCADE
);

CREATE TABLE Project_Faculty (
    projectID VARCHAR(20) NOT NULL,
    facultyID VARCHAR(20) NOT NULL,
    supervisoryRole VARCHAR(50) NOT NULL,
    remark TEXT,
    PRIMARY KEY (projectID, facultyID),
    CONSTRAINT fk_pf_proj FOREIGN KEY (projectID) 
    REFERENCES Projects(projectID) ON DELETE CASCADE,
    CONSTRAINT fk_pf_fac FOREIGN KEY (facultyID) 
    REFERENCES Faculty(userID) ON DELETE CASCADE
);

-- Down Migration
DROP TABLE IF EXISTS Project_Faculty;
DROP TABLE IF EXISTS Project_External;
DROP TABLE IF EXISTS Project_Industry;
DROP TABLE IF EXISTS Project_Domains;
DROP TABLE IF EXISTS Grants;
DROP TABLE IF EXISTS Resources;