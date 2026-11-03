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

### 🚗 Garaje y Vehículos Integral
- **Archivo:** `src/sections/personal/Vehicles.tsx`.
- **Ficha del Vehículo:** Marca, modelo, año, patente, tipo de vehículo y odómetro actual.
- **Semáforo de Vencimientos Legales:** Alertas dinámicas con código de colores (verde/amarillo/rojo) para Seguro, VTV/RTO y Licencia de conducir según los días restantes.
- **Tarjeta SOS de Auxilio 24hs:** Botón directo para llamar a la grúa/asistencia del seguro (`tel:...`) con póliza a la vista.
- **Calculadora de Combustible & Rendimiento:** Registro de cargas, cálculo de Km/L, costo por kilómetro y sincronización opcional con Finanzas (Egresos en Transporte).
- **Historial de Mantenimiento:** Registro de services, cambio de aceite, distribución, filtros y recordatorio del próximo service por fecha u odómetro.

### 🏋️‍♂️ Entrenamientos: Modo Planificación vs. Modo Gym en Vivo
- **Rediseño (actual):** `src/sections/personal/workouts/` con 4 solapas — **Hoy** (`TodayTab`: el día que toca de la rutina activa, retomar la sesión en curso, stats y récords), **Rutinas** (`RoutinesTab` + `RoutineEditorModal`: programas con días; también muestra las plantillas del asistente), **Historial** (`HistoryTab` + `SessionEditorModal`) y **Ejercicios** (`ExercisesTab`: récords y gráfico de evolución por ejercicio). Todo lo que se "agrega" va en un **modal** (`AddItemModal`, `SessionEditorModal`, `RoutineEditorModal`, `ExportModal`), no en formularios largos en la página. Estilos: `src/styles/workouts.css`.
- **Modelo de series** (`src/utils/workoutSets.ts`, pura y testeada): calentamiento (`warmup`) y al fallo (`failure`) son banderas independientes; el drop set es una lista `drops: [{reps, weight}]` (las caídas suman al volumen); `measure: 'reps' | 'time'` (plancha, cinta) con `seconds`; `perSide` para "por pierna". Los datos viejos (`setType: 'warmup' | 'failure' | 'dropset'`) se siguen entendiendo (`isWarmup`, `isFailure`, `dropsOf`) y se migran al editar (`normalizeSet`). El volumen **excluye calentamientos**. Récords: mayor peso y 1RM estimada (Epley) por ejercicio (`exerciseRecords`, `newRecords`).
- **Rutinas** (`workoutRoutines.ts`): `WorkoutRoutine { days[] }` en `personal.workoutRoutines`, rutina activa en `personal.activeRoutineId`; `nextRoutineDay` calcula el día que sigue a partir de las sesiones con `routineId/routineDayId`; `prepareDayForLive` precarga las últimas cargas. Los pesos de rutinas y sesiones se guardan **siempre en kg**; los editores trabajan en la unidad de la persona y convierten al guardar (`convertExerciseWeights`).
- **Sesión en vivo** (`LiveSession.tsx`): el borrador (`personal.liveWorkout`, cifrado como todo AppData) se guarda con un retraso de 700 ms y al salir, así que sobrevive a cerrar la app; el cronómetro usa `accumulatedSeconds + runningSince`. "Completar ronda" marca todo el ítem y arranca el descanso del ítem.
- **Exportar por período** (`workoutExport.ts` + `ExportModal` + `workoutPdfExport.ts`): períodos (7/30 días, este mes, mes pasado, 3/6 meses, año, este año, todo, fechas a elegir), filtro por disciplina, y formatos PDF (resumen, detalle, progreso), Excel (hojas Resumen/Sesiones/Series/Ejercicios), CSV (`;` + BOM, una fila por serie y por caída) y JSON. En libras se convierte solo al exportar.
- **Archivos auxiliares:** `src/utils/audioHaptics.ts` (sonido y vibración del descanso).
- **Doble Modalidad:**
  - **Modo Planificación:** Armado tranquilo de rutinas previas sin apuro, configuración de ejercicios y series estimadas.
  - **Modo Gym en Vivo:** Consola optimizada para cuando estás en el gimnasio con botones táctiles grandes (+/- reps, +/- peso) y cronómetro de sesión activo.
