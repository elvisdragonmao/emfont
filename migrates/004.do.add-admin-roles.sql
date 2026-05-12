ALTER TABLE admin_users
ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'admin';

ALTER TABLE admin_users
DROP CONSTRAINT IF EXISTS admin_users_role_check;

ALTER TABLE admin_users
ADD CONSTRAINT admin_users_role_check
CHECK (role IN ('admin', 'super_admin'));
