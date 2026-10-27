# 🛡️ LifeKeeper - Documento Maestro de Contexto para Nuevas Sesiones

> **Propósito:** Este documento contiene todo el estado, decisiones técnicas, arquitectura, infraestructura y últimas funcionalidades implementadas en **LifeKeeper** para retomar el desarrollo en una nueva conversación sin perder contexto.

---

## 📌 1. Visión y Pilares del Proyecto
- **Concepto:** Plataforma Integral de Organización Personal Offline-First con arquitectura de **Cifrado Zero-Knowledge** (E2EE con AES-256-GCM y PBKDF2). El servidor nunca tiene acceso en texto plano a los datos del usuario.
- **Diseño Dual:** 
  - **Versión Web / Desktop:** Panel completo responsive con sidebar, animaciones fluidas y visualización rica en datos.
  - **Versión Móvil / APK:** Interfaz 100% orientada a smartphones con soporte para gestos táctiles (*swipe gestures*), barra de navegación inferior (*MobileBottomNav*), feedback háptico (@capacitor/haptics) y menú deslizable (*MobileMenuSheet*).

---

## 💻 2. Stack Tecnológico
- **Frontend:** React 19, TypeScript 5.8, Vite 7, Lucide Icons, Recharts, jsPDF.
- **Mobile Wrapper:** Capacitor 8 (`@capacitor/android`, `@capacitor/haptics`, `@capacitor/status-bar`).
- **Criptografía & Seguridad:** Web Crypto API nativa, PBKDF2 (100.000 iteraciones), AES-256-GCM, SHA-256, saneamiento de memoria (`memorySanitizer.ts`), HaveIBeenPwned API (K-Anonymity).
- **Backend Servidor:** Node.js (Express), PostgreSQL 16 Alpine, Ollama (`llama3.2:3b`).
- **Contenedores:** Docker Compose (servicios: `web`, `api`, `postgres`, `ollama`).

---

## 🚀 3. Funcionalidades Recientes Implementadas (Octubre 2026)

### 💳 Finanzas: Deudas, Préstamos y Multimoneda
- **Archivo:** `src/sections/personal/DebtsSection.tsx` integrado en `src/sections/personal/Finances.tsx`.
- **Entidades vs. Personas Físicas:** Diferenciación entre deudas con bancos/tarjetas/financieras y préstamos personales con amigos/familiares.
- **Flujos:** "Por pagar" (pasivo) y "Por cobrar" (activo).
- **Métricas:** Total adeudado, total a favor, total amortizado y barra de progreso con **% global liquidado**.
- **Abonos Parciales:** Modal de registro de cuotas/pagos parciales con actualización automática del estado (`pendiente`, `parcial`, `cancelada`).
- **Multimoneda:** Selector de divisa en movimientos y deudas (`ARS`, `USD`, `EUR`, `USDT`, `BRL`, `CLP`).
- **Balance del Mes Discreto:** Oculto por defecto (`••••••`) con icono de ojo `Eye`/`EyeOff` y formato limpio sin decimales (`formatCurrencyNoCents`).

### 🏋️‍♂️ Entrenamientos & Fitness Avanzado
- **Archivo:** `src/sections/personal/Workouts.tsx`.
- **Actividades con Distancia:** Caminata, trekking, running, ciclismo y natación con cálculo automático de ritmo (*pace* en min/km o km/h) y gasto calórico.
- **Estructura en Solapas:** Pestaña inicial `⚡ Nuevo Entrenamiento` y solapa `📋 Mis Entrenamientos` para consultar el historial con buscador y filtros por período y disciplina.
- **Predicción Inteligente de Rutina:** Banner superior predictivo según historial y día de la semana con botón de precarga en 1 clic.
- **Plantillas / Repetir Rutina:** Botón "📋 Usar como plantilla" en cada entreno anterior para cargar ejercicios y pesos automáticamente.
- **Series Especiales:** Biseries, Drop Sets, Series al Fallo, Calentamiento y notas/comentarios por cada serie individual.
- **Exportación en PDF Profesional:** Generador en `src/utils/workoutPdfExport.ts` con formato A4, métricas consolidadas (volumen en kg, distancia, tiempo) y desglose completo para enviar a un Personal Trainer.

### 🥗 Nutrición y Salud Femenina
- **Nutrición (`NutritionSection.tsx`):** Registro de comidas diarias, desglose de macronutrientes (proteínas, carbohidratos, grasas), consumo de agua e historial calórico.
- **Ciclo Menstrual (`MenstrualCycleSection.tsx`):** Activado cuando el perfil tiene género Femenino. Predicción de ovulación, fase lútea/folicular, registro de síntomas y vinculación directa con el Calendario de la app.

