-- Up Migration
ALTER TABLE projects 
ADD COLUMN abstract TEXT NOT NULL DEFAULT 'Abstract pending submission...';

-- Down Migration
ALTER TABLE projects 
DROP COLUMN IF EXISTS abstract;