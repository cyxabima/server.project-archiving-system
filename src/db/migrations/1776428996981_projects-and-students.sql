-- Up Migration
CREATE TABLE projects (
    project_id VARCHAR(20) PRIMARY KEY,
    project_title VARCHAR(200) UNIQUE NOT NULL,
    academic_year VARCHAR(10) NOT NULL,
    domain_id VARCHAR(20) NOT NULL,
    CONSTRAINT fk_proj_domain FOREIGN KEY (domain_id) 
    REFERENCES domains(domain_id) ON UPDATE CASCADE
);

CREATE TABLE students (
    seat_no VARCHAR(20) PRIMARY KEY,
    std_name VARCHAR(100) NOT NULL,
    std_email VARCHAR(100) UNIQUE NOT NULL,
    batch VARCHAR(10) NOT NULL,
    project_id VARCHAR(20),
    CONSTRAINT fk_std_proj FOREIGN KEY (project_id) 
    REFERENCES projects(project_id) ON UPDATE CASCADE ON DELETE SET NULL
);

-- Down Migration
DROP TABLE IF EXISTS students;
DROP TABLE IF EXISTS projects;