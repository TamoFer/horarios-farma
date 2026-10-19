-- =====================================================================
-- Usuarios, roles y pendientes.
--
-- Objetivo:
--   1) Todo usuario nuevo queda como 'pendiente' (sin sucursal) y aparece
--      en la sección de Administración para que el Admin le asigne rol.
--   2) Solo el Admin puede asignar roles y sucursales (via RPC).
--   3) El Admin lista TODOS los usuarios de auth, existan o no en
--      roles_usuarios (así "aparece" el usuario nuevo sin tocar Supabase).
--
-- Roles válidos: 'admin', 'encargado', 'supervisor', 'rrhh', 'pendiente'.
-- El 'manager' viejo pasa a 'encargado'.
--
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query (Run).
-- Es idempotente: se puede ejecutar más de una vez sin romper nada.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0) Diagnóstico: cómo está definida la columna `role`.
-- ---------------------------------------------------------------------
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'roles_usuarios'
ORDER BY ordinal_position;

-- ---------------------------------------------------------------------
-- 1) Normalizar la restricción CHECK de `role` e incluir los roles nuevos.
--    Se eliminan TODAS las CHECK sobre `role`, se migran los valores
--    viejos y se crea una nueva.
-- ---------------------------------------------------------------------
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.roles_usuarios'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE public.roles_usuarios DROP CONSTRAINT %I', c.conname);
    RAISE NOTICE 'CHECK eliminada: %', c.conname;
  END LOOP;
END $$;

-- Migrar el rol viejo antes de imponer el CHECK nuevo.
-- OJO: NO cambiamos el tipo de la columna. Si `role` es un ENUM, PostgreSQL
-- no deja alterarlo mientras existan políticas RLS que dependan de ella.
UPDATE public.roles_usuarios SET role = 'encargado' WHERE role = 'manager';

ALTER TABLE public.roles_usuarios ALTER COLUMN role SET DEFAULT 'pendiente';

ALTER TABLE public.roles_usuarios DROP CONSTRAINT IF EXISTS roles_usuarios_role_check;

ALTER TABLE public.roles_usuarios
  ADD CONSTRAINT roles_usuarios_role_check
  CHECK (role IN ('admin', 'encargado', 'supervisor', 'rrhh', 'pendiente'));

-- ---------------------------------------------------------------------
-- 2) Backfill: usuarios de auth sin fila en roles_usuarios → 'pendiente'.
-- ---------------------------------------------------------------------
INSERT INTO public.roles_usuarios (user_id, name, email, role)
SELECT
  u.id::text,
  COALESCE(NULLIF(u.raw_user_meta_data->>'name', ''), split_part(u.email, '@', 1)),
  u.email::text,
  'pendiente'
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.roles_usuarios r WHERE r.user_id = u.id::text
);

-- ---------------------------------------------------------------------
-- 3) Trigger: cada usuario nuevo entra como 'pendiente'.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.roles_usuarios WHERE user_id = NEW.id::text
  ) THEN
    INSERT INTO public.roles_usuarios (user_id, name, email, role)
    VALUES (
      NEW.id::text,
      COALESCE(NULLIF(NEW.raw_user_meta_data->>'name', ''), split_part(NEW.email, '@', 1)),
      NEW.email,
      'pendiente'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------
-- 4) RPC: listar TODOS los usuarios de auth con su rol (o 'pendiente').
--    Solo el Admin puede llamarla.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.listar_usuarios()
RETURNS TABLE(roles_id integer, user_id text, email text, nombre text, rol text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.roles_usuarios ru
    WHERE ru.user_id = auth.uid()::text AND ru.role::text = 'admin'
  ) THEN
    RAISE EXCEPTION 'Solo un administrador puede listar usuarios';
  END IF;

  RETURN QUERY
  SELECT
    r.id::integer,
    u.id::text,
    u.email::text,
    COALESCE(r.name::text, NULLIF(u.raw_user_meta_data->>'name', ''), split_part(u.email, '@', 1))::text,
    COALESCE(r.role::text, 'pendiente')::text
  FROM auth.users u
  LEFT JOIN public.roles_usuarios r ON r.user_id = u.id::text
  ORDER BY u.created_at;
END;
$$;

-- ---------------------------------------------------------------------
-- 5) RPC: asignar rol a un usuario (crea la fila si no existe).
--    Solo el Admin. Devuelve el id de la fila en roles_usuarios.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.asignar_rol_usuario(p_user_id text, p_rol text)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id integer;
  v_name text;
  v_email text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.roles_usuarios ru
    WHERE ru.user_id = auth.uid()::text AND ru.role::text = 'admin'
  ) THEN
    RAISE EXCEPTION 'Solo un administrador puede asignar roles';
  END IF;

  IF p_rol NOT IN ('admin', 'encargado', 'supervisor', 'rrhh', 'pendiente') THEN
    RAISE EXCEPTION 'Rol inválido: %', p_rol;
  END IF;

  SELECT
    COALESCE(NULLIF(u.raw_user_meta_data->>'name', ''), split_part(u.email, '@', 1)),
    u.email::text
  INTO v_name, v_email
  FROM auth.users u
  WHERE u.id::text = p_user_id;

  SELECT r.id INTO v_id FROM public.roles_usuarios r WHERE r.user_id = p_user_id;

  -- Literal dinámico: funciona tanto si `role` es TEXT como si es un ENUM.
  IF v_id IS NULL THEN
    EXECUTE format(
      'INSERT INTO public.roles_usuarios (user_id, name, email, role) VALUES (%L, %L, %L, %L) RETURNING id',
      p_user_id, COALESCE(v_name, p_user_id), COALESCE(v_email, ''), p_rol
    ) INTO v_id;
  ELSE
    EXECUTE format('UPDATE public.roles_usuarios SET role = %L WHERE id = %s', p_rol, v_id);
  END IF;

  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------
-- 6) RPC: asignar / quitar sucursal a un usuario (solo Admin).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.asignar_sucursal_usuario(p_manager_id integer, p_branch_id integer)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.roles_usuarios
    WHERE user_id = auth.uid()::text AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Solo un administrador puede asignar sucursales';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.encargados_sucursales
    WHERE manager_id = p_manager_id AND branch_id = p_branch_id
  ) THEN
    INSERT INTO public.encargados_sucursales (manager_id, branch_id)
    VALUES (p_manager_id, p_branch_id);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.quitar_sucursal_usuario(p_manager_id integer, p_branch_id integer)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.roles_usuarios
    WHERE user_id = auth.uid()::text AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Solo un administrador puede quitar sucursales';
  END IF;

  DELETE FROM public.encargados_sucursales
  WHERE manager_id = p_manager_id AND branch_id = p_branch_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.listar_usuarios() TO authenticated;
GRANT EXECUTE ON FUNCTION public.asignar_rol_usuario(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.asignar_sucursal_usuario(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.quitar_sucursal_usuario(integer, integer) TO authenticated;

-- ---------------------------------------------------------------------
-- 7) Verificación: todos los usuarios y su rol.
-- ---------------------------------------------------------------------
SELECT u.email, COALESCE(r.role, 'pendiente') AS rol
FROM auth.users u
LEFT JOIN public.roles_usuarios r ON r.user_id = u.id::text
ORDER BY u.created_at;