- **Rest Timer Automático:** Se dispara al marcar una serie hecha (`[✓ Hecha]`) o manualmente con presets de 30s, 45s, 60s, 90s, 120s, 180s.
- **Feedback Sensorial al Terminar el Descanso:**
  - Pitido acústico doble sintetizado con **Web Audio API** (100% offline sin archivos de audio externos).
  - Vibración háptica dual mediante **@capacitor/haptics** y fallback web.
- **Ítems combinados (biserie / triserie / circuito):** un ítem puede tener varios ejercicios (2 = biserie, 3 = triserie, 4–6 = circuito). Modelo: `WorkoutExercise.groupId/groupKind/restSeconds`; los ejercicios del grupo son consecutivos, cada uno conserva sus series y la "ronda" n es la serie n de todos. Lógica pura y testeada en `src/utils/workoutGroups.ts` (`buildBlocks`, `createGroup`, `addRound`, `cloneExercises`…); UI en `ExerciseItemAdder.tsx` (Ejercicio | Biserie | Triserie | Circuito; usa `ExerciseAdder` en modo controlado `value/onValueChange`) y `WorkoutGroupCards.tsx` (tarjeta de armado/edición y tarjeta en vivo con "Completar ronda", que dispara el descanso propio del ítem). Se ve agrupado en historial y PDF, y las plantillas (`cloneExercises`) conservan los grupos. Regla: los datos viejos (sin `groupId`) siguen siendo ejercicios sueltos; el `setType: 'biserie'` por serie sigue existiendo para compatibilidad.
- **Botón 🏁 Finalizar Sesión:** Modal de resumen con minutos reales entrenados, series completadas y volumen total levantado en kg/lb.

### 📌 Proyectos e Ideas: Vista Dual Kanban / Lista
- **Archivo:** `src/sections/personal/Projects.tsx`.
- **Tablero Kanban Interactivo:** 3 columnas (*Por Hacer*, *En Progreso*, *Completadas*) con contadores, tarjetas con prioridad (*Alta*, *Media*, *Baja*) y botones de avance rápido.
- **Lista Clásica:** Vista tradicional con checkboxes ordenados por completitud y prioridad.
- **Barra de Progreso y Métricas:** Porcentaje global completado por proyecto en tiempo real.

### 🐷 Finanzas: Metas de Ahorro / "Chanchito Digital"
- **Archivo:** `src/sections/personal/SavingsSection.tsx` integrado en `Finances.tsx`.
- **Objetivos de Ahorro:** Creación de metas con monto objetivo, fecha límite estimada, categoría y moneda (ARS, USD, EUR, USDT).
- **Aportes Progresivos:** Modal para ingresar aportes parciales con fecha y notas.
- **Sincronización Inteligente de Finanzas:** Opción para registrar el aporte como un egreso real en la categoría *Ahorro e Inversión* para mantener el balance exacto.
- **Métricas:** Total ahorrado global, total objetivo, barra de progreso con gradiente y alerta de meta cumplida.

### 🪪 Salud: Carnet SOS de Bolsillo y Código QR Médico
- **Archivo:** `src/sections/health/Emergency.tsx` y librería `qrcode`.
- **Carnet SOS Imprimible:** Ficha médica en formato de tarjeta de bolsillo con datos vitales (Grupo Sanguíneo, Alergias en rojo, Medicaciones habituales y Contactos de auxilio) lista para imprimir con `window.print()`.
- **Código QR Médico Offline:** Generación instantánea en pantalla y en el carnet para que cualquier rescatista, médico o persona de auxilio pueda escanearlo con la cámara de su teléfono sin requerir clave maestra.

### 📅 Calendario: Exportación Universal iCalendar (.ics)
- **Archivo:** `src/sections/utilities/Calendar.tsx` y `src/utils/calendarExport.ts`.
- **Compatibilidad Universal:** Exportación en formato estándar RFC 5545 compatible con **Google Calendar**, **Apple Calendar** y **Microsoft Outlook**.

### 🔒 Seguridad: Auditoría de Contraseñas Reutilizadas
- **Archivo:** `src/sections/security/PasswordManager.tsx`.
- **Detección de Clústeres:** Agrupación automática de credenciales que comparten exactamente la misma contraseña.
- **Rotación Rápida:** Botón directo para sustituir contraseñas repetidas por claves criptográficas únicas generadas al azar.

