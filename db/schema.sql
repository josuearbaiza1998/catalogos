-- Esquema de catalogos (PostgreSQL 15+). Idempotente: se aplica solo al primer request.
-- Escrituras: el editor sincroniza en lotes. Lecturas: el catálogo público lee UNA fila
-- desnormalizada por prenda (portada + galería incluidas), filtrada por un índice parcial.

create table if not exists tenants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

create table if not exists catalogs (
  id             uuid primary key,
  tenant_id      uuid references tenants(id) on delete cascade,
  slug           text not null unique,
  name           text not null default '',
  distributor    text not null default '',
  whatsapp       text not null default '',
  message        text not null default '',
  edit_key_hash  text not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists products (
  catalog_id   uuid not null references catalogs(id) on delete cascade,
  key          text not null,                  -- código normalizado (A-Z0-9), clave del matching
  code         text not null,                  -- código tal como lo escribió la distribuidora
  brand        text not null default '',
  colors       text[] not null default '{}',
  sizes        text[] not null default '{}',
  existencia   boolean not null default true,  -- false ⇒ el cliente final no lo ve
  attrs        jsonb not null default '{}',    -- columnas extra del Excel (otros rubros)
  cover_url    text,                           -- desnormalizado para lectura en una sola consulta
  image_urls   text[] not null default '{}',
  position     integer not null default 0,
  updated_at   timestamptz not null default now(),
  primary key (catalog_id, key)
);

-- Lectura del catálogo público: sólo lo que está en existencia, en orden del lienzo.
create index if not exists products_public_idx
  on products (catalog_id, position) where existencia;
-- Filtros por color/talla del lado del servidor (catálogos grandes).
create index if not exists products_colors_gin on products using gin (colors);
create index if not exists products_sizes_gin  on products using gin (sizes);

-- Registro de los archivos del bucket (deduplicación por hash, auditoría y variantes).
create table if not exists assets (
  catalog_id   uuid not null references catalogs(id) on delete cascade,
  sha256       text not null,
  storage_key  text not null,
  content_type text not null,
  bytes        integer not null,
  created_at   timestamptz not null default now(),
  primary key (catalog_id, sha256)
);
