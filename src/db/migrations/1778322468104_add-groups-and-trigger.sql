-- Up Migration
ALTER TABLE students DROP CONSTRAINT IF EXISTS fk_std_proj;
ALTER TABLE students DROP COLUMN IF EXISTS project_id;

CREATE TABLE groups (
    group_id VARCHAR(20) PRIMARY KEY,
    
    group_leader VARCHAR(20) UNIQUE NOT NULL,
    member_2 VARCHAR(20) UNIQUE,
    member_3 VARCHAR(20) UNIQUE,
    member_4 VARCHAR(20) UNIQUE,
    
    project_id VARCHAR(20),

    -- Foreign Key constraints pointing back to Students and Projects
    CONSTRAINT fk_group_leader FOREIGN KEY (group_leader) REFERENCES students(seat_no) ON UPDATE CASCADE,
    CONSTRAINT fk_group_m2 FOREIGN KEY (member_2) REFERENCES students(seat_no) ON UPDATE CASCADE,
    CONSTRAINT fk_group_m3 FOREIGN KEY (member_3) REFERENCES students(seat_no) ON UPDATE CASCADE,
    CONSTRAINT fk_group_m4 FOREIGN KEY (member_4) REFERENCES students(seat_no) ON UPDATE CASCADE,
    CONSTRAINT fk_group_proj FOREIGN KEY (project_id) REFERENCES projects(project_id) ON UPDATE CASCADE ON DELETE SET NULL,

    -- Horizontal Uniqueness
    CONSTRAINT check_no_duplicate_members CHECK (
        (member_2 IS NULL OR group_leader != member_2) AND
        (member_3 IS NULL OR group_leader != member_3) AND
        (member_4 IS NULL OR group_leader != member_4) AND
        
        (member_2 IS NULL OR member_3 IS NULL OR member_2 != member_3) AND
        (member_2 IS NULL OR member_4 IS NULL OR member_2 != member_4) AND
        (member_3 IS NULL OR member_4 IS NULL OR member_3 != member_4)
    )
);

CREATE OR REPLACE FUNCTION generate_group_id() RETURNS TRIGGER AS $$
DECLARE
    next_num INT;
    batch_digits VARCHAR(2);
    prefix VARCHAR;
BEGIN
    -- Extract the first two numbers from the leader's seat number (e.g., 'CS-24138' -> '24')
    batch_digits := SUBSTRING(NEW.group_leader FROM '[0-9]{2}');
    
    -- Fallback safety check just in case the seat number format is weird
    IF batch_digits IS NULL THEN
        batch_digits := 'XX';
    END IF;

    prefix := 'G-B' || batch_digits || '-';

    -- Find the highest existing sequence for this specific batch and add 1
    SELECT COALESCE(MAX(CAST(SPLIT_PART(group_id, '-', 3) AS INT)), 0) + 1
    INTO next_num 
    FROM groups 
    WHERE group_id LIKE prefix || '%';

    -- Construct the final ID using dynamic padding
    NEW.group_id := prefix || LPAD(next_num::TEXT, GREATEST(3, LENGTH(next_num::TEXT)), '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_group_id 
BEFORE INSERT ON groups 
FOR EACH ROW WHEN (NEW.group_id IS NULL) 
EXECUTE FUNCTION generate_group_id();

-- Down Migration
DROP TRIGGER IF EXISTS set_group_id ON groups;
DROP FUNCTION IF EXISTS generate_group_id();

DROP TABLE IF EXISTS groups;

ALTER TABLE students ADD COLUMN project_id VARCHAR(20);

ALTER TABLE students 
ADD CONSTRAINT fk_std_proj 
FOREIGN KEY (project_id) REFERENCES projects(project_id) 
ON UPDATE CASCADE ON DELETE SET NULL;