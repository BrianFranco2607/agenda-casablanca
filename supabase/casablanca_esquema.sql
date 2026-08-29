-- ============================================================
-- Casablanca Nail Spa & Lounge — Supabase PROPIO (aislado)
-- Codigo multi-tenant desplegado con UN solo tenant (Casablanca).
-- Config (estilistas con % por persona, servicios) vive en la BD.
--
-- ORDEN DE USO:
--   PARTE A  -> pegar y ejecutar completo en el SQL Editor.
--   Luego crear el usuario dueno en Authentication -> Users.
--   PARTE B  -> descomentar al final y ejecutar con el UUID del usuario.
-- ============================================================

-- ------------------------------------------------------------
-- FUNCIONES DE TENANT  (van en public, NUNCA en auth)
-- ------------------------------------------------------------
create or replace function public.tenant_id()
returns uuid language sql stable security definer set search_path = public
as $$ select tenant_id from profiles where id = auth.uid() $$;

create or replace function public.rol_actual()
returns text language sql stable security definer set search_path = public
as $$ select rol from profiles where id = auth.uid() $$;


-- ------------------------------------------------------------
-- TENANTS / PROFILES
-- ------------------------------------------------------------
create table if not exists tenants (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  tipo_negocio  text not null default 'salon' check (tipo_negocio in ('salon','retail','construccion')),
  modulos       jsonb not null default '{}',
  branding      jsonb not null default '{}',
  plan          text not null default 'free',
  activo        boolean not null default true,
  creado_en     timestamptz not null default now()
);

create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  tenant_id  uuid not null references tenants(id),
  rol        text not null default 'dueno' check (rol in ('dueno','admin','empleado')),
  nombre     text,
  creado_en  timestamptz not null default now()
);


-- ------------------------------------------------------------
-- CONFIG POR TENANT
--   tenant_estilistas.porcentaje = fraccion que se lleva la persona.
--   Duenas: 0.500 - nuevas contrataciones: 0.600 (default).
-- ------------------------------------------------------------
create table if not exists tenant_estilistas (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id),
  nombre     text not null,
  porcentaje numeric(4,3) not null default 0.600,
  activo     boolean not null default true,
  orden      integer not null default 0
);

create table if not exists tenant_servicios (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id),
  nombre     text not null,
  precio     integer not null default 0,
  duracion   integer not null default 30,
  frecuencia integer not null default 0,
  solo_dueno boolean not null default false,
  activo     boolean not null default true,
  orden      integer not null default 0
);


-- ------------------------------------------------------------
-- TABLAS DE NEGOCIO
-- ------------------------------------------------------------
create table if not exists citas (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id),
  cliente      text not null,
  telefono     text,
  servicio     text,
  estilista    text,
  precio       integer not null default 0,
  producto     integer not null default 0,   -- se conserva por compatibilidad; en Casablanca queda en 0
  duracion     integer not null default 30,
  fecha        date not null,
  hora         time not null,
  estado       text not null default 'pendiente'
               check (estado in ('pendiente','confirmada','completada','no_show','cancelada')),
  recordado    boolean not null default false,
  notas        text,
  acepta_promos boolean not null default false,
  metodo_pago  text default 'efectivo' check (metodo_pago in ('efectivo','transferencia')),
  cumple       text,
  creado_en    timestamptz not null default now()
);

create table if not exists cita_servicios (
  id        uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  cita_id   uuid not null references citas(id) on delete cascade,
  servicio  text not null,
  estilista text not null,
  precio    integer not null default 0,
  producto  integer not null default 0
);

create table if not exists cita_pagos (
  id        uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  cita_id   uuid not null references citas(id) on delete cascade,
  metodo    text not null check (metodo in ('efectivo','transferencia')),
  monto     integer not null default 0
);

create table if not exists leads (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id),
  created_at timestamptz not null default now(),
  nombre     text not null,
  telefono   text,
  interes    text,
  origen     text,
  notas      text,
  estado     text not null default 'nuevo' check (estado in ('nuevo','contactado','agendo','perdido')),
  acepta_promos boolean not null default false
);

create table if not exists movimientos (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id),
  created_at timestamptz not null default now(),
  fecha      date not null,
  tipo       text not null check (tipo in ('gasto','vale','producto')),
  estilista  text,
  monto      integer not null default 0,
  detalle    text,
  metodo_pago text default 'efectivo' check (metodo_pago in ('efectivo','transferencia'))
);

create table if not exists base_diaria (
  id        uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  fecha     date not null,
  monto     integer not null default 0,
  unique (tenant_id, fecha)
);


-- ------------------------------------------------------------
-- INDICES
-- ------------------------------------------------------------
create index if not exists idx_citas_tenant_fecha  on citas(tenant_id, fecha);
create index if not exists idx_cita_servicios_cita on cita_servicios(cita_id);
create index if not exists idx_cita_pagos_cita     on cita_pagos(cita_id);
create index if not exists idx_movimientos_tenant  on movimientos(tenant_id, fecha);
create index if not exists idx_tenant_estilistas_t on tenant_estilistas(tenant_id);
create index if not exists idx_tenant_servicios_t  on tenant_servicios(tenant_id);


-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table tenants           enable row level security;
alter table profiles          enable row level security;
alter table tenant_estilistas enable row level security;
alter table tenant_servicios  enable row level security;
alter table citas             enable row level security;
alter table cita_servicios    enable row level security;
alter table cita_pagos        enable row level security;
alter table leads             enable row level security;
alter table movimientos       enable row level security;
alter table base_diaria       enable row level security;

