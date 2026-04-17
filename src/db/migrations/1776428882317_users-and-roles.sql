-- Up Migration
CREATE TABLE Users (
    userID VARCHAR(20) PRIMARY KEY,
    userName VARCHAR(100) NOT NULL,
    userEmail VARCHAR(100) UNIQUE NOT NULL,
    userContactNo VARCHAR(20),
    password VARCHAR(255) NOT NULL,
    deptAbbreviation VARCHAR(10) NOT NULL,
    CONSTRAINT fk_user_dept FOREIGN KEY (deptAbbreviation)
    REFERENCES Department(deptAbbreviation)
);

CREATE TABLE Admin (
    userID VARCHAR(20) PRIMARY KEY,
    adminLvl INT CHECK (adminLvl IN (1, 2)),
    CONSTRAINT fk_admin_user FOREIGN KEY (userID) 
    REFERENCES Users(userID) ON DELETE CASCADE
);

CREATE TABLE Faculty (
    userID VARCHAR(20) PRIMARY KEY,
    designation VARCHAR(50) NOT NULL,
    areaOfResearch VARCHAR(150),
    CONSTRAINT fk_faculty_user FOREIGN KEY (userID) 
    REFERENCES Users(userID) ON DELETE CASCADE
);

CREATE TABLE Staff (
    userID VARCHAR(20) PRIMARY KEY,
    jobTitle VARCHAR(50) NOT NULL,
    CONSTRAINT fk_staff_user FOREIGN KEY (userID) 
    REFERENCES Users(userID) ON DELETE CASCADE
);

-- Down Migration
DROP TABLE IF EXISTS Staff;
DROP TABLE IF EXISTS Faculty;
DROP TABLE IF EXISTS Admin;
DROP TABLE IF EXISTS Users;