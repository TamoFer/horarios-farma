-- =====================================================
-- SCHEMA: horarios_farmacia
-- =====================================================

-- Sucursales
CREATE TABLE sucursales (
  id SERIAL PRIMARY KEY,
  nombre_suc TEXT NOT NULL,
  direccion TEXT,
  fecha_creacion TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Roles de usuarios (admin/manager)
CREATE TABLE roles_usuarios (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'manager' CHECK (role IN ('admin', 'manager')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Encargados-Sucursales (muchos a muchos)
CREATE TABLE encargados_sucursales (
  id SERIAL PRIMARY KEY,
  manager_id INTEGER NOT NULL REFERENCES roles_usuarios(id) ON DELETE CASCADE,
  branch_id INTEGER NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
  UNIQUE(manager_id, branch_id)
);

-- Empleados
CREATE TABLE empleados (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  funciones TEXT[] NOT NULL DEFAULT '{}',
  puesto_contratado TEXT,
  jornada_semanal DECIMAL(4,1),
  franco TEXT,
  carga_horaria DECIMAL(4,1),
  trabajando BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  nro_vendedor INTEGER
);

-- Vacaciones
CREATE TABLE vacaciones (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Historial de horarios
CREATE TABLE history_vacations (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  placed_employees JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE sucursales ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles_usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE encargados_sucursales ENABLE ROW LEVEL SECURITY;
ALTER TABLE empleados ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE history_vacations ENABLE ROW LEVEL SECURITY;

-- Policies: Admin puede hacer todo
CREATE POLICY "Admin can do anything on sucursales" ON sucursales
  FOR ALL USING (
    EXISTS (SELECT 1 FROM roles_usuarios WHERE user_id = auth.uid() AND role = 'admin'))
;

CREATE POLICY "Managers can view sucursales" ON sucursales
  FOR SELECT USING (
    id IN (SELECT branch_id FROM encargados_sucursales WHERE manager_id IN (SELECT id FROM roles_usuarios WHERE user_id = auth.uid())))
;

CREATE POLICY "Admin can do anything on roles_usuarios" ON roles_usuarios
  FOR ALL USING (
    EXISTS (SELECT 1 FROM roles_usuarios WHERE user_id = auth.uid() AND role = 'admin'))
;

CREATE POLICY "Managers can view roles_usuarios" ON roles_usuarios
  FOR SELECT USING (user_id = auth.uid())
;

CREATE POLICY "Admin can do anything on encargados_sucursales" ON encargados_sucursales
  FOR ALL USING (
    EXISTS (SELECT 1 FROM roles_usuarios WHERE user_id = auth.uid() AND role = 'admin'))
;

CREATE POLICY "Managers can view encargados_sucursales" ON encargados_sucursales
  FOR SELECT USING (
    manager_id IN (SELECT id FROM roles_usuarios WHERE user_id = auth.uid()))
;

CREATE POLICY "Admin can do anything on empleados" ON empleados
  FOR ALL USING (
    EXISTS (SELECT 1 FROM roles_usuarios WHERE user_id = auth.uid() AND role = 'admin'))
;

CREATE POLICY "Managers can view empleados of their branches" ON empleados
  FOR SELECT USING (
    branch_id IN (SELECT branch_id FROM encargados_sucursales WHERE manager_id IN (SELECT id FROM roles_usuarios WHERE user_id = auth.uid())))
;

CREATE POLICY "Managers can insert empleados" ON empleados
  FOR INSERT WITH CHECK (
    branch_id IN (SELECT branch_id FROM encargados_sucursales WHERE manager_id IN (SELECT id FROM roles_usuarios WHERE user_id = auth.uid())))
;

CREATE POLICY "Managers can update empleados" ON empleados
  FOR UPDATE USING (
    branch_id IN (SELECT branch_id FROM encargados_sucursales WHERE manager_id IN (SELECT id FROM roles_usuarios WHERE user_id = auth.uid())))
;

CREATE POLICY "Admin can do anything on vacaciones" ON vacaciones
  FOR ALL USING (
    EXISTS (SELECT 1 FROM roles_usuarios WHERE user_id = auth.uid() AND role = 'admin'))
;

CREATE POLICY "Managers can view vacaciones" ON vacaciones
  FOR SELECT USING (
    employee_id IN (SELECT id FROM empleados WHERE branch_id IN (SELECT branch_id FROM encargados_sucursales WHERE manager_id IN (SELECT id FROM roles_usuarios WHERE user_id = auth.uid()))))
;

CREATE POLICY "Managers can insert vacaciones" ON vacaciones
  FOR INSERT WITH CHECK (
    employee_id IN (SELECT id FROM empleados WHERE branch_id IN (SELECT branch_id FROM encargados_sucursales WHERE manager_id IN (SELECT id FROM roles_usuarios WHERE user_id = auth.uid()))))
;

CREATE POLICY "Admin can do anything on history_vacations" ON history_vacations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM roles_usuarios WHERE user_id = auth.uid() AND role = 'admin'))
;

CREATE POLICY "Managers can view history_vacations" ON history_vacations
  FOR SELECT USING (
    branch_id IN (SELECT branch_id FROM encargados_sucursales WHERE manager_id IN (SELECT id FROM roles_usuarios WHERE user_id = auth.uid())))
;

CREATE POLICY "Managers can insert history_vacations" ON history_vacations
  FOR INSERT WITH CHECK (
    branch_id IN (SELECT branch_id FROM encargados_sucursales WHERE manager_id IN (SELECT id FROM roles_usuarios WHERE user_id = auth.uid())))
;

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Función para crear usuario automáticamente en la tabla roles_usuarios
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.roles_usuarios (user_id, name, email)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'name', NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para llamar la función cuando se crea un usuario
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
