require('dotenv').config();
const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.DATABASE_URL) {
  console.warn('⚠️  ADVERTENCIA: La variable de entorno DATABASE_URL no está definida.');
}

// Configuración del Pool de PostgreSQL optimizada para Neon DB
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL
    ? { rejectUnauthorized: false }
    : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/**
 * Inicializa automáticamente la tabla `boletos_rifa` y los 100 números ('01' al '99' y '00')
 * si aún no existen en Neon DB.
 */
async function initDatabase() {
  if (!process.env.DATABASE_URL) return;

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS boletos_rifa (
        id SERIAL PRIMARY KEY,
        numero VARCHAR(2) UNIQUE NOT NULL,
        nombre_comprador VARCHAR(150) DEFAULT NULL,
        estado BOOLEAN NOT NULL DEFAULT FALSE,
        fecha_venta TIMESTAMP WITH TIME ZONE DEFAULT NULL
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_boletos_rifa_numero ON boletos_rifa (numero);
      CREATE INDEX IF NOT EXISTS idx_boletos_rifa_estado ON boletos_rifa (estado);
    `);

    await client.query(`
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
    `);

    console.log('✅ Base de datos Neon DB verificada y lista (100 boletos inicializados).');
  } catch (error) {
    console.error('❌ Error al inicializar la base de datos:', error.message);
  } finally {
    client.release();
  }
}

/**
 * GET /api/boletos
 * Obtiene los 100 números ordenados del '01' al '99' y terminando en '00'.
 */
app.get('/api/boletos', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, numero, nombre_comprador, estado, fecha_venta
      FROM boletos_rifa
      ORDER BY CASE WHEN numero = '00' THEN 100 ELSE CAST(numero AS INTEGER) END ASC;
    `);

    res.json({
      ok: true,
      boletos: result.rows,
    });
  } catch (error) {
    console.error('Error en GET /api/boletos:', error);
    res.status(500).json({
      ok: false,
      mensaje: 'Error al obtener los boletos desde la base de datos.',
    });
  }
});

/**
 * POST /api/comprar
 * Registra la venta de un número si está disponible (estado = FALSE).
 * Body: { numero: "01", nombre_comprador: "María Pérez" }
 */
app.post('/api/comprar', async (req, res) => {
  try {
    const { numero, nombre_comprador } = req.body;
    const numeroLimpio = String(numero || '').trim();
    const compradorLimpio = String(nombre_comprador || '').trim();

    if (!/^\d{2}$/.test(numeroLimpio)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El número de boleto debe tener 2 dígitos (01 al 99 o 00).',
      });
    }

    if (!compradorLimpio) {
      return res.status(400).json({
        ok: false,
        mensaje: 'Por favor ingresa el nombre del comprador.',
      });
    }

    // Actualización atómica: solo actualiza si estado = FALSE (evita dobles ventas)
    const result = await pool.query(
      `
      UPDATE boletos_rifa
      SET nombre_comprador = $1,
          estado = TRUE,
          fecha_venta = NOW()
      WHERE numero = $2 AND estado = FALSE
      RETURNING id, numero, nombre_comprador, estado, fecha_venta;
      `,
      [compradorLimpio, numeroLimpio]
    );

    if (result.rowCount === 0) {
      return res.status(409).json({
        ok: false,
        mensaje: `El número ${numeroLimpio} ya fue vendido o no está disponible.`,
      });
    }

    res.json({
      ok: true,
      mensaje: `¡Número ${numeroLimpio} registrado exitosamente a nombre de ${compradorLimpio}!`,
      boleto: result.rows[0],
    });
  } catch (error) {
    console.error('Error en POST /api/comprar:', error);
    res.status(500).json({
      ok: false,
      mensaje: 'No se pudo guardar la venta en la base de datos.',
    });
  }
});

/**
 * POST /api/liberar
 * Permite liberar un número desde el panel de Cuadre de Caja en caso de error de digitación.
 * Body: { numero: "01" }
 */
app.post('/api/liberar', async (req, res) => {
  try {
    const { numero } = req.body;
    const numeroLimpio = String(numero || '').trim();

    if (!/^\d{2}$/.test(numeroLimpio)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'Número inválido.',
      });
    }

    const result = await pool.query(
      `
      UPDATE boletos_rifa
      SET nombre_comprador = NULL,
          estado = FALSE,
          fecha_venta = NULL
      WHERE numero = $1
      RETURNING id, numero, nombre_comprador, estado, fecha_venta;
      `,
      [numeroLimpio]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Boleto no encontrado.',
      });
    }

    res.json({
      ok: true,
      mensaje: `El número ${numeroLimpio} está disponible nuevamente.`,
      boleto: result.rows[0],
    });
  } catch (error) {
    console.error('Error en POST /api/liberar:', error);
    res.status(500).json({
      ok: false,
      mensaje: 'Error al liberar el boleto.',
    });
  }
});

/**
 * GET /api/health
 * Ruta de verificación de estado para Railway
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Fallback para servir el frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🎄 Servidor de Gran Rifa Navideña activo en el puerto ${PORT}`);
  await initDatabase();
});
