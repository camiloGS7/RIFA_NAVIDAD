# Sistema de Gestion de Boletos - Gran Rifa Navidena

Aplicacion web Full-Stack para el control, registro de ventas y cuadre de caja en tiempo real de un talonario de 100 boletos (`01` al `99` y `00`). Disenada para operar con baja latencia y alta disponibilidad desde puntos de venta en mostrador (escritorio y dispositivos moviles).

---

## Arquitectura y Stack Tecnologico

- **Entorno de Ejecucion:** Node.js (>= 18.x)
- **Servidor HTTP y API REST:** Express.js
- **Motor de Base de Datos:** PostgreSQL (alojado en Neon DB con conexion SSL y pool de conexiones mediante `pg`)
- **Interfaz de Usuario (Frontend):** HTML5, JavaScript ES6+ y Tailwind CSS
- **Infraestructura de Despliegue:** Railway (Nixpacks)

---

## Estructura del Proyecto

```text
RIFA_NAVIDAD/
├── db/
│   └── init.sql               # Esquema relacional e inicializacion de los 100 registros
├── public/
│   ├── img/
│   │   ├── afiche-rifa.jpg    # Material grafico de referencia
│   │   └── reno-premio.jpg    # Fotografia del premio principal
│   ├── index.html             # Vista principal (cuadricula 10x10, modal de registro y panel contable)
│   └── app.js                 # Controlador de estado y consumo de API REST en el cliente
├── .env.example               # Plantilla de configuracion de variables de entorno
├── .gitignore                 # Exclusiones del control de versiones
├── package.json               # Definicion de dependencias y scripts de ejecucion
├── Procfile                   # Definicion del proceso web para entornos PaaS
├── railway.json               # Configuracion de construccion y despliegue en Railway
├── README.md                  # Documentacion tecnica del sistema
└── server.js                  # Punto de entrada del servidor, rutas API y conexion a PostgreSQL
```

---

## Modelo de Datos (PostgreSQL / Neon DB)

El sistema utiliza la tabla `boletos_rifa` definida en `db/init.sql`:

| Columna            | Tipo de Dato               | Restricciones                | Descripcion                                          |
|--------------------|----------------------------|------------------------------|------------------------------------------------------|
| `id`               | `SERIAL`                   | `PRIMARY KEY`                | Identificador unico autoincremental                  |
| `numero`           | `VARCHAR(2)`               | `UNIQUE NOT NULL`            | Numero del boleto (`01` a `99`, y `00`)              |
| `nombre_comprador` | `VARCHAR(150)`             | `DEFAULT NULL`               | Nombre completo del cliente asignado al boleto       |
| `estado`           | `BOOLEAN`                  | `NOT NULL DEFAULT FALSE`     | Estado del boleto (`FALSE` = disponible, `TRUE` = vendido) |
| `fecha_venta`      | `TIMESTAMP WITH TIME ZONE` | `DEFAULT NULL`               | Marca de tiempo exacta de la transaccion             |

### Inicializacion Manual o Automatica

1. **Automatica:** Al iniciar el servicio (`npm start`), `server.js` ejecuta la rutina `initDatabase()`, la cual verifica la existencia de la tabla, crea los indices correspondientes e inserta los 100 boletos iniciales de manera idempotente (`ON CONFLICT (numero) DO NOTHING`).
2. **Manual:** Si se desea aprovisionar la base de datos previamente desde la consola de Neon DB, ejecute el contenido del archivo `db/init.sql`.

---

## Especificacion de la API REST

### 1. Obtener estado completo del talonario
- **Endpoint:** `GET /api/boletos`
- **Descripcion:** Retorna los 100 boletos ordenados secuencialmente del `01` al `99`, ubicando el `00` en la posicion 100.
- **Respuesta Exitosa (`200 OK`):**
  ```json
  {
    "ok": true,
    "boletos": [
      {
        "id": 1,
        "numero": "01",
        "nombre_comprador": null,
        "estado": false,
        "fecha_venta": null
      }
    ]
  }
  ```

### 2. Registrar venta de un boleto
- **Endpoint:** `POST /api/comprar`
- **Descripcion:** Registra la venta de un numero disponible mediante una operacion atomica en PostgreSQL (`WHERE numero = $2 AND estado = FALSE`), impidiendo condiciones de carrera o ventas duplicadas.
- **Cuerpo de la Peticion (`application/json`):**
  ```json
  {
    "numero": "25",
    "nombre_comprador": "Martha Gomez"
  }
  ```
- **Respuestas:**
  - `200 OK`: Venta registrada exitosamente.
  - `400 Bad Request`: Parametros invalidos o faltantes.
  - `409 Conflict`: El boleto indicado ya se encuentra vendido.

### 3. Anular venta y liberar boleto
- **Endpoint:** `POST /api/liberar`
- **Descripcion:** Restablece un boleto al estado disponible (`estado = FALSE`, `nombre_comprador = NULL`, `fecha_venta = NULL`) en caso de correccion operativa.
- **Cuerpo de la Peticion (`application/json`):**
  ```json
  {
    "numero": "25"
  }
  ```

### 4. Verificacion de estado del servidor
- **Endpoint:** `GET /api/health`
- **Descripcion:** Endpoint de monitoreo para balanceadores de carga y verificacion de salud en Railway.

---

## Ejecucion en Entorno Local

1. Clonar el repositorio:
   ```bash
   git clone https://github.com/camiloGS7/RIFA_NAVIDAD.git
   cd RIFA_NAVIDAD
   ```

2. Instalar dependencias:
   ```bash
   npm install
   ```

3. Configurar las variables de entorno creando un archivo `.env` en la raiz del proyecto a partir de `.env.example`:
   ```env
   DATABASE_URL=postgresql://usuario:password@ep-instancia.us-east-2.aws.neon.tech/neondb?sslmode=require
   PORT=3000
   ```

4. Iniciar el servidor:
   ```bash
   npm start
   ```

5. Abrir en el navegador `http://localhost:3000`.

---

## Despliegue en Produccion (Railway)

1. Crear un nuevo proyecto en Railway vinculado al repositorio de GitHub `camiloGS7/RIFA_NAVIDAD`.
2. En la seccion **Variables** del servicio, registrar la variable de entorno requerida:
   - `DATABASE_URL`: Cadena de conexion proporcionada por Neon DB con `sslmode=require`.
3. Railway utilizara automaticamente la configuracion definida en `railway.json` y `Procfile`:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Port Binding:** El servidor escucha en `0.0.0.0` tomando el puerto asignado dinamicamente en `process.env.PORT`.
4. En la seccion **Settings > Networking**, generar el dominio publico del servicio (`Generate Domain`).