- **Archivo:** `src/sections/personal/Workouts.tsx`.
- **Actividades con Distancia:** Caminata, trekking, running, ciclismo y natación con cálculo automático de ritmo (*pace* en min/km o km/h) y gasto calórico.
- **Estructura en Solapas:** Pestaña inicial `⚡ Nuevo Entrenamiento` y solapa `📋 Mis Entrenamientos` para consultar el historial con buscador y filtros por período y disciplina.
- **Predicción Inteligente de Rutina:** Banner superior predictivo según historial y día de la semana con botón de precarga en 1 clic.
- **Plantillas / Repetir Rutina:** Botón "📋 Usar como plantilla" en cada entreno anterior para cargar ejercicios y pesos automáticamente.
- **Series Especiales:** Biseries, Drop Sets, Series al Fallo, Calentamiento y notas/comentarios por cada serie individual.
- **Exportación en PDF Profesional:** Generador en `src/utils/workoutPdfExport.ts` con formato A4, métricas consolidadas (volumen en kg, distancia, tiempo) y desglose completo para enviar a un Personal Trainer.

### 🐾 Mascotas (Vida personal → Mascotas)
- **Archivos:** `src/sections/personal/pets/` (`PetsSection` lista de tarjetas + `PetDetail` ficha con solapas Resumen · Salud · Peso · Medicación · Turnos · Gastos, `PetFormModal` alta/edición con foto, `RecordModals` un modal por tipo de registro), lógica pura y testeada en `src/utils/pets.ts`, PDF de la ficha en `src/utils/petPdfExport.ts`, estilos `src/styles/pets.css`. Datos en `personal.pets: Pet[]` (todo cifrado en el snapshot).
- **Foto:** se elige de galería/cámara y se reduce a JPEG ≤640 px (`utils/image.ts: fileToResizedDataUrl`) para no inflar la bóveda.
- **Avisos:** `petAlerts` mira, de cada vacuna/control (por nombre), solo el registro más reciente; si tiene `nextDate` vencida o a ≤30 días avisa. También turnos próximos y vigencia del seguro. Se muestran en la ficha, en la tarjeta y en las alertas del Dashboard (`insights.ts`). Una mascota con `deceasedDate` queda como recuerdo y no avisa.
- **Patrón de modales:** todo "agregar/editar" va en un modal con `components/FormModal.tsx` (formulario + Cancelar/Guardar; `Modal` pide confirmación si se sale con datos cargados). Es el patrón a usar en toda la web; los listados quedan limpios. Ya convertidos (botón "+ Nuevo…" en el listado → modal): Vacunas, Consultas, Medicación, Historial clínico, Diario, Proyectos, Contraseñas, Notas privadas, Documentos, Recordatorios, Mediciones, Finanzas, Vehículos, Deudas, Ahorros, Nutrición, Entrenamientos y Mascotas. Si una sección usa el "+" rápido (`useQuickAction`), el handler debe abrir el modal. Se dejan inline a propósito las cargas de un toque (hidratación, lista de compras, notas rápidas).

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

