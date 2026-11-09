-- ============================================================================
-- Script de Inicialización para Neon DB (PostgreSQL)
-- Proyecto: Gran Rifa Navideña
-- ============================================================================

CREATE TABLE IF NOT EXISTS boletos_rifa (
    id SERIAL PRIMARY KEY,
    numero VARCHAR(2) UNIQUE NOT NULL,
    nombre_comprador VARCHAR(150) DEFAULT NULL,
    estado BOOLEAN NOT NULL DEFAULT FALSE, -- FALSE = Disponible, TRUE = Vendido
    fecha_venta TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

-- Índice para búsquedas rápidas por número y estado
CREATE INDEX IF NOT EXISTS idx_boletos_rifa_numero ON boletos_rifa (numero);
CREATE INDEX IF NOT EXISTS idx_boletos_rifa_estado ON boletos_rifa (estado);

-- Poblar automáticamente los 100 números: del '01' al '99' y finalmente el '00'
INSERT INTO boletos_rifa (numero, nombre_comprador, estado, fecha_venta)
SELECT
    CASE
        WHEN n = 100 THEN '00'
        ELSE LPAD(n::TEXT, 2, '0')
    END AS numero,
    NULL AS nombre_comprador,
    FALSE AS estado,
    NULL AS fecha_venta
FROM generate_series(1, 100) AS n
ON CONFLICT (numero) DO NOTHING;
