-- Up Migration
ALTER TABLE admins 
  DROP COLUMN IF EXISTS deparment;

ALTER TABLE admins 
  ADD COLUMN deparment_id UUID REFERENCES departments(id) ON DELETE SET NULL;

ALTER TABLE admins 
  ADD CONSTRAINT check_admin_level
  check(
  (admin_level = 1 AND deparment_id is NULL) OR
  (admin_level =2 AND deparment_id is NOT NULL)
    );

-- Down Migration
ALTER TABLE DROP admins COLUMN IF EXISTS deparment_id;
ALTER TABLE admins ADD COLUMN deparment VARCHAR(100);
