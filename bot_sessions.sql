-- migrations/bot_sessions.sql
-- Tabla para guardar el historial de conversación del bot de WhatsApp

create table if not exists bot_sessions (
  id          uuid primary key default gen_random_uuid(),
  phone       text not null unique,          -- número de WhatsApp del usuario
  history     jsonb not null default '[]',   -- array de mensajes { role, content }
  updated_at  timestamptz not null default now()
);

-- Índice para búsquedas rápidas por número
create index if not exists idx_bot_sessions_phone on bot_sessions(phone);

-- RLS: solo el service role puede leer/escribir (el bot corre server-side)
alter table bot_sessions enable row level security;

create policy "Service role full access"
  on bot_sessions
  for all
  using (auth.role() = 'service_role');

-- Auto-actualizar updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger bot_sessions_updated_at
  before update on bot_sessions
  for each row execute function update_updated_at();
