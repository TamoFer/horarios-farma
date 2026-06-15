-- =====================================================
-- SCHEMA: horarios_farmacia
-- =====================================================

-- Sucursales (Branches)
CREATE TABLE branches (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Encargados (Managers) - vinculados a auth.users de Supabase
CREATE TABLE managers (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'manager' CHECK (role IN ('admin', 'manager')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Relación manager-branches (un manager puede tener 1-2 sucursales)
CREATE TABLE manager_branches (
  id SERIAL PRIMARY KEY,
  manager_id INTEGER NOT NULL REFERENCES managers(id) ON DELETE CASCADE,
  branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  UNIQUE(manager_id, branch_id)
);

-- Empleados (pertenecen a una sucursal, pueden cambiar)
CREATE TABLE employees (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  functions TEXT[] NOT NULL DEFAULT '{}',
  default_function TEXT,
  weekly_hours DECIMAL(4,1),
  day_off TEXT,
  shifts JSONB DEFAULT '[]',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vacaciones
CREATE TABLE vacations (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Historial de horarios
CREATE TABLE schedule_history (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  placed_employees JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE manager_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacations ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_history ENABLE ROW LEVEL SECURITY;

-- Policies: Managers solo ven datos de sus sucursales
-- Admin puede hacer de todo
CREATE POLICY "Admin can do anything on branches" ON branches
  FOR ALL USING (
    EXISTS (SELECT 1 FROM managers WHERE user_id = auth.uid() AND role = 'admin'))
;

CREATE POLICY "Managers can view their branches" ON branches
  FOR SELECT USING (
    id IN (SELECT branch_id FROM manager_branches WHERE manager_id IN (SELECT id FROM managers WHERE user_id = auth.uid())))
;

CREATE POLICY "Admin can do anything on managers" ON managers
  FOR ALL USING (
    EXISTS (SELECT 1 FROM managers WHERE user_id = auth.uid() AND role = 'admin'))
;

CREATE POLICY "Managers can view managers" ON managers
  FOR SELECT USING (user_id = auth.uid())
;

CREATE POLICY "Admin can do anything on manager_branches" ON manager_branches
  FOR ALL USING (
    EXISTS (SELECT 1 FROM managers WHERE user_id = auth.uid() AND role = 'admin'))
;

CREATE POLICY "Managers can view manager_branches" ON manager_branches
  FOR SELECT USING (
    manager_id IN (SELECT id FROM managers WHERE user_id = auth.uid()))
;

CREATE POLICY "Admin can do anything on employees" ON employees
  FOR ALL USING (
    EXISTS (SELECT 1 FROM managers WHERE user_id = auth.uid() AND role = 'admin'))
;

CREATE POLICY "Managers can view employees of their branches" ON employees
  FOR SELECT USING (
    branch_id IN (SELECT branch_id FROM manager_branches WHERE manager_id IN (SELECT id FROM managers WHERE user_id = auth.uid())))
;

CREATE POLICY "Managers can insert employees" ON employees
  FOR INSERT WITH CHECK (
    branch_id IN (SELECT branch_id FROM manager_branches WHERE manager_id IN (SELECT id FROM managers WHERE user_id = auth.uid())))
;

CREATE POLICY "Managers can update employees" ON employees
  FOR UPDATE USING (
    branch_id IN (SELECT branch_id FROM manager_branches WHERE manager_id IN (SELECT id FROM managers WHERE user_id = auth.uid())))
;

CREATE POLICY "Admin can do anything on vacations" ON vacations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM managers WHERE user_id = auth.uid() AND role = 'admin'))
;

CREATE POLICY "Managers can view vacations of their branch employees" ON vacations
  FOR SELECT USING (
    employee_id IN (SELECT id FROM employees WHERE branch_id IN (SELECT branch_id FROM manager_branches WHERE manager_id IN (SELECT id FROM managers WHERE user_id = auth.uid()))))
;

CREATE POLICY "Managers can insert vacations" ON vacations
  FOR INSERT WITH CHECK (
    employee_id IN (SELECT id FROM employees WHERE branch_id IN (SELECT branch_id FROM manager_branches WHERE manager_id IN (SELECT id FROM managers WHERE user_id = auth.uid()))))
;

CREATE POLICY "Admin can do anything on schedule_history" ON schedule_history
  FOR ALL USING (
    EXISTS (SELECT 1 FROM managers WHERE user_id = auth.uid() AND role = 'admin'))
;

CREATE POLICY "Managers can view schedule_history of their branches" ON schedule_history
  FOR SELECT USING (
    branch_id IN (SELECT branch_id FROM manager_branches WHERE manager_id IN (SELECT id FROM managers WHERE user_id = auth.uid())))
;

CREATE POLICY "Managers can insert schedule_history" ON schedule_history
  FOR INSERT WITH CHECK (
    branch_id IN (SELECT branch_id FROM manager_branches WHERE manager_id IN (SELECT id FROM managers WHERE user_id = auth.uid())))
;

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Función para crear usuario automáticamente en la tabla managers
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.managers (user_id, name, email)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'name', NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para llamar la función cuando se crea un usuario
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();