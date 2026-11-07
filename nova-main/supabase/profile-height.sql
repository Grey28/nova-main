-- ============================================================
-- NovaFit - Altura en el perfil (primeros pasos)
-- Ejecuta en SQL Editor solo si tu tabla profiles ya existía
-- sin la columna height_cm.
-- ============================================================

alter table public.profiles
    add column if not exists height_cm numeric;