### 🌐 Datos públicos de uso libre (feriados, inflación, ejercicios, MedlinePlus)
- **Backend:** `server/src/publicData.js` (router montado en `/api/public`, sin dependencias nuevas). Solo lectura, **no recibe datos de la bóveda**. Pasa por el servidor para ocultar la IP del usuario, evitar CORS (APK) y cachear: si la fuente cae, sirve la última copia buena (`stale: true`). Endpoints: `/holidays?year=`, `/inflation?months=`, `/exercises?q=` (+ `/exercises/status`), `/medlineplus/topics?q=`, `/medlineplus/drug?name=|rxcui=`, `/status`.
- **Fuentes:** feriados → ArgentinaDatos; inflación → API de Series de Tiempo de datos.gob.ar (IPC INDEC, id `148.3_INIVELNAL_DICI_M_26`, configurable con `PUBLIC_IPC_SERIES_ID`) con ArgentinaDatos de respaldo; ejercicios → wger (el catálogo completo se baja en segundo plano y se guarda en disco, se busca localmente); salud → MedlinePlus Web Service (temas) y MedlinePlus Connect vía RxNav (medicamentos; hay un diccionario de nombres AR→EE.UU., p. ej. paracetamol→acetaminophen).
- **Cliente:** `src/services/api/publicData.ts` (todo con `apiFetch`, caché en localStorage y respaldo sin conexión), hooks en `src/hooks/usePublicData.ts`. Feriados fijos de respaldo en `src/utils/holidaysFallback.ts`; catálogo base de ejercicios y traducción de músculos/equipo en `src/utils/exerciseCatalog.ts`.
- **Dónde se ve:** Utilidades > Calendario (feriados + filtro "Feriados"), Finanzas > Calendario (feriados marcados + tarjeta de **Inflación** con comparación contra tus gastos en ARS: `InflationCard.tsx`), Entrenamientos (`ExerciseAdder.tsx`: sugerencias del catálogo base + wger, guarda músculos y equipo), Medicación (botón **Info**) e Historial clínico (**Más info**) con `HealthInfoModal.tsx`, y el asistente (próximos feriados e inflación en su contexto).
- **Privacidad:** MedlinePlus recibe el término que la persona busca (medicamento o tema). Por eso solo se consulta al tocar "Buscar" y la primera vez se muestra un aviso (consentimiento guardado en el dispositivo). Es información general, no reemplaza al médico.
- **Verificar en el servidor real:** `node scripts/verify-public-apis.mjs [http://localhost]` prueba cada API externa y los endpoints propios. **Los formatos se implementaron según la documentación pública y se probaron con respuestas simuladas**, no contra las APIs reales.
- **Al actualizar:** hay cambios en el backend, hay que reconstruir también `api` (`docker compose build --no-cache api web`).

### 🔄 Sincronización y conexión al servidor (APK / Web / LAN)
- **`src/services/api/apiConfig.ts` → `apiFetch(path)`:** prueba el mismo origen y, si falla, los servidores conocidos (`app.lifekeeper.lat`, `192.168.0.52`) o el configurado por el usuario ("Configurar servidor"). **Toda llamada a `/api/...` debe usar `apiFetch`**, no `fetch` (en la APK un `/api` relativo apunta al propio teléfono). Ya lo usan Ollama, el extractor de acciones del asistente, Piper TTS y el mail.
- **`src/services/sync/syncService.ts`:** sincronización bidireccional cifrada (zero-knowledge) de la bóveda completa. `countVaultRecords` evita pisar una bóveda con datos por una vacía: al sumar colecciones nuevas hay que agregarlas ahí.

### 📅 Finanzas: Calendario, categorías e importación de archivos
- **Calendario (pestaña por defecto):** `src/sections/personal/finance/FinanceCalendar.tsx`. Arriba **Ingresos | Saldo | Gastos** (montos ocultos hasta tocar el ojo), desglose por categoría con barras y %, y calendario mensual (semana desde el lunes) con marca **roja = gastos** y **verde = ingresos**. Al tocar un día se ven sus movimientos con **Añadir ingreso / Añadir gasto** (modal en móvil, panel lateral en escritorio; FAB "+" en móvil). Cambia de mes con las flechas y de moneda si hay más de una.
- **Alta de movimiento:** `TransactionModal.tsx` (monto grande, moneda, categoría, nota, fecha, repetir). **Categorías con ícono y color** (`src/utils/financeCategories.ts`, `src/components/CategoryIcon.tsx`): predefinidas de gasto e ingreso + **categorías propias** (`personal.financeCategories`). Las categorías viejas/del asistente (Alimentación, Servicios…) se agrupan por alias.
- **Importación (pestaña "Importar"):** `FinanceImport.tsx` + `src/utils/financeImport.ts` + `src/utils/financeFiles.ts`. Acepta **CSV, Excel (.xlsx) y PDF** (resúmenes de tarjeta/cuenta; `pdfjs-dist` y `exceljs` se cargan bajo demanda). Detecta columnas (editables), formato de números/fechas argentino, modo **cuenta** o **tarjeta** (omite el pago del resumen, devoluciones = ingreso), sugiere categoría por comercio y por lo que ya cargaste, marca **duplicados** contra lo existente, y muestra una **vista previa editable** antes de guardar. Cada importación queda en `personal.financeImports` y se puede **deshacer** entera. Todo se procesa en el dispositivo.
- **Pendiente:** PDFs escaneados (imagen) no se leen; mejorar PDFs raros con el LLM local.

