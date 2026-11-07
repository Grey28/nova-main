-- ============================================================
-- NovaFit - Esquema de base de datos para Supabase
-- Ejecuta este archivo completo en:
--   Supabase Dashboard > SQL Editor > New query > Run
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1. Perfiles
-- ------------------------------------------------------------
create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    full_name text,
    goal text default 'Mejorar condición física',
    level text default 'Principiante',
    avatar_url text,
    height_cm numeric,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 2. Rutinas
-- ------------------------------------------------------------
create table if not exists public.routines (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    description text,
    duration_min integer not null default 30,
    level text not null default 'Intermedio',
    progress integer not null default 0 check (progress between 0 and 100),
    created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 3. Entrenamientos completados
-- ------------------------------------------------------------
create table if not exists public.workouts (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    routine_id uuid references public.routines(id) on delete set null,
    duration_min integer,
    notes text,
    completed_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 4. Registro de nutrición
-- ------------------------------------------------------------
create table if not exists public.nutrition_logs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    log_date date not null default current_date,
    meal text,
    calories integer not null default 0,
    protein_g numeric not null default 0,
    water_l numeric not null default 0,
    created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 5. Medidas de progreso
-- ------------------------------------------------------------
create table if not exists public.progress_entries (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    weight_kg numeric,
    body_fat numeric,
    recorded_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Índices
-- ------------------------------------------------------------
create index if not exists routines_user_idx on public.routines(user_id);
create index if not exists workouts_user_idx on public.workouts(user_id, completed_at desc);
create index if not exists nutrition_user_date_idx on public.nutrition_logs(user_id, log_date);
create index if not exists progress_user_date_idx on public.progress_entries(user_id, recorded_at desc);

-- ------------------------------------------------------------
-- Seguridad a nivel de fila (RLS)
-- Cada usuario solo puede leer y escribir sus propios datos.
-- ------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.routines enable row level security;
alter table public.workouts enable row level security;
alter table public.nutrition_logs enable row level security;
alter table public.progress_entries enable row level security;

drop policy if exists "profiles_own" on public.profiles;
create policy "profiles_own" on public.profiles
    for all
    using (auth.uid() = id)
    with check (auth.uid() = id);

drop policy if exists "routines_own" on public.routines;
create policy "routines_own" on public.routines
    for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

drop policy if exists "workouts_own" on public.workouts;
create policy "workouts_own" on public.workouts
    for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

drop policy if exists "nutrition_own" on public.nutrition_logs;
create policy "nutrition_own" on public.nutrition_logs
    for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

drop policy if exists "progress_own" on public.progress_entries;
create policy "progress_own" on public.progress_entries
    for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- Actualizar updated_at automáticamente en los perfiles
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
    before update on public.profiles
    for each row
    execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Crear perfil y rutinas iniciales al registrar un usuario
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, full_name)
    values (
        new.id,
        coalesce(
            nullif(new.raw_user_meta_data->>'full_name', ''),
            split_part(new.email, '@', 1)
        )
    )
    on conflict (id) do nothing;

    insert into public.routines (user_id, name, description, duration_min, level, progress)
    values
        (new.id, 'Pierna y glúteos', 'Fuerza de tren inferior', 45, 'Intermedio', 30),
        (new.id, 'Tren superior', 'Espalda, pecho y brazos', 40, 'Intermedio', 0),
        (new.id, 'Cardio', 'Cardio moderado', 30, 'Principiante', 0);

    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row
    execute function public.handle_new_user();
