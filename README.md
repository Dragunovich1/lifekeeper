# LifeKeeper

Bóveda digital personal **zero-knowledge**: tus datos se cifran en el dispositivo (AES-256-GCM, PBKDF2) y el servidor solo guarda un snapshot cifrado. Funciona offline-first en web y como APK (Capacitor).

## Funcionalidades

- **Salud**: vacunas, consultas, medicación (con info de MedlinePlus), hidratación, **nutrición**, **mediciones** (glucosa, presión, pulso… con momento y cómo te sentías, estado orientativo y PDF para el médico), historial clínico, ciclo menstrual, tarjeta de emergencia.
- **Diario**: notas, estado de ánimo, búsqueda y exportación.
- **Seguridad**: contraseñas, documentos sensibles, notas privadas.
- **Vida personal**: **finanzas** (calendario, categorías, topes, importación CSV/Excel/PDF, inflación), proyectos, vehículos, entrenamientos (catálogo wger), deudas y ahorros.
- **Utilidades**: recordatorios, calendario con feriados, **lista de compras**, **notas rápidas** (fijables al Dashboard), **calculadora**, respaldos y exportación (JSON, Excel, CSV, PDF).
- **Asistente**: LLM local (Ollama) que entiende lenguaje natural y carga datos de toda la suite; voces Piper (es-AR). Modelo elegible en Configuración.
- **Avisos**: recordatorios y medicación con notificaciones nativas (APK) o del navegador.

## Stack

React 19 · TypeScript · Vite 7 · Capacitor 8 · Express + Postgres · Ollama · Docker Compose.

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:5173
npm run build
npm test           # vitest (utilidades)
npm run test:server
```

CI (GitHub Actions): tipos + tests + build del front y tests del servidor.

## Actualizar con un solo comando

**Web (en el servidor Ubuntu, por SSH):**

```bash
cd ~/lifekeeper && ./scripts/update-web.sh        # --no-cache | --no-backup | --dry-run
```

Hace copia de la base de datos, trae el código, asegura el `.env` y el `JWT_SECRET`, reconstruye `api`, `web` y `tts`, reinicia y verifica.

**APK (en Windows, desde la carpeta del proyecto):**

```powershell
.\build-apk.bat                  # doble clic o desde la consola
.\scripts\build-apk.ps1 -Install # además lo instala por USB en el celular
```

Hace `git pull`, `npm install`, build, `cap sync` y `gradlew assembleDebug`; deja el APK en `apk\`.

## Servidor (Docker Compose)

```bash
cp .env.example .env
node scripts/gen-secrets.mjs            # genera JWT_SECRET aleatorio en .env
docker compose build --no-cache api web
docker compose up -d api web
node scripts/verify-public-apis.mjs     # comprueba las APIs públicas (feriados, IPC, wger, MedlinePlus)
```

Notas de seguridad: el JWT se rota con `gen-secrets` (cierra sesiones en la nube, no pierde datos); CORS y límites de intentos se configuran por variables de entorno (ver `.env.example`).

## APK

```bash
npm run build && npx cap sync android
```

Recompilar el APK tras actualizar: incluye el plugin de notificaciones locales y sus permisos.

Más contexto técnico en `PROJECT_CONTEXT.md`.
