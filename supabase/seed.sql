-- =====================================================
-- SEED DATA: Sample branches and employees
-- Run this AFTER creating your account via the app
-- =====================================================

-- Insert sample branches
INSERT INTO branches (name, address) VALUES
  ('Farmacia Central', 'Av. Principal #123, Centro'),
  ('Farmacia Norte', 'Av. Industrial #456, Zona Industrial'),
  ('Farmacia Sur', 'Blvd. Sur #789, Colonia Las Flores');

-- =====================================================
-- AFTER you sign up through the app, get your user_id:
-- SELECT * FROM managers WHERE email = 'tu@email.com';
--
-- Then replace YOUR_MANAGER_ID and run:
-- INSERT INTO manager_branches (manager_id, branch_id) VALUES
--   (YOUR_MANAGER_ID, 1),  -- Branch 1: Farmacia Central
--   (YOUR_MANAGER_ID, 2);  -- Branch 2: Farmacia Norte (optional)
-- =====================================================

-- Insert sample employees for branch 1 (Farmacia Central)
INSERT INTO employees (branch_id, name, functions, default_function, weekly_hours, day_off, shifts) VALUES
  (1, 'María García', ARRAY['cajero'], 'cajero', 40, 'domingo', '[{"start": 7, "end": 15}]'),
  (1, 'Carlos López', ARRAY['vendedor', 'cajero'], 'vendedor', 45, 'lunes', '[{"start": 8, "end": 13}, {"start": 18, "end": 22}]'),
  (1, 'Ana Martínez', ARRAY['perfumera', 'limpieza'], 'perfumera', 45, 'martes', '[{"start": 9, "end": 18}]'),
  (1, 'Pedro Sánchez', ARRAY['salon', 'vendedor'], 'salon', 45, 'miércoles', '[{"start": 10, "end": 19}]'),
  (1, 'Laura Rodríguez', ARRAY['inventario', 'limpieza'], 'inventario', 45, 'jueves', '[{"start": 7, "end": 16}]');

-- Insert sample employees for branch 2 (Farmacia Norte)
INSERT INTO employees (branch_id, name, functions, default_function, weekly_hours, day_off, shifts) VALUES
  (2, 'Juan Pérez', ARRAY['limpieza', 'perfumera', 'cajero'], 'limpieza', 40, 'viernes', '[{"start": 7, "end": 15}]'),
  (2, 'Sofia Hernández', ARRAY['cajero', 'vendedor'], 'cajero', 40, 'sábado', '[{"start": 14, "end": 22}]'),
  (2, 'Diego Fernández', ARRAY['vendedor', 'salon', 'perfumera'], 'vendedor', 45, 'viernes', '[{"start": 9, "end": 14}, {"start": 16, "end": 20}]');

-- Insert sample employees for branch 3 (Farmacia Sur)
INSERT INTO employees (branch_id, name, functions, default_function, weekly_hours, day_off, shifts) VALUES
  (3, 'Elena Morales', ARRAY['cajero', 'vendedor'], 'cajero', 40, 'domingo', '[{"start": 7, "end": 15}]'),
  (3, 'Roberto Castro', ARRAY['salon', 'inventario'], 'salon', 45, 'lunes', '[{"start": 8, "end": 17}]');