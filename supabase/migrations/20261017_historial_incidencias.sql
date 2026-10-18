-- =====================================================================
-- Agrega la columna `incidencias` a `historial_horarios` para registrar
-- faltas y retiros anticipados del día (quedan asentados en el horario
-- de ese día y visibles en el historial).
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query (Run).
-- Es idempótente: se puede ejecutar más de una vez sin romper nada.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Crear la columna si no existe. Guarda un JSON array del tipo:
--    [{ "id": "uuid", "employeeId": 1, "employeeName": "Juan Pérez",
--       "type": "falta" | "retiro_temprano", "time": 14, "note": null }]
-- ---------------------------------------------------------------------
ALTER TABLE public.historial_horarios
  ADD COLUMN IF NOT EXISTS incidencias TEXT NOT NULL DEFAULT '[]';

-- ---------------------------------------------------------------------
-- 2) Verificación: tiene que listar la columna con data_type = text y
--    default '[]'::text.
-- ---------------------------------------------------------------------
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'historial_horarios'
  AND column_name = 'incidencias';
