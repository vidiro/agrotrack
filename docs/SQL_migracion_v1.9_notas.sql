-- AGROtrack v1.9 · Recordatorios del campo (con foto, finca y fecha)
-- Pegar en Supabase → SQL Editor → New query → Run. Se puede ejecutar más de una vez.

create table if not exists public.notas_campo (
  id uuid primary key default gen_random_uuid(),
  texto text not null,
  id_finca text,
  foto_path text,
  fecha_limite date,
  hecho boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notas_campo_pendientes_idx on public.notas_campo (hecho, fecha_limite);

alter table public.notas_campo enable row level security;

drop policy if exists "notas_campo usuarios" on public.notas_campo;
create policy "notas_campo usuarios" on public.notas_campo
  for all to authenticated using (true) with check (true);

notify pgrst, 'reload schema';
