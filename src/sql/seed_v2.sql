-- ============================================================
-- SAMKA v2 — seed.sql (datos iniciales)
-- ============================================================

-- 1. Roles
insert into public.roles_usuario (nombre, descripcion) values
  ('admin', 'Administrador del sistema'),
  ('cliente', 'Cliente de la tienda')
on conflict (nombre) do nothing;

-- 2. [El usuario administrador lo crea scripts/seed.mjs con bcrypt correcto]

-- 3. Métodos de pago
insert into public.metodos_pago (nombre, descripcion) values
  ('Mercado Pago', 'Pago seguro vía Mercado Pago (tarjetas y más)')
on conflict (nombre) do nothing;

-- 4. Categorías
insert into public.categorias (nombre, slug, descripcion, orden_visual) values
  ('Anillos', 'anillos', 'Anillos artesanales de plata peruana', 1),
  ('Collares', 'collares', 'Collares personalizados', 2),
  ('Aretes', 'aretes', 'Aretes y pendientes artesanales', 3),
  ('Pulseras', 'pulseras', 'Pulseras y charreras', 4)
on conflict (slug) do nothing;

-- 5. Productos
insert into public.productos
  (id_categoria, nombre, slug, descripcion, precio, stock, stock_minimo,
   material, color, peso, imagen_principal, destacado, personalizable)
values
  ((select id_categoria from public.categorias where slug='anillos'), 'Anillo Luna', 'anillo-luna',
   'Anillo artesanal con acabado mate y grabado opcional.', 89.00, 12, 3,
   'Plata 925', 'Plata', 8.000,
   'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=600', true, true),
  ((select id_categoria from public.categorias where slug='collares'), 'Collar Estrella', 'collar-estrella',
   'Collar con colgante estrella de plata 925.', 120.00, 8, 3,
   'Plata 925', 'Plata', 15.000,
   'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600', true, false),
  ((select id_categoria from public.categorias where slug='aretes'), 'Aretes Andinos', 'aretes-andinos',
   'Pendientes inspirados en la cultura andina.', 65.00, 15, 3,
   'Plata 925', 'Plata', 6.000,
   'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=600', false, false),
  ((select id_categoria from public.categorias where slug='pulseras'), 'Pulsera Inti', 'pulsera-inti',
   'Pulsera con dije del sol, personalizable con nombre.', 45.00, 20, 5,
   'Plata 925', 'Dorado', 20.000,
   'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=600', false, true)
on conflict (slug) do nothing;

-- 6. Imágenes de productos
insert into public.imagenes_producto (id_producto, imagen_url, orden_visual, principal)
select p.id_producto, p.imagen_principal, 0, true
from public.productos p
on conflict (id_imagen) do nothing;
