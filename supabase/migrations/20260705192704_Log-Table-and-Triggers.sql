CREATE TABLE audit_logs (
    log_id BIGSERIAL PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL,
    action VARCHAR(10) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_data JSONB,
    new_data JSONB,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE OR REPLACE FUNCTION log_table_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO audit_logs (table_name, action, new_data)
        VALUES (TG_TABLE_NAME, TG_OP, row_to_json(NEW)::JSONB);
        RETURN NEW;

    ELSIF (TG_OP = 'UPDATE') THEN
        IF (OLD IS DISTINCT FROM NEW) THEN
            INSERT INTO audit_logs (table_name, action, old_data, new_data)
            VALUES (TG_TABLE_NAME, TG_OP, row_to_json(OLD)::JSONB, row_to_json(NEW)::JSONB);
        END IF;
        RETURN NEW;

    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO audit_logs (table_name, action, old_data)
        VALUES (TG_TABLE_NAME, TG_OP, row_to_json(OLD)::JSONB);
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;


CREATE TRIGGER audit_users_changes
AFTER INSERT OR UPDATE OR DELETE ON users
FOR EACH ROW EXECUTE FUNCTION log_table_changes();

CREATE TRIGGER audit_industry_changes
AFTER INSERT OR UPDATE OR DELETE ON industry
FOR EACH ROW EXECUTE FUNCTION log_table_changes();

CREATE TRIGGER audit_externals_changes
AFTER INSERT OR UPDATE OR DELETE ON external_superv
FOR EACH ROW EXECUTE FUNCTION log_table_changes();

CREATE TRIGGER audit_projects_changes
AFTER INSERT OR UPDATE OR DELETE ON projects
FOR EACH ROW EXECUTE FUNCTION log_table_changes();

CREATE TRIGGER audit_students_changes
AFTER INSERT OR UPDATE OR DELETE ON students
FOR EACH ROW EXECUTE FUNCTION log_table_changes();

CREATE TRIGGER audit_grants_changes
AFTER INSERT OR UPDATE OR DELETE ON grants
FOR EACH ROW EXECUTE FUNCTION log_table_changes();

CREATE TRIGGER audit_PD_changes
AFTER INSERT OR UPDATE OR DELETE ON project_domain
FOR EACH ROW EXECUTE FUNCTION log_table_changes();

CREATE TRIGGER audit_PI_changes
AFTER INSERT OR UPDATE OR DELETE ON project_industry
FOR EACH ROW EXECUTE FUNCTION log_table_changes();

CREATE TRIGGER audit_PE_changes
AFTER INSERT OR UPDATE OR DELETE ON project_external
FOR EACH ROW EXECUTE FUNCTION log_table_changes();

CREATE TRIGGER audit_PF_changes
AFTER INSERT OR UPDATE OR DELETE ON project_faculty
FOR EACH ROW EXECUTE FUNCTION log_table_changes();

CREATE TRIGGER audit_groups_changes
AFTER INSERT OR UPDATE OR DELETE ON groups
FOR EACH ROW EXECUTE FUNCTION log_table_changes();

CREATE TRIGGER audit_resources_changes
AFTER INSERT OR UPDATE OR DELETE ON resources
FOR EACH ROW EXECUTE FUNCTION log_table_changes();