### 🧰 Utilidades: Lista de compras, Notas rápidas y Calculadora
- **Navegación:** `Utilidades > Lista de compras / Notas rápidas / Calculadora` (`#utilities:shopping`, `#utilities:quick-notes`, `#utilities:calculator`). Archivos en `src/sections/utilities/` (`ShoppingList.tsx`, `QuickNotes.tsx`, `Calculator.tsx`), estilos en `src/styles/utility-tools.css`.
- **Lista de compras:** varias listas, productos con cantidad/unidad/precio, categorías automáticas (`src/utils/shopping.ts`), check al carrito, total estimado vs. carrito, presupuesto con alerta, memoria de último precio por producto, compartir/copiar para WhatsApp y **Finalizar compra** (registra el gasto en Finanzas > Alimentación). Datos en `personal.shopping`. **Sin API de precios por ubicación todavía** (ver pendientes).
- **Notas rápidas:** notas con color, fijado, búsqueda, edición inline y copiado. Datos en `utilities.quickNotes`.
- **Calculadora:** evaluador seguro sin `eval` (`src/utils/calculator.ts`) con porcentajes estilo calculadora de bolsillo (`200 + 10%` = 220), teclado físico, historial persistente (`utilities.calculatorHistory`) y herramientas: dividir cuenta con propina, descuento, IVA (21/10,5/27) y porcentajes.
- **Asistente:** acciones `shopping_add` ("se acabó la leche, sumá pan a la lista") y `quick_note` ("anotame que...").

### 🩺 Salud: Mediciones (glucosa, presión, pulso, SpO₂, temperatura, colesterol)
- **Archivos:** `src/sections/health/Measurements.tsx`, `src/utils/measurements.ts`, `src/styles/measurements.css`. Ruta `#health:measurements`. Datos en `health.measurements`.
- **Cada medición guarda:** valor (presión: sistólica/diastólica + pulso), fecha y hora, **momento** (en ayunas, antes/1 h/2 h después de comer, después de hacer ejercicio, antes de dormir, en reposo, con síntomas…), **cómo se sentía** (5 niveles), síntomas y notas.
- **Estado orientativo** por rangos generales para adultos (presión según guía ESC); el momento cambia la clasificación (p. ej. glucosa 2 h después de comer, pulso/presión tras ejercicio). Aviso de atención ante valores peligrosos. No reemplaza criterio médico.
- **Vistas:** tarjetas resumen por tipo, gráfico de evolución con franja de referencia (7/30/90 d), historial agrupado por día con detalle editable y "Copiar resumen" para el médico.
- **Asistente:** acción `measurement` ("me medí la presión 12/8, estoy mareado", "glucosa 98 en ayunas"); detecta el momento con `detectContext`.

### 📌 Notas fijadas en el Dashboard
- `src/components/PinnedNotesCard.tsx`: una sola card con carrusel (flechas y puntos en escritorio, deslizar en móvil) con las notas rápidas fijadas (`pinned`). Se fija desde Utilidades > Notas rápidas.

### 📱 Diseño móvil compacto
- Todo lo móvil cuelga de `.mobile-app-shell`. `.page-container` ahora tiene margen lateral. Las pantallas nuevas usan encabezado en una línea (subtítulo oculto), formularios con campos secundarios plegables, filas de lista que se expanden al tocar, barra de acciones fija abajo (compras) e historial plegable (calculadora).

### 🗣️ Carga por conversación (todo el sistema, solo hablando)
- **Archivos:** `src/services/assistant/actionExtractor.ts` y `src/services/assistant/actions/` (`wellbeing.ts`, `money.ts`, `health.ts`, `vehicles.ts`, `organizer.ts`, `dateParser.ts`, `index.ts`).
- **Catálogo de acciones (`ALL_ACTIONS`):** agua, estado de ánimo/diario, comidas, peso, entrenamientos, gastos/ingresos, deudas y pagos, aportes de ahorro, toma/alta de medicación, vacunas, consultas, historial clínico (estudios), ciclo menstrual, vencimientos (VTV/seguro/licencia), combustible, service, recordatorios, tareas de proyectos, notas privadas, lista de compras, notas rápidas y mediciones de salud. Contraseñas y documentos NO se cargan por chat.
- **Cada acción** define `hints` (cuándo entra al prompt), `schema` + `example` (para el LLM), `build()` (valida, devuelve el cambio real + línea de confirmación + tarjeta con Deshacer, o una pregunta si falta un dato) y opcionalmente `local()` (interpretación determinística sin LLM). Para sumar un área nueva alcanza con agregar una definición.
- **Orden en `AssistantModal.handleSend`:** con el LLM disponible, **el LLM entiende el mensaje con las palabras del usuario, sin frases ni palabras clave**: (1) un clasificador corto (`about` de cada acción) decide qué áreas toca, (2) un extractor completa los datos de esas áreas, con las entidades ya cargadas (vehículos, deudas, metas, proyectos, medicación) como contexto, (3) si no hay nada para guardar, conversa (streaming). Las reglas por patrones (`localAssistant.ts` y `local()` de cada acción) solo se usan como **respaldo** cuando el LLM está caído o falla.
- **Honestidad:** el LLM nunca guarda ni confirma; solo interpreta. Si afirma haber guardado algo sin que la app lo haya hecho, `guardFalseSaveClaims` agrega un aviso. Si falta un dato (p. ej. la fecha de la VTV) el asistente pregunta en vez de adivinar.

