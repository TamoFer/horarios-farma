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
-- 6b) RPC: eliminar un usuario (solo Admin, no puede borrarse a sí mismo).
--     Borra sus sucursales, su fila en roles_usuarios y el usuario de auth.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.eliminar_usuario(p_user_id text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.roles_usuarios ru
    WHERE ru.user_id = auth.uid()::text AND ru.role::text = 'admin'
  ) THEN
    RAISE EXCEPTION 'Solo un administrador puede eliminar usuarios';
  END IF;

  IF p_user_id = auth.uid()::text THEN
    RAISE EXCEPTION 'No podés eliminar tu propio usuario';
  END IF;

  DELETE FROM public.encargados_sucursales
  WHERE manager_id IN (
    SELECT id FROM public.roles_usuarios WHERE user_id = p_user_id
  );

  DELETE FROM public.roles_usuarios WHERE user_id = p_user_id;

  DELETE FROM auth.users WHERE id::text = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.eliminar_usuario(text) TO authenticated;

-- ---------------------------------------------------------------------
-- 6c) RPC para administrar sucursales (solo Admin).
--     - listar_encargados(): sucursal -> user_id del encargado.
--     - set_encargado_sucursal(): fija (o quita) el encargado de una
--       sucursal. Si el usuario está 'pendiente', pasa a 'encargado'.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.listar_encargados()
RETURNS TABLE(branch_id integer, user_id text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.roles_usuarios ru
    WHERE ru.user_id = auth.uid()::text AND ru.role::text = 'admin'
  ) THEN
    RAISE EXCEPTION 'Solo un administrador puede listar encargados';
  END IF;

  RETURN QUERY
  SELECT es.branch_id, r.user_id
  FROM public.encargados_sucursales es
  JOIN public.roles_usuarios r ON r.id = es.manager_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_encargados_sucursal(p_branch_id integer, p_user_ids text[])
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid text;
  v_roles_id integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.roles_usuarios ru
    WHERE ru.user_id = auth.uid()::text AND ru.role::text = 'admin'
  ) THEN
    RAISE EXCEPTION 'Solo un administrador puede asignar encargados';
  END IF;

  -- Reemplaza los encargados actuales de la sucursal por los indicados.
  DELETE FROM public.encargados_sucursales WHERE branch_id = p_branch_id;

  IF p_user_ids IS NULL THEN
    RETURN;
  END IF;

  FOR v_uid IN SELECT DISTINCT u FROM unnest(p_user_ids) AS u LOOP
    SELECT r.id INTO v_roles_id FROM public.roles_usuarios r WHERE r.user_id = v_uid;
    IF v_roles_id IS NULL THEN
      RAISE EXCEPTION 'Usuario inexistente: %', v_uid;
    END IF;

    IF (SELECT r.role::text FROM public.roles_usuarios r WHERE r.id = v_roles_id) = 'pendiente' THEN
      EXECUTE format('UPDATE public.roles_usuarios SET role = %L WHERE id = %s', 'encargado', v_roles_id);
    END IF;

    INSERT INTO public.encargados_sucursales (manager_id, branch_id)
    VALUES (v_roles_id, p_branch_id);
  END LOOP;
END;
$$;

DROP FUNCTION IF EXISTS public.set_encargado_sucursal(integer, text);

GRANT EXECUTE ON FUNCTION public.listar_encargados() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_encargados_sucursal(integer, text[]) TO authenticated;

-- ---------------------------------------------------------------------
-- 6d) Vínculo entre un usuario de la plataforma y su ficha de empleado.
--     - `empleados.user_id` guarda el id de auth del usuario vinculado.
--     - Un usuario no puede estar vinculado a dos empleados.
-- ---------------------------------------------------------------------
ALTER TABLE public.empleados ADD COLUMN IF NOT EXISTS user_id text;

CREATE UNIQUE INDEX IF NOT EXISTS empleados_user_id_key
  ON public.empleados (user_id) WHERE user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.listar_empleados()
RETURNS TABLE(id integer, nombre text, sucursal text, user_id text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.roles_usuarios ru
    WHERE ru.user_id = auth.uid()::text AND ru.role::text = 'admin'
  ) THEN
    RAISE EXCEPTION 'Solo un administrador puede listar empleados';
  END IF;

  RETURN QUERY
  SELECT e.id, e.nombre::text, COALESCE(s.nombre_suc::text, ''), e.user_id
  FROM public.empleados e
  LEFT JOIN public.sucursales s ON s.id = e.branch_id
  WHERE e.trabajando = true
  ORDER BY s.nombre_suc, e.nombre;
END;
$$;

-- Vincula al usuario con un empleado. Con p_empleado_id = NULL lo desvincula.
CREATE OR REPLACE FUNCTION public.vincular_empleado(p_user_id text, p_empleado_id integer)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.roles_usuarios ru
    WHERE ru.user_id = auth.uid()::text AND ru.role::text = 'admin'
  ) THEN
    RAISE EXCEPTION 'Solo un administrador puede vincular empleados';
  END IF;

  -- Un usuario no puede estar en dos empleados: se limpia el anterior.
  UPDATE public.empleados SET user_id = NULL WHERE user_id = p_user_id;

  IF p_empleado_id IS NOT NULL THEN
    UPDATE public.empleados SET user_id = p_user_id WHERE id = p_empleado_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.listar_empleados() TO authenticated;
GRANT EXECUTE ON FUNCTION public.vincular_empleado(text, integer) TO authenticated;

-- ---------------------------------------------------------------------
-- 6e) Sucursal abierta 24 hs (define si tiene área de noche / nochero).
-- ---------------------------------------------------------------------
ALTER TABLE public.sucursales ADD COLUMN IF NOT EXISTS es_24hs boolean NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------
-- 7) Verificación: todos los usuarios y su rol.
-- ---------------------------------------------------------------------
SELECT u.email, COALESCE(r.role, 'pendiente') AS rol
FROM auth.users u
LEFT JOIN public.roles_usuarios r ON r.user_id = u.id::text
ORDER BY u.created_at;
