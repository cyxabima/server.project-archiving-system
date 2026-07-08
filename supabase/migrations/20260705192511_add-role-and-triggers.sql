-- Addiing the role column to users
ALTER TABLE users ADD COLUMN role VARCHAR(20);
UPDATE users SET role = 'admin' WHERE user_id LIKE 'ADM-%';
ALTER TABLE users ALTER COLUMN role SET NOT NULL;

-- USER ID TRIGGER
CREATE OR REPLACE FUNCTION generate_user_id() RETURNS TRIGGER AS $$
DECLARE
    next_num INT;
    prefix VARCHAR;
BEGIN
    IF NEW.role = 'faculty' THEN prefix := 'FAC-' || NEW.dept_abbreviation || '-';
    ELSIF NEW.role = 'staff' THEN prefix := 'STF-' || NEW.dept_abbreviation || '-';
    ELSIF NEW.role = 'admin' THEN prefix := 'ADM-' || NEW.dept_abbreviation || '-';
    ELSE prefix := 'USR-' || NEW.dept_abbreviation || '-';
    END IF;

    SELECT COALESCE(MAX(CAST(SPLIT_PART(user_id, '-', 3) AS INT)), 0) + 1
    INTO next_num FROM users WHERE user_id LIKE prefix || '%';

    NEW.user_id := prefix || LPAD(next_num::TEXT, GREATEST(3, LENGTH(next_num::TEXT)), '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_user_id BEFORE INSERT ON users
FOR EACH ROW WHEN (NEW.user_id IS NULL) EXECUTE FUNCTION generate_user_id();

-- DOMAIN ID TRIGGER
CREATE OR REPLACE FUNCTION generate_domain_id() RETURNS TRIGGER AS $$
DECLARE next_num INT;
BEGIN
    SELECT COALESCE(MAX(CAST(SPLIT_PART(domain_id, '-', 3) AS INT)), 0) + 1
    INTO next_num FROM domains WHERE domain_id LIKE 'DOM-' || NEW.dept_abbreviation || '-%';

    NEW.domain_id := 'DOM-' || NEW.dept_abbreviation || '-' || LPAD(next_num::TEXT, GREATEST(3, LENGTH(next_num::TEXT)), '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_domain_id BEFORE INSERT ON domains
FOR EACH ROW WHEN (NEW.domain_id IS NULL) EXECUTE FUNCTION generate_domain_id();

-- PROJECT ID TRIGGER
CREATE OR REPLACE FUNCTION generate_project_id() RETURNS TRIGGER AS $$
DECLARE
    next_num INT;
    dept_abbr VARCHAR;
BEGIN
    dept_abbr := NEW.dept_abbreviation;

    -- Find the highest existing number for this specific department
    SELECT COALESCE(MAX(CAST(SPLIT_PART(project_id, '-', 3) AS INT)), 0) + 1
    INTO next_num
    FROM projects
    WHERE project_id LIKE 'PROJ-' || dept_abbr || '-%';

    -- Generate ID (e.g: PROJ-CIS-001)
    NEW.project_id := 'PROJ-' || dept_abbr || '-' || LPAD(next_num::TEXT, GREATEST(3, LENGTH(next_num::TEXT)), '0');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_project_id BEFORE INSERT ON projects
FOR EACH ROW WHEN (NEW.project_id IS NULL) EXECUTE FUNCTION generate_project_id();

-- INDUSTRY ID TRIGGER
CREATE OR REPLACE FUNCTION generate_industry_id() RETURNS TRIGGER AS $$
DECLARE next_num INT;
BEGIN
    SELECT COALESCE(MAX(CAST(SPLIT_PART(industry_id, '-', 2) AS INT)), 0) + 1
    INTO next_num FROM industry WHERE industry_id LIKE 'IND-%';

    NEW.industry_id := 'IND-' || LPAD(next_num::TEXT, GREATEST(3, LENGTH(next_num::TEXT)), '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_industry_id BEFORE INSERT ON industry
FOR EACH ROW WHEN (NEW.industry_id IS NULL) EXECUTE FUNCTION generate_industry_id();