### Avisos de recordatorios y medicación (notificaciones)
- `src/services/notifications/plan.ts` calcula qué avisar (recordatorios con fecha, dosis de medicación del día/siguientes, respetando dosis tomadas, fechas de fin y posposición; tope 60; ids estables). `index.ts` los entrega: en el APK con `@capacitor/local-notifications` (se programan con la app cerrada), en el navegador con la API `Notification` (solo mientras la app está abierta).
- `useNotificationSync` (montado en `App.tsx`) reprograma al cambiar los datos. Ajuste en Configuración (`NotificationSettings.tsx`): activar/desactivar, mostrar o no el detalle en el aviso (texto genérico si está apagado) y aviso de prueba. Requiere rebuild del APK (plugin nuevo + permisos en `AndroidManifest.xml`).

### Cierre de mejoras (exportes, tests, rendimiento, alertas)
- **Exportes:** `src/utils/exportRows.ts` (mediciones, compras, notas rápidas, categorías) alimenta el Excel/CSV de Respaldos; `measurementsPdf.ts` genera el PDF para el médico (botón en Mediciones y en Respaldos).
- **Tests/CI:** `npm test` (vitest, `src/__tests__`), `npm run test:server`; workflow `.github/workflows/ci.yml` (tsc + tests + build).
- **Bundle:** jsPDF y exceljs se cargan con `import()` bajo demanda (principal 2,1 MB → ~780 kB). No volver a importarlos de forma estática.
- **Alertas (`utils/insights.ts`):** mediciones altas/peligrosas de los últimos 3 días, topes de gasto ≥80 %, listas de compra sobre su presupuesto. El calendario de Finanzas muestra el tope por categoría.
- **Modelo de IA:** `AssistantModelSetting` en Configuración; se guarda en `lifekeeper:ollama-model` (vacío = automático).
- **Móvil:** `.mobile-app-shell .stats-grid` en 2 columnas. Auditoría a 390 px de las 26 secciones: sin desbordes horizontales.

### Overhaul de la UI móvil/APK
- **Botón flotante "+"** (`components/mobile/MobileQuickAdd.tsx`): +1 vaso de agua, nota rápida inline y accesos a gasto, medición, recordatorio, compras y notas.
- **Tirar para sincronizar** (`hooks/usePullToRefresh.ts`, conectado a `syncNow` en `App.tsx`).
- **Dashboard compacto:** KPIs en 2 columnas (de 1300 a ~490 px). **Cabecera:** botón de volver solo con flecha, título en una línea. **Pestañas:** degradé en los bordes y snap.
- Las pestañas de Vehículos tienen textos cortos. Todo el CSS nuevo está al final de `styles/mobile.css`.

### Enfoque Android (la app es mobile-first / APK)
- **Botón/gesto Atrás** (`hooks/useAndroidBackButton.ts`, plugin `@capacitor/app`): cierra la capa abierta (modal, menú, asistente), luego vuelve al inicio y en el inicio pide tocar dos veces para salir.
- **Sin ideas de escritorio en el celular:** `isTouchPrimary()` (`services/platform.ts`) oculta "Ctrl+K", y en el asistente y las notas rápidas **Enter es salto de línea** (se envía con el botón). Textos "hacé clic" → "tocá".
- **Tap targets ≥ 40 px** en pestañas y botones (final de `styles/mobile.css`).
- **Seguridad:** bloqueo al salir de la app con tiempo de gracia (Configuración). El desbloqueo biométrico real (huella con Keystore de Android) queda pendiente: requiere decidir guardar la contraseña maestra en el Keystore y un plugin nativo.
- **Sync:** chip de estado en el Dashboard (`SyncStatusChip`) y reintento automático (`useCloudAutoRetry`). **Carga rápida** (`utils/quickAction.ts`) abre directo gasto/medición/recordatorio. **Dashboard** personalizable (`DashboardTrends`, `preferences.dashboardLayout`).

