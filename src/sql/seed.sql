-- ============================================================
-- SAMKA — seed.sql (datos de catálogo de ejemplo)
-- ============================================================

-- Categorías
insert into public.categories (name, slug, description, display_order) values
  ('Anillos', 'anillos', 'Anillos artesanales de plata peruana', 1),
  ('Collares', 'collares', 'Collares personalizados', 2),
  ('Aretes', 'aretes', 'Aretes y pendientes artesanales', 3),
  ('Pulseras', 'pulseras', 'Pulseras y charreras', 4)
on conflict (slug) do nothing;

-- Materias primas base
insert into public.materials (name, unit, stock, low_stock_threshold, unit_cost) values
  ('Plata 925', 'g', 1000, 200, 3.50),
  ('Oro 18k', 'g', 150, 30, 180.00),
  ('Piedra preciosa', 'un', 80, 20, 25.00),
  ('Cordón de cuero', 'm', 300, 50, 2.00)
on conflict (id) do nothing;

-- Productos
insert into public.products (name, slug, description, price, stock, low_stock_threshold, category_id, featured, is_customizable) values
  ('Anillo Luna', 'anillo-luna', 'Anillo artesanal con acabado mate y grabado opcional.', 89.00, 12, 3, (select id from public.categories where slug='anillos'), true, true),
  ('Collar Estrella', 'collar-estrella', 'Collar con colgante estrella de plata 925.', 120.00, 8, 3, (select id from public.categories where slug='collares'), true, false),
  ('Aretes Andinos', 'aretes-andinos', 'Pendientes inspirados en la cultura andina.', 65.00, 15, 3, (select id from public.categories where slug='aretes'), false, false),
  ('Pulsera Inti', 'pulsera-inti', 'Pulsera con dije del sol, personalizable con nombre.', 45.00, 20, 5, (select id from public.categories where slug='pulseras'), false, true)
on conflict (slug) do nothing;

-- Atributos de ejemplo para el Anillo Luna
insert into public.product_attributes (product_id, attribute_type, value, price_modifier) values
  ((select id from public.products where slug='anillo-luna'), 'acabado', 'Mate', 0),
  ((select id from public.products where slug='anillo-luna'), 'acabado', 'Pulido', 10.00),
  ((select id from public.products where slug='anillo-luna'), 'tamaño', 'Talla 12', 0)
on conflict (id) do nothing;

-- Opciones de personalización
insert into public.personalization_options (product_id, option_type, label, choices, price_modifier) values
  ((select id from public.products where slug='anillo-luna'), 'engraving', 'Grabado interior', '["-","Nombre","Iniciales","Fecha"]'::jsonb, 15.00),
  ((select id from public.products where slug='pulsera-inti'), 'engraving', 'Nombre grabado', '["-","Nombre","Iniciales"]'::jsonb, 10.00)
on conflict (id) do nothing;