-- perfil propio y su tenant
create policy p_profiles_self on profiles for select to authenticated using (id = auth.uid());
create policy p_tenants_own   on tenants  for select to authenticated using (id = public.tenant_id());

-- config y negocio: todo acotado al tenant del usuario
create policy t_estilistas on tenant_estilistas for all to authenticated
  using (tenant_id = public.tenant_id()) with check (tenant_id = public.tenant_id());
create policy t_servicios  on tenant_servicios  for all to authenticated
  using (tenant_id = public.tenant_id()) with check (tenant_id = public.tenant_id());
create policy t_citas      on citas             for all to authenticated
  using (tenant_id = public.tenant_id()) with check (tenant_id = public.tenant_id());
create policy t_cita_serv  on cita_servicios    for all to authenticated
  using (tenant_id = public.tenant_id()) with check (tenant_id = public.tenant_id());
create policy t_cita_pagos on cita_pagos        for all to authenticated
  using (tenant_id = public.tenant_id()) with check (tenant_id = public.tenant_id());
create policy t_leads      on leads             for all to authenticated
  using (tenant_id = public.tenant_id()) with check (tenant_id = public.tenant_id());
create policy t_movs       on movimientos       for all to authenticated
  using (tenant_id = public.tenant_id()) with check (tenant_id = public.tenant_id());
create policy t_base       on base_diaria       for all to authenticated
  using (tenant_id = public.tenant_id()) with check (tenant_id = public.tenant_id());


-- ============================================================
-- SEED  (el SQL Editor corre como service role y salta RLS)
-- ============================================================
insert into tenants (id, nombre, tipo_negocio, plan, activo, branding)
values (
  'ca5b1a0c-0000-4000-8000-000000000001',
  'Casablanca Nail Spa & Lounge',
  'salon', 'free', true,
  '{"nombre":"Casablanca Nail Spa & Lounge","codigoPais":"57","color":"#B8892E"}'
);

-- Estilistas duenas al 50%
insert into tenant_estilistas (tenant_id, nombre, porcentaje, orden) values
('ca5b1a0c-0000-4000-8000-000000000001', 'Dufay Linares',     0.500, 1),
('ca5b1a0c-0000-4000-8000-000000000001', 'Alejandra Agudelo', 0.500, 2);

-- Servicios (precios reales de la lista; frecuencia/duracion = propuesta, ajustable)
insert into tenant_servicios (tenant_id, nombre, precio, duracion, frecuencia, orden) values
('ca5b1a0c-0000-4000-8000-000000000001', 'Manicure tradicional',                 30000,  30, 15,  1),
('ca5b1a0c-0000-4000-8000-000000000001', 'Manicure semipermanente',              55000,  45, 21,  2),
('ca5b1a0c-0000-4000-8000-000000000001', 'Manicure semipermanente caballero',    45000,  45, 21,  3),
('ca5b1a0c-0000-4000-8000-000000000001', 'Base Rubber',                          60000,  60, 21,  4),
('ca5b1a0c-0000-4000-8000-000000000001', 'Pedicure tradicional',                 45000,  45, 30,  5),
('ca5b1a0c-0000-4000-8000-000000000001', 'Pedicure semipermanente',              65000,  50, 30,  6),
('ca5b1a0c-0000-4000-8000-000000000001', 'Pedicure clinico',                     60000,  60, 45,  7),
('ca5b1a0c-0000-4000-8000-000000000001', 'Soft gel',                             90000,  90, 21,  8),
('ca5b1a0c-0000-4000-8000-000000000001', 'Acrilico con tips',                   105000, 120, 21,  9),
('ca5b1a0c-0000-4000-8000-000000000001', 'Acrilico esculpido',                  140000, 150, 21, 10),
('ca5b1a0c-0000-4000-8000-000000000001', 'Polygel con tips',                    105000, 120, 21, 11),
('ca5b1a0c-0000-4000-8000-000000000001', 'Bano acrilico',                        90000,  90, 21, 12),
('ca5b1a0c-0000-4000-8000-000000000001', 'Bano Polygel',                         90000,  90, 21, 13),
('ca5b1a0c-0000-4000-8000-000000000001', 'Tecnica mixta (recubrimiento y ext.)', 90000, 120, 21, 14),
('ca5b1a0c-0000-4000-8000-000000000001', 'Capping',                              70000,  60, 21, 15),
('ca5b1a0c-0000-4000-8000-000000000001', 'Retoque acrilico',                     80000,  90, 21, 16),
('ca5b1a0c-0000-4000-8000-000000000001', 'Una acrilica adicional',               12000,  10,  0, 17),
('ca5b1a0c-0000-4000-8000-000000000001', 'Una soft gel adicional',                8000,  10,  0, 18),
('ca5b1a0c-0000-4000-8000-000000000001', 'Remiendo de una',                       8000,  15,  0, 19),
('ca5b1a0c-0000-4000-8000-000000000001', 'Retiro de semipermanente',             12000,  20,  0, 20),
('ca5b1a0c-0000-4000-8000-000000000001', 'Retiro de sistemas artificiales',      18000,  30,  0, 21),
('ca5b1a0c-0000-4000-8000-000000000001', 'Piedras y dijes',                       5000,  10,  0, 22);


-- ============================================================
-- PARTE B  — ejecutar DESPUES de crear el usuario dueno en
-- Authentication -> Users. Reemplaza <UUID_DEL_USUARIO> por el
-- UUID que te muestra Supabase para ese usuario.
-- ============================================================
-- insert into profiles (id, tenant_id, rol, nombre)
-- values ('<UUID_DEL_USUARIO>', 'ca5b1a0c-0000-4000-8000-000000000001', 'dueno', 'Casablanca');
