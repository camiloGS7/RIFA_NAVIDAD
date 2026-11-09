# 🎄 Gran Rifa Navideña - Sistema de Ventas para Mostrador

Aplicación web Full-Stack ultrarrápida y responsiva diseñada para gestionar en tiempo real la venta de boletos (`01` al `99` y `00`) de la **Gran Rifa Navideña** directamente desde el mostrador de la farmacia (computador o celular).

---

## 📁 Estructura del Proyecto

```text
RIFA_NAVIDAD/
├── db/
│   └── init.sql            # Script SQL para crear e inicializar la tabla boletos_rifa en Neon DB
├── public/
│   ├── img/
│   │   ├── afiche-rifa.jpg # Cartel original de referencia
│   │   └── reno-premio.jpg # Foto del premio (Muñeco Reno Navideño 82cm x 40cm)
│   ├── index.html          # Interfaz navideña con Tailwind CSS (Grilla 10x10 + Modal + Cuadre de Caja)
│   └── app.js              # Lógica interactiva del Frontend
├── .env.example            # Ejemplo de variables de entorno
├── .gitignore              # Archivos excluidos de Git
├── package.json            # Dependencias (express, pg, dotenv) y script de arranque
├── Procfile                # Comando de inicio para Railway (web: npm start)
├── railway.json            # Configuración de despliegue automático en Railway
├── README.md               # Guía de configuración y despliegue
└── server.js               # Backend Node.js + Express conectado a PostgreSQL (Neon DB)
```

---

## 🗄️ 1. Configuración de la Base de Datos en Neon DB

1. Ingresa a [Neon.tech](https://neon.tech/) y crea un proyecto (o usa el existente).
2. Copia tu **Connection String** (cadena de conexión PostgreSQL), que luce así:
   ```text
   postgresql://neondb_owner:tu_password@ep-ejemplo-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
3. *(Opcional)* Ve al **SQL Editor** en Neon DB y ejecuta el contenido de [`db/init.sql`](./db/init.sql).
   > **Nota:** El servidor (`server.js`) también verifica e inicializa automáticamente la tabla `boletos_rifa` y los 100 números (`01` al `99` y `00`) al arrancar por primera vez.

---

## 🚂 2. Despliegue Paso a Paso en Railway

1. **Sube este proyecto a tu repositorio de GitHub (`https://github.com/camiloGS7/RIFA_NAVIDAD`):**
   ```bash
   git init
   git add .
   git commit -m "feat: aplicacion completa Gran Rifa Navidena con Neon DB y Railway"
   git branch -M main
   git remote add origin https://github.com/camiloGS7/RIFA_NAVIDAD.git
   git push -u origin main
   ```

2. **Crea el servicio en Railway:**
   - Entra a [Railway.app](https://railway.app/) e inicia sesión con GitHub.
   - Haz clic en **New Project** -> **Deploy from GitHub repo**.
   - Selecciona el repositorio **`camiloGS7/RIFA_NAVIDAD`**.

3. **Configura las Variables de Entorno (`Variables`):**
   - Dentro de tu servicio en Railway, abre la pestaña **Variables**.
   - Agrega la variable:
     - **Nombre:** `DATABASE_URL`
     - **Valor:** `postgresql://usuario:password@ep-...neon.tech/neondb?sslmode=require` *(tu URL de Neon DB)*
   - *(No necesitas definir `PORT` manualmente; Railway lo inyecta automáticamente y `server.js` usa `process.env.PORT || 3000` escuchando en `0.0.0.0`).*

4. **Comandos de Construcción e Inicio (Automáticos):**
   - **Build Command:** `npm install` (detectado automáticamente por Nixpacks).
   - **Start Command:** `npm start` (configurado en `Procfile`, `railway.json` y `package.json`).

5. **Generar Dominio Público:**
   - Ve a la pestaña **Settings** -> sección **Networking** -> haz clic en **Generate Domain**.
   - ¡Listo! Abre ese enlace en el computador de la farmacia o en el celular de tu mamá.