### Efectos de clima del hero (Dashboard)
- **Lluvia:** vidrio empañado (`.fx-fogged-glass`: tinte lechoso + ruido SVG, más cerrado en los bordes para no tapar el texto) + microgotas de condensación (`.fx-fog-speckle`) + gotas con estela cónica suave. Se eliminaron las rayas diagonales (`::after` repetido) y las líneas verticales rígidas (`.fx-rain-streak`).
- **Despejado:** cielo (`.fx-sky`, cambia por mañana/tarde), sol con núcleo, halo y rayos que giran despacio, cirros. **Noche:** cielo profundo, luna creciente con halo, vía láctea tenue, estrellas y estrella fugaz.
- **Nublado / Nieve:** cielo propio y más cuerpo en nubes y escarcha. La posición del sol/luna es `--sky-x` (33 % en escritorio, 82 % en celular).
- Para revisar todos los estados: Dashboard, tocar el clima y usar "Vista previa de atmósfera en portada".

### Reglas aprendidas de la APK (no romper de nuevo)
- **Scroll:** NO poner `overscroll-behavior` en `.mobile-app-shell` (es un scroller por su `overflow-x`; corta el scroll táctil hacia el documento y deja la pantalla sin scroll). El que scrollea en el celular es el **documento**, no `.mobile-main-content`: el gesto de "tirar para sincronizar" debe mirar `window.scrollY`.
- **Descargas:** el WebView de Android NO descarga blobs. Todo exporte debe pasar por `utils/saveFile.ts` (`saveFile` / `savePdf`): en la web usa file-saver; en la APK escribe en el caché y abre el menú Compartir. Nunca usar `saveAs`/`doc.save` directo. `window.print()` tampoco existe.
- **Voz:** `speechSynthesis` y `webkitSpeechRecognition` no son confiables en el WebView: la APK usa `@capacitor-community/text-to-speech` y `@capacitor-community/speech-recognition` (`services/assistant/nativeTts.ts` / `nativeStt.ts`). Piper y todo servicio detrás de nginx (no Express) necesita **CORS** propio (la APK corre en `https://localhost`): ya está en `tts/server.py`.
- **Compatibilidad de WebViews viejos:** no usar `AbortSignal.timeout` (usar `utils/abort.ts`).
- **Animaciones:** `prefers-reduced-motion` de Android las apagaba todas. Preferencia `forceAnimations` + `<html data-motion="on">`. El fondo animado (`.bg-fx`) quedaba tapado por el fondo sólido de `.mobile-app-shell`: `html.has-fx .mobile-app-shell {background: transparent}`.
- **Sync:** si el token de la nube vence (el servidor se reinició con otra clave JWT), `syncService` vuelve a iniciar sesión solo (`reauth`) y los errores se muestran con un mensaje claro (`getLastError`).
- **Tablas:** en el celular se muestran como tarjetas (`hooks/useStackedTables.ts` + CSS al final de `mobile.css`); la lista va antes que el formulario de alta. Los formularios sueltos usan `.form-label`/`.form-input` (estilos en `components.css`).
- **Cómo auditar:** cargar datos realistas con el catálogo de acciones del asistente, importarlos por Respaldos y recorrer las 26 secciones y los modales a 390 px (pantallas vacías esconden los desbordes). Para probar scroll táctil usar `Input.dispatchTouchEvent` (CDP); `synthesizeScrollGesture` no funciona en headless.
- **Botón "+":** movible (arrastrar, se pega al borde, posición en `localStorage`) y ocultable (Configuración o la hoja del botón).

