ALTER TABLE students
ADD COLUMN dept_abbreviation VARCHAR(20),
ADD CONSTRAINT fk_std_dept FOREIGN KEY (dept_abbreviation)
    REFERENCES department(dept_abbreviation) ON UPDATE CASCADE ON DELETE SET NULL;
