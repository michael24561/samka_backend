CREATE EXTENSION IF NOT EXISTS pgcrypto;

BEGIN;

-- =========================================================
-- 1. ROLES
-- =========================================================

CREATE TABLE roles_usuario (
    id_rol UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion TEXT
);

-- =========================================================
-- 2. USUARIOS
-- =========================================================

CREATE TABLE usuarios (
    id_usuario UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_rol UUID NOT NULL,
    correo VARCHAR(150) NOT NULL UNIQUE,
    contrasena_hash TEXT NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100),
    telefono VARCHAR(30),
    imagen_perfil TEXT,
    estado BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_registro TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_usuario_rol
        FOREIGN KEY (id_rol)
        REFERENCES roles_usuario(id_rol)
);

CREATE INDEX idx_usuarios_rol
ON usuarios(id_rol);

-- =========================================================
-- 3. CATEGORIAS
-- =========================================================

CREATE TABLE categorias (
    id_categoria UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(120) NOT NULL UNIQUE,
    descripcion TEXT,
    imagen_url TEXT,
    orden_visual INTEGER NOT NULL DEFAULT 0,
    estado BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- 4. PRODUCTOS
-- =========================================================

CREATE TABLE productos (
    id_producto UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_categoria UUID,
    nombre VARCHAR(150) NOT NULL,
    slug VARCHAR(180) NOT NULL UNIQUE,
    descripcion TEXT,
    precio NUMERIC(10,2) NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    stock_minimo INTEGER NOT NULL DEFAULT 5,
    material VARCHAR(100),
    color VARCHAR(50),
    peso NUMERIC(10,3),
    imagen_principal TEXT,
    destacado BOOLEAN NOT NULL DEFAULT FALSE,
    personalizable BOOLEAN NOT NULL DEFAULT FALSE,
    estado BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_producto_categoria
        FOREIGN KEY (id_categoria)
        REFERENCES categorias(id_categoria)
        ON DELETE SET NULL,

    CONSTRAINT chk_producto_precio
        CHECK (precio >= 0),

    CONSTRAINT chk_producto_stock
        CHECK (stock >= 0)
);

CREATE INDEX idx_productos_categoria
ON productos(id_categoria);

-- =========================================================
-- 5. IMAGENES DE PRODUCTOS
-- =========================================================

CREATE TABLE imagenes_producto (
    id_imagen UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_producto UUID NOT NULL,
    imagen_url TEXT NOT NULL,
    orden_visual INTEGER NOT NULL DEFAULT 0,
    principal BOOLEAN NOT NULL DEFAULT FALSE,

    CONSTRAINT fk_imagen_producto
        FOREIGN KEY (id_producto)
        REFERENCES productos(id_producto)
        ON DELETE CASCADE
);

CREATE INDEX idx_imagenes_producto
ON imagenes_producto(id_producto);

-- =========================================================
-- 6. DIRECCIONES
-- =========================================================

CREATE TABLE direcciones (
    id_direccion UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_usuario UUID NOT NULL,
    nombre_destinatario VARCHAR(150) NOT NULL,
    telefono VARCHAR(30),
    direccion TEXT NOT NULL,
    distrito VARCHAR(100),
    provincia VARCHAR(100),
    departamento VARCHAR(100),
    codigo_postal VARCHAR(20),
    referencia TEXT,
    predeterminada BOOLEAN NOT NULL DEFAULT FALSE,

    CONSTRAINT fk_direccion_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES usuarios(id_usuario)
        ON DELETE CASCADE
);

CREATE INDEX idx_direcciones_usuario
ON direcciones(id_usuario);

-- =========================================================
-- 7. CARRITOS
-- =========================================================

CREATE TABLE carritos (
    id_carrito UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_usuario UUID NOT NULL UNIQUE,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_carrito_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES usuarios(id_usuario)
        ON DELETE CASCADE
);

-- =========================================================
-- 8. DETALLE DEL CARRITO
-- =========================================================

CREATE TABLE detalle_carrito (
    id_detalle_carrito UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_carrito UUID NOT NULL,
    id_producto UUID NOT NULL,
    cantidad INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT fk_detalle_carrito
        FOREIGN KEY (id_carrito)
        REFERENCES carritos(id_carrito)
        ON DELETE CASCADE,

    CONSTRAINT fk_detalle_carrito_producto
        FOREIGN KEY (id_producto)
        REFERENCES productos(id_producto)
        ON DELETE CASCADE,

    CONSTRAINT uq_carrito_producto
        UNIQUE (id_carrito, id_producto),

    CONSTRAINT chk_cantidad_carrito
        CHECK (cantidad > 0)
);

-- =========================================================
-- 9. PEDIDOS (CUPONES ELIMINADO)
-- =========================================================

CREATE TABLE pedidos (
    id_pedido UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_usuario UUID,
    id_direccion UUID,

    -- Datos históricos del cliente y envío
    nombre_destinatario VARCHAR(150) NOT NULL,
    telefono VARCHAR(30) NOT NULL,
    correo VARCHAR(150) NOT NULL,

    direccion_envio TEXT NOT NULL,
    distrito_envio VARCHAR(100),
    provincia_envio VARCHAR(100),
    departamento_envio VARCHAR(100),

    subtotal NUMERIC(10,2) NOT NULL,
    descuento NUMERIC(10,2) NOT NULL DEFAULT 0,
    costo_envio NUMERIC(10,2) NOT NULL DEFAULT 0,
    total NUMERIC(10,2) NOT NULL,

    estado VARCHAR(30) NOT NULL DEFAULT 'pendiente',
    observaciones TEXT,

    fecha_pedido TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_pedido_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES usuarios(id_usuario)
        ON DELETE SET NULL,

    CONSTRAINT fk_pedido_direccion
        FOREIGN KEY (id_direccion)
        REFERENCES direcciones(id_direccion)
        ON DELETE SET NULL,

    CONSTRAINT chk_estado_pedido
        CHECK (
            estado IN (
                'pendiente',
                'pagado',
                'preparando',
                'enviado',
                'entregado',
                'cancelado'
            )
        ),

    CONSTRAINT chk_totales_pedido
        CHECK (
            subtotal >= 0
            AND descuento >= 0
            AND costo_envio >= 0
            AND total >= 0
        )
);

CREATE INDEX idx_pedidos_usuario
ON pedidos(id_usuario);

CREATE INDEX idx_pedidos_estado
ON pedidos(estado);

-- =========================================================
-- 10. DETALLE DEL PEDIDO
-- =========================================================

CREATE TABLE detalle_pedido (
    id_detalle_pedido UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_pedido UUID NOT NULL,
    id_producto UUID,
    
    nombre_producto VARCHAR(150) NOT NULL,
    imagen_producto TEXT,
    precio_unitario NUMERIC(10,2) NOT NULL,
    cantidad INTEGER NOT NULL,
    subtotal NUMERIC(10,2) NOT NULL,

    -- Datos de personalización seleccionados
    personalizacion TEXT,

    CONSTRAINT fk_detalle_pedido
        FOREIGN KEY (id_pedido)
        REFERENCES pedidos(id_pedido)
        ON DELETE CASCADE,

    CONSTRAINT fk_detalle_producto
        FOREIGN KEY (id_producto)
        REFERENCES productos(id_producto)
        ON DELETE SET NULL,

    CONSTRAINT chk_cantidad_pedido
        CHECK (cantidad > 0),

    CONSTRAINT chk_precio_unitario
        CHECK (precio_unitario >= 0),

    CONSTRAINT chk_subtotal
        CHECK (subtotal >= 0)
);

CREATE INDEX idx_detalle_pedido_pedido
ON detalle_pedido(id_pedido);

CREATE INDEX idx_detalle_pedido_producto
ON detalle_pedido(id_producto);

-- =========================================================
-- 11. HISTORIAL DE ESTADOS DEL PEDIDO
-- =========================================================

CREATE TABLE historial_estado_pedido (
    id_historial UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_pedido UUID NOT NULL,
    estado VARCHAR(30) NOT NULL,
    comentario TEXT,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_historial_pedido
        FOREIGN KEY (id_pedido)
        REFERENCES pedidos(id_pedido)
        ON DELETE CASCADE
);

CREATE INDEX idx_historial_pedido
ON historial_estado_pedido(id_pedido);

-- =========================================================
-- 12. METODOS DE PAGO
-- =========================================================

CREATE TABLE metodos_pago (
    id_metodo_pago UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE
);

-- =========================================================
-- 13. PAGOS
-- =========================================================

CREATE TABLE pagos (
    id_pago UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_pedido UUID NOT NULL,
    id_metodo_pago UUID NOT NULL,
    monto NUMERIC(10,2) NOT NULL,
    estado VARCHAR(30) NOT NULL DEFAULT 'pendiente',
    referencia_transaccion VARCHAR(150),
    fecha_pago TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_pago_pedido
        FOREIGN KEY (id_pedido)
        REFERENCES pedidos(id_pedido)
        ON DELETE CASCADE,

    CONSTRAINT fk_pago_metodo
        FOREIGN KEY (id_metodo_pago)
        REFERENCES metodos_pago(id_metodo_pago),

    CONSTRAINT chk_monto_pago
        CHECK (monto >= 0)
);

CREATE INDEX idx_pagos_pedido
ON pagos(id_pedido);

-- =========================================================
-- 15. FAVORITOS
-- =========================================================

CREATE TABLE favoritos (
    id_favorito UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_usuario UUID NOT NULL,
    id_producto UUID NOT NULL,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_favorito_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES usuarios(id_usuario)
        ON DELETE CASCADE,

    CONSTRAINT fk_favorito_producto
        FOREIGN KEY (id_producto)
        REFERENCES productos(id_producto)
        ON DELETE CASCADE,

    CONSTRAINT uq_favorito
        UNIQUE (id_usuario, id_producto)
);

-- =========================================================
-- 16. RESEÑAS
-- =========================================================

CREATE TABLE resenas (
    id_resena UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_usuario UUID NOT NULL,
    id_producto UUID NOT NULL,
    calificacion INTEGER NOT NULL,
    comentario TEXT,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_resena_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES usuarios(id_usuario)
        ON DELETE CASCADE,

    CONSTRAINT fk_resena_producto
        FOREIGN KEY (id_producto)
        REFERENCES productos(id_producto)
        ON DELETE CASCADE,

    CONSTRAINT chk_calificacion
        CHECK (calificacion BETWEEN 1 AND 5),

    CONSTRAINT uq_resena_usuario_producto
        UNIQUE (id_usuario, id_producto)
);

COMMIT;