### Reglas de escritorio (modales, campos y header)
- **Modales:** en un efecto que enfoca algo, NUNCA poner `onClose` (ni otro callback) en las dependencias: es una función nueva en cada render y el efecto se reinicia, devolviendo el foco a la "X" en cada tecla (el espacio la presiona). Usar el patrón `onCloseRef`. Ya aplicado en `Modal`, `ConfirmModal`, `ShareModal`, `LegalModal`.
- **Cerrar con datos cargados:** `Modal` pide confirmación ("¿Salir sin guardar?") si se tocó un campo dentro de un `<form>` (tocar fuera, X o Esc). Las búsquedas se excluyen con `role="search"` o `data-no-dirty`; se desactiva con `confirmDiscard={false}`.
- **Campos:** todo input/select/textarea debe estar dentro de `.field` (no basta `.field-full`) o `.form-input`. Los campos sueltos en modales toman el estilo por una red de seguridad (`:where(.pref-modal-body ...)` en `components.css`). Los inputs numéricos no muestran las flechitas nativas.
- **Header:** el carrusel de navegación se muestra desde 821 px (debajo entra el layout móvil con hamburguesa). Entre 821 y 1279 la marca conserva su ancho natural.

### Ciclo menstrual, anticoncepción y días de menor fertilidad
- **Bug del NaN:** el formulario guardaba `startDate` como ISO con hora y el código hacía `startDate + 'T00:00:00'` (fecha inválida). Ahora TODO el cálculo vive en `utils/cycle.ts` (`dayKey`, `computeCycle`, `dayStatusFor`), que unifica ambos formatos. El Calendario general y el contexto del asistente usan lo mismo. No volver a concatenar strings de fecha.
- **Días de menor fertilidad:** método del calendario (Ogino-Knaus con los ciclos reales; días estándar 8–19 si hay pocos datos y el ciclo es de 26–32 días). Si el ciclo es irregular (variación > 9 días), faltan datos, o el período está atrasado (> 3 días), **no se estima nada**. Nunca se llama "seguros" a secas y siempre va el aviso: no es anticonceptivo confiable ni protege de ITS.
- **Anticoncepción** (`utils/contraceptives.ts`): pastilla (blíster + pausa, cumplimiento), parche, anillo, inyección (mensual/trimestral), DIU, implante, preservativo. Avisos nativos (`notifications/plan.ts`), alertas del Dashboard (`utils/insights.ts`) y acción del asistente `contraceptive_taken`.
- **Relaciones:** registro **privado** (`IntimacyEntry`): no va al Calendario, Dashboard, alertas ni al asistente. Solo se muestra dentro de la pestaña, con avisos de anticoncepción de emergencia / test / ITS.
- **UI:** `sections/health/cycle/*` (pestañas Resumen, Calendario, Anticoncepción, Relaciones, Registros) con gráficos SVG propios (línea de tiempo del ciclo, duración de ciclos, síntomas, cumplimiento, protección usada). Estilos en `styles/cycle.css`.

### Selector de fechas y autocompletado de ubicación
- **`DatePicker`:** conserva las flechas de mes y año; tocar el mes o el año abre la vista rápida (años en páginas de 12 + campo para escribirlo → mes → día). **Nada cambia hasta "Aceptar"** (Cancelar, tocar afuera y Esc descartan; doble toque en un día confirma). En celular es un panel inferior con botones grandes.
- **Ubicación del perfil:** `components/LocationFields.tsx` (País → Provincia/estado → Ciudad) sobre el combobox accesible `components/Autocomplete.tsx`. Países (`Intl.DisplayNames` en español, con siglas/apodos) y provincias/estados de 11 países (`data/places.ts`) funcionan **sin internet**; las ciudades vienen de `/api/public/geocode` (servidor, con caché de 30 días, Open-Meteo/GeoNames) con respaldo local (`services/api/geocode.ts`). Elegir una ciudad completa provincia, país y coordenadas (`profile.countryCode/province/city/latitude/longitude`). Si cambia el país, se limpian provincia y ciudad.

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

### 🔄 Actualizar la Web en el Server:
- **Desde Windows (recomendado):** doble clic en `update-web.bat` (o `.\scripts\update-web.ps1`). Revisa que todo esté subido a GitHub, entra por SSH y corre el script del servidor. Opciones: `-NoCache`, `-NoBackup`, `-DryRun`, `-Server`, `-User`.
- **En el server (SSH):** `cd ~/lifekeeper && ./scripts/update-web.sh` (copia de la base, `git pull --ff-only`, `.env`/`JWT_SECRET`, rebuild de `api`, `web` y `tts`, verificación). Ver `--help`.

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
