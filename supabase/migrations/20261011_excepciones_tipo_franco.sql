-- =====================================================================
-- Habilita el tipo de excepción 'franco' (cambio de día de franco).
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query (Run).
-- Proyecto: el mismo que usa la app (gkqacjcqeljjyhzdtpgv.supabase.co).
-- Es idempótico: se puede ejecutar más de una vez sin romper nada.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Diagnóstico: cómo está definida la columna `tipo`.
--    Debería decir data_type = 'text'. Si dice 'USER-DEFINED', es un
--    ENUM (poco probable) — ver la NOTA del final.
-- ---------------------------------------------------------------------
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'excepciones'
  AND column_name = 'tipo';

-- ---------------------------------------------------------------------
-- 2) Eliminar TODAS las restricciones CHECK sobre la columna `tipo`,
--    sea cual sea su nombre (por si no se llama excepciones_tipo_check),
--    y crear una nueva que incluya 'franco'.
-- ---------------------------------------------------------------------
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.excepciones'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%tipo%'
  LOOP
    EXECUTE format('ALTER TABLE public.excepciones DROP CONSTRAINT %I', c.conname);
    RAISE NOTICE 'CHECK eliminada: %', c.conname;
  END LOOP;
END $$;

ALTER TABLE public.excepciones
  ADD CONSTRAINT excepciones_tipo_check
  CHECK (tipo IN ('fija', 'espontanea', 'franco'));

-- ---------------------------------------------------------------------
-- 3) Verificación: tiene que listar la constraint nueva con los tres
--    valores ('fija', 'espontanea', 'franco').
-- ---------------------------------------------------------------------
SELECT conname, pg_get_constraintdef(oid) AS definicion
FROM pg_constraint
WHERE conrelid = 'public.excepciones'::regclass
  AND contype = 'c';

-- ---------------------------------------------------------------------
-- NOTA: si en el paso 1 `data_type` es 'USER-DEFINED', la columna es un
-- tipo ENUM en lugar de TEXT, y el ALTER TABLE de arriba no alcanza
-- (fallará con "invalid input value"). En ese caso, tomá el nombre que
-- aparezca en `udt_name` y ejecutá:
--
--   ALTER TYPE public.<udt_name> ADD VALUE IF NOT EXISTS 'franco';
--
-- (En PostgreSQL >= 12 se puede correr en una consulta suelta; no la
-- combines con otros comandos en la misma transacción.)
-- ---------------------------------------------------------------------