### 🧘 Diario & Acompañamiento Emocional
- **Archivos:** `src/sections/diary/MoodTracker.tsx` y `src/utils/insights.ts`.
- **Umbrales ampliados:** Se eliminó la alerta invasiva en el día 1 de ánimo bajo. El tip preventivo requiere 4 días continuos bajos y la alerta con líneas de ayuda requiere 6 o más días sostenidos.

### 🤖 Asistente Virtual Local Porteño & Multimodal
- **Archivos:** `src/services/assistant/localAssistant.ts`, `src/services/assistant/ollamaClient.ts` y `src/components/AssistantModal.tsx`.
- **Personalidad & Tono:** Español rioplatense porteño / tanguero ("che", "mirá", "una pinturita", "al toque", "de diez", "mangos/lucas", etc.).
- **Voz Bidireccional (STT & TTS):**
  - Entrada por voz con dictado nativo en español (`es-AR`) mediante Web Speech API (`SpeechRecognition`) con botón de micrófono animado.
  - Salida audible con síntesis de voz (`SpeechSynthesis`) en cada respuesta del asistente.
- **Deudas y Préstamos:**
  - Carga natural de préstamos a terceros (*"Le presté 20 lucas a Juan"*), deudas propias (*"Le debo $50.000 a Visa"*) y liquidaciones/abonos (*"Juan me devolvió 10 lucas"*).
  - Consultas inteligentes: *"¿Quién me debe plata?"*, *"¿A quién le debo?"*.
- **Daily Briefing (Resumen Matutino y Nocturno):**
  - Vista completa consolidada con clima, tomas de medicación pendientes, rutina recomendada, balances hídrico/calórico y recordatorios.
- **Entrenador & Nutricionista AI con Guardado en 1 Clic:**
  - Armado de rutinas de hipertrofia con Action Card interactiva para **guardar como plantilla en Workouts**.
  - Armado de planes de alimentación con Action Card para **aplicar metas calóricas y macros en Nutrición**.
- **Action Cards con Deshacer (`Undo2`):** Visualización enriquecida de cada mutación guardada con reversión instantánea.
- **Historial Persistente Cifrado:** Sesiones de chat guardadas y cifradas Zero-Knowledge en la bóveda, con soporte de múltiples conversaciones y botón **+ Nuevo Chat**.

---

## 🖥️ 4. Infraestructura del Servidor Local (Dell Latitude)
- **Host / IP:** `192.168.0.52` (Ubuntu Server en red local).
- **Usuario SSH:** `dragunovich`
  ```powershell
  ssh dragunovich@192.168.0.52
  ```
- **Repositorio en el Server:** `~/lifekeeper`
- **Contenedores Docker (`docker-compose.yml`):**
  - `web` (nombre de servicio: `web`, contenedor: `lifekeeper-web`): Nginx sirviendo la build estática en el puerto `80:80`.
  - `api` (contenedor: `lifekeeper-api`): Backend Node en `127.0.0.1:4000`.
  - `postgres` (contenedor: `lifekeeper-postgres`): Base de datos en `127.0.0.1:5432`.
  - `ollama` (contenedor: `lifekeeper-ollama`): Modelo de IA en `127.0.0.1:11434`.

### 🔄 Comando para actualizar la Web en el Server:
```bash
cd ~/lifekeeper
git pull origin main
docker compose build --no-cache web
docker compose up -d web
```

---

## 📱 5. Binarios Android (APK / AAB)
- Ubicación de los archivos compilados en la raíz del proyecto:
  - **`LifeKeeper-debug.apk`** (~35.6 MB): Instalable directamente en el smartphone.
  - **`LifeKeeper-release.aab`** (~33.6 MB): Bundle firmado para distribución en Google Play.
- **Pipeline de compilación Android:**
  ```powershell
  npm run build
  npx cap sync android
  cmd /c "cd /d e:\02. Desarrollo\03. Web Stack\lifekeeper\android && gradlew.bat assembleDebug bundleRelease"
  Copy-Item android\app\build\outputs\apk\debug\app-debug.apk .\LifeKeeper-debug.apk -Force
  Copy-Item android\app\build\outputs\bundle\release\app-release.aab .\LifeKeeper-release.aab -Force
  ```
- **Instalación rápida por cable USB (ADB):**
  ```powershell
  & "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" install -r .\LifeKeeper-debug.apk
  ```

---

## 📂 6. Control de Versiones (Git)
- **Repositorio:** `https://github.com/Dragunovich1/lifekeeper.git`
- **Ramas Principales:**
  - `main`: Sincronizada con el último commit de producción (`ea8b950`).
  - `feat/ui-ux-dashboard-responsive-branding`: Rama de trabajo activa sincronizada con `main`.
