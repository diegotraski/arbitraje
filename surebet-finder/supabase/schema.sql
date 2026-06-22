-- Ejecuta este script en el SQL Editor de tu proyecto Supabase
-- (https://app.supabase.com -> tu proyecto -> SQL Editor -> New query)

create extension if not exists "uuid-ossp";

-- Casas de apuestas soportadas
create table if not exists bookmakers (
  id serial primary key,
  key text unique not null,        -- ej: 'bet365', 'william_hill', 'betway', 'betfair', 'winamax'
  name text not null
);

insert into bookmakers (key, name) values
  ('bet365', 'Bet365'),
  ('william_hill', 'William Hill'),
  ('betway', 'Betway'),
  ('betfair', 'Betfair'),
  ('winamax', 'Winamax')
on conflict (key) do nothing;

-- Eventos deportivos normalizados (un evento puede venir de varias fuentes)
create table if not exists events (
  id uuid primary key default uuid_generate_v4(),
  sport_key text not null,
  normalized_name text not null,   -- "equipo_local__vs__equipo_visitante" en minúsculas, sin acentos
  home_team text,
  away_team text,
  commence_time timestamptz,
  created_at timestamptz default now(),
  unique (sport_key, normalized_name, commence_time)
);

-- Cuotas individuales por casa de apuestas y mercado
create table if not exists odds (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid references events(id) on delete cascade,
  bookmaker_key text references bookmakers(key),
  market text not null,            -- 'h2h' (1x2 / moneyline), 'h2h_3way', etc.
  outcome_name text not null,      -- 'home', 'draw', 'away' o nombre del equipo
  price numeric not null,          -- cuota decimal (ej. 2.10)
  fetched_at timestamptz default now()
);

create index if not exists idx_odds_event on odds(event_id);
create index if not exists idx_odds_fetched_at on odds(fetched_at desc);

-- Surebets detectadas (histórico + estado actual)
create table if not exists surebets (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid references events(id) on delete cascade,
  market text not null,
  profit_percent numeric not null,
  details jsonb not null,          -- combinación de casas/cuotas/stakes usada
  detected_at timestamptz default now(),
  is_active boolean default true
);

create index if not exists idx_surebets_active on surebets(is_active, detected_at desc);

-- Limpieza opcional: borra cuotas con más de 2 horas para no acumular basura
-- (puedes programar esto como otra Vercel Cron Function si quieres)
-- delete from odds where fetched_at < now() - interval '2 hours';
