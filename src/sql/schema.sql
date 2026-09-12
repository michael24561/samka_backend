-- ============================================================
-- SAMKA — Joyería artesanal peruana
-- schema.sql — PostgreSQL (base limpia, directa sin RLS)
-- Adaptado desde las migrations originales de Supabase
-- ============================================================

-- Enums
drop type if exists public.app_role cascade;
create type public.app_role as enum ('admin', 'customer');

drop type if exists public.order_status cascade;
create type public.order_status as enum ('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled');

drop type if exists public.payment_method cascade;
create type public.payment_method as enum ('yape', 'plin', 'card', 'mobile_wallet');

-- Usuarios (reemplaza auth.users + profiles de Supabase)
create table public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Roles de usuario
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique(user_id, role)
);
create index on public.user_roles(user_id);

-- Categorías
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  image_url text,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Productos
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  price numeric(10,2) not null check (price >= 0),
  stock int not null default 0 check (stock >= 0),
  low_stock_threshold int not null default 5,
  category_id uuid references public.categories(id) on delete set null,
  image_url text,
  gallery jsonb default '[]'::jsonb,
  featured boolean not null default false,
  active boolean not null default true,
  is_customizable boolean not null default false,
  materials text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.products(category_id);
create index on public.products(featured);

-- Atributos de producto (material, acabado, tamaño)
create table public.product_attributes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  attribute_type text not null,
  value text not null,
  price_modifier numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);
create index on public.product_attributes(product_id);

-- Materias primas (control de inventario de taller)
create table public.materials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null default 'g',
  stock numeric(12,3) not null default 0 check (stock >= 0),
  low_stock_threshold numeric(12,3) not null default 0,
  unit_cost numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Movimientos de materias primas (entradas/salidas)
create table public.material_movements (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials(id) on delete cascade,
  quantity numeric(12,3) not null,
  movement_type text not null, -- 'in' | 'out'
  reference text,
  created_at timestamptz not null default now()
);
create index on public.material_movements(material_id);

-- Opciones de personalización de piezas
create table public.personalization_options (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade,
  option_type text not null, -- 'engraving', 'material', 'size', 'gem'
  label text not null,
  choices jsonb default '[]'::jsonb,
  price_modifier numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);

-- Pedidos
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  order_number text not null unique default ('SMK-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  full_name text not null,
  phone text not null,
  email text not null,
  address text not null,
  city text not null,
  notes text,
  eco_packaging boolean not null default false,
  subtotal numeric(10,2) not null,
  shipping numeric(10,2) not null default 0,
  total numeric(10,2) not null,
  status order_status not null default 'pending',
  payment_method payment_method not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.orders(user_id);
create index on public.orders(status);
create index on public.orders(order_number);

-- Ítems de pedido
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  product_image text,
  unit_price numeric(10,2) not null,
  quantity int not null check (quantity > 0),
  selected_attributes jsonb default '{}'::jsonb,
  customization jsonb default '{}'::jsonb,
  subtotal numeric(10,2) not null,
  created_at timestamptz not null default now()
);
create index on public.order_items(order_id);

-- Historial de estados (seguimiento de pedidos)
create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status order_status not null,
  note text,
  created_at timestamptz not null default now()
);
create index on public.order_status_history(order_id);

-- Pagos (pasarela simulada)
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  amount numeric(10,2) not null,
  method payment_method not null,
  status text not null default 'simulated',
  transaction_ref text not null default ('SIM-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))),
  created_at timestamptz not null default now()
);
create index on public.payments(order_id);

-- Errores de taller
create table public.workshop_errors (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  error_type text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Alertas de stock mínimo
create table public.stock_alerts (
  id uuid primary key default gen_random_uuid(),
  scope text not null, -- 'product' | 'material'
  ref_id uuid not null,
  ref_name text not null,
  current_stock numeric(12,3) not null,
  threshold numeric(12,3) not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- ============================================================
-- Funciones / Triggers
-- ============================================================

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

create trigger trg_users_updated before update on public.users
  for each row execute function public.set_updated_at();
create trigger trg_products_updated before update on public.products
  for each row execute function public.set_updated_at();
create trigger trg_orders_updated before update on public.orders
  for each row execute function public.set_updated_at();
create trigger trg_materials_updated before update on public.materials
  for each row execute function public.set_updated_at();
create trigger trg_workshop_errors_updated before update on public.workshop_errors
  for each row execute function public.set_updated_at();

-- Descontar stock de producto al crear order_item
create or replace function public.decrement_stock()
returns trigger language plpgsql as $$
begin
  update public.products set stock = greatest(0, stock - new.quantity)
  where id = new.product_id and new.product_id is not null;
  return new;
end; $$;

create trigger trg_decrement_stock
  after insert on public.order_items
  for each row execute function public.decrement_stock();
