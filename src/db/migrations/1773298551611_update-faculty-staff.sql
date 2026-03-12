-- Up Migration
ALTER TABLE faculty 
    DROP COLUMN IF EXISTS department;

ALTER TABLE faculty 
    ADD COLUMN department_id UUID REFERENCES departments(id) ON DELETE SET NULL;


ALTER TABLE staff 
    DROP COLUMN IF EXISTS department;

ALTER TABLE staff 
    ADD COLUMN department_id UUID REFERENCES departments(id) ON DELETE SET NULL;

-- Down Migration
ALTER TABLE staff DROP COLUMN department_id;
ALTER TABLE staff ADD COLUMN department VARCHAR(100);

ALTER TABLE faculty DROP COLUMN department_id;
ALTER TABLE faculty ADD COLUMN department VARCHAR(100);
