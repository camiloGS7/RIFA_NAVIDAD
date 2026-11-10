'use strict';

const { Pool } = require('pg');

const TOTAL_BOLETOS = 100;

/**
 * Construye la configuracion del pool para PostgreSQL (Neon DB).
 * Se eliminan los parametros `sslmode` y `channel_binding` de la cadena,
 * ya que el driver `pg` los interpreta de forma distinta a libpq, y se
 * habilita TLS explicitamente.
 */
function construirConfiguracion(urlOriginal) {
  let connectionString = urlOriginal;
  try {
    const url = new URL(urlOriginal);
    url.searchParams.delete('sslmode');
    url.searchParams.delete('channel_binding');
    connectionString = url.toString();
  } catch (error) {
    // Cadena no parseable como URL: se usa tal cual.
  }

  const esLocal = /@(localhost|127\.0\.0\.1)(:|\/)/.test(urlOriginal);

  return {
    connectionString,
    ssl: esLocal ? false : { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };
}

const pool = process.env.DATABASE_URL
  ? new Pool(construirConfiguracion(process.env.DATABASE_URL))
  : null;

if (pool) {
  pool.on('error', (error) => {
    console.error('[ERROR] Conexion inactiva del pool:', error.message);
  });
}

function obtenerPool() {
  if (!pool) {
    const error = new Error('La base de datos no esta configurada (falta DATABASE_URL).');
    error.status = 503;
    throw error;
  }
  return pool;
}

/**
 * Crea la tabla si no existe, aplica migraciones idempotentes y garantiza
 * que existan los 100 boletos (01 a 99 y 00). No modifica ventas existentes.
 */
async function inicializar() {
  const cliente = await obtenerPool().connect();
  try {
    await cliente.query('BEGIN');

    await cliente.query(`
      CREATE TABLE IF NOT EXISTS boletos_rifa (
        id               SERIAL PRIMARY KEY,
        numero           VARCHAR(2)  UNIQUE NOT NULL,
        nombre_comprador VARCHAR(150) DEFAULT NULL,
        telefono         VARCHAR(20)  DEFAULT NULL,
        estado           BOOLEAN      NOT NULL DEFAULT FALSE,
        fecha_venta      TIMESTAMPTZ  DEFAULT NULL
      );
    `);

    // Migracion: instalaciones anteriores no tenian la columna telefono.
    await cliente.query(`
      ALTER TABLE boletos_rifa ADD COLUMN IF NOT EXISTS telefono VARCHAR(20) DEFAULT NULL;
    `);

    await cliente.query(`
      INSERT INTO boletos_rifa (numero)
      SELECT LPAD((n % 100)::TEXT, 2, '0')
      FROM generate_series(1, ${TOTAL_BOLETOS}) AS n
      ON CONFLICT (numero) DO NOTHING;
    `);

    await cliente.query('COMMIT');
  } catch (error) {
    await cliente.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    cliente.release();
  }
}

/** Convierte una fila de la base de datos al formato publico de la API. */
function aBoleto(fila) {
  return {
    numero: fila.numero,
    vendido: fila.estado === true,
    nombre: fila.nombre_comprador,
    telefono: fila.telefono,
    fechaVenta: fila.fecha_venta,
  };
}

const COLUMNAS = 'numero, nombre_comprador, telefono, estado, fecha_venta';
const ORDEN = "CASE WHEN numero = '00' THEN 100 ELSE numero::INTEGER END";

async function listarBoletos() {
  const resultado = await obtenerPool().query(
    `SELECT ${COLUMNAS} FROM boletos_rifa ORDER BY ${ORDEN};`
  );
  return resultado.rows.map(aBoleto);
}

async function existeBoleto(numero) {
  const resultado = await obtenerPool().query(
    'SELECT 1 FROM boletos_rifa WHERE numero = $1;',
    [numero]
  );
  return resultado.rowCount > 0;
}

/**
 * Registra la venta de forma atomica: solo actualiza si el boleto sigue
 * disponible, lo que evita ventas duplicadas entre varios vendedores.
 * Devuelve el boleto actualizado o null si ya estaba vendido.
 */
async function venderBoleto(numero, nombre, telefono) {
  const resultado = await obtenerPool().query(
    `UPDATE boletos_rifa
        SET nombre_comprador = $1, telefono = $2, estado = TRUE, fecha_venta = NOW()
      WHERE numero = $3 AND estado = FALSE
      RETURNING ${COLUMNAS};`,
    [nombre, telefono, numero]
  );
  return resultado.rowCount ? aBoleto(resultado.rows[0]) : null;
}

/** Corrige nombre y telefono de un boleto ya vendido. */
async function actualizarComprador(numero, nombre, telefono) {
  const resultado = await obtenerPool().query(
    `UPDATE boletos_rifa
        SET nombre_comprador = $1, telefono = $2
      WHERE numero = $3 AND estado = TRUE
      RETURNING ${COLUMNAS};`,
    [nombre, telefono, numero]
  );
  return resultado.rowCount ? aBoleto(resultado.rows[0]) : null;
}

/** Anula una venta y deja el boleto disponible nuevamente. */
async function anularVenta(numero) {
  const resultado = await obtenerPool().query(
    `UPDATE boletos_rifa
        SET nombre_comprador = NULL, telefono = NULL, estado = FALSE, fecha_venta = NULL
      WHERE numero = $1 AND estado = TRUE
      RETURNING ${COLUMNAS};`,
    [numero]
  );
  return resultado.rowCount ? aBoleto(resultado.rows[0]) : null;
}

async function verificarConexion() {
  if (!pool) return false;
  try {
    await pool.query('SELECT 1;');
    return true;
  } catch (error) {
    return false;
  }
}

async function cerrar() {
  if (pool) await pool.end();
}

module.exports = {
  TOTAL_BOLETOS,
  inicializar,
  listarBoletos,
  existeBoleto,
  venderBoleto,
  actualizarComprador,
  anularVenta,
  verificarConexion,
  cerrar,
};
