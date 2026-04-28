-- Up Migration
CREATE TABLE resources (
    project_id VARCHAR(20) NOT NULL,
    resource_name VARCHAR(100) NOT NULL,
    resource_path VARCHAR(255) NOT NULL,
    mime_type VARCHAR(50) NOT NULL,
    PRIMARY KEY (project_id, resource_name),
    CONSTRAINT fk_res_proj FOREIGN KEY (project_id) 
    REFERENCES projects(project_id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE grants (
    project_id VARCHAR(20) NOT NULL,
    grant_name VARCHAR(150) NOT NULL,
    recieved_date DATE NOT NULL,
    grant_amount DECIMAL(12, 2) NOT NULL,
    industry_id VARCHAR(20) NOT NULL, 
    PRIMARY KEY (project_id, grant_name),
    CONSTRAINT fk_grant_proj FOREIGN KEY (project_id) 
    REFERENCES projects(project_id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_grant_ind FOREIGN KEY (industry_id) 
    REFERENCES industry(industry_id) ON UPDATE CASCADE
);

CREATE TABLE project_domains (
    project_id VARCHAR(20) NOT NULL,
    domain_id VARCHAR(20) NOT NULL,
    PRIMARY KEY (project_id, domain_id),
    CONSTRAINT fk_pd_proj FOREIGN KEY (project_id) 
    REFERENCES projects(project_id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_pd_dom FOREIGN KEY (domain_id) 
    REFERENCES domains(domain_id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE project_industry (
    project_id VARCHAR(20) NOT NULL,
    industry_id VARCHAR(20) NOT NULL,
    association_type VARCHAR(50) NOT NULL,
    PRIMARY KEY (project_id, industry_id),
    CONSTRAINT fk_pi_proj FOREIGN KEY (project_id) 
    REFERENCES projects(project_id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_pi_ind FOREIGN KEY (industry_id) 
    REFERENCES industry(industry_id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE project_external (
    project_id VARCHAR(20) NOT NULL,
    ext_email VARCHAR(100) NOT NULL,
    industry_feedback TEXT,
    PRIMARY KEY (project_id, ext_email),
    CONSTRAINT fk_pe_proj FOREIGN KEY (project_id) 
    REFERENCES projects(project_id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_pe_ext FOREIGN KEY (ext_email) 
    REFERENCES external_superv(ext_email) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE project_faculty (
    project_id VARCHAR(20) NOT NULL,
    faculty_id VARCHAR(20) NOT NULL,
    supervisory_role VARCHAR(50) NOT NULL,
    remark TEXT,
    PRIMARY KEY (project_id, faculty_id),
    CONSTRAINT fk_pf_proj FOREIGN KEY (project_id) 
    REFERENCES projects(project_id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_pf_fac FOREIGN KEY (faculty_id) 
    REFERENCES faculty(user_id) ON UPDATE CASCADE ON DELETE CASCADE
);

-- Down Migration
DROP TABLE IF EXISTS project_faculty;
DROP TABLE IF EXISTS project_external;
DROP TABLE IF EXISTS project_industry;
DROP TABLE IF EXISTS project_domains;
DROP TABLE IF EXISTS grants;
DROP TABLE IF EXISTS resources;