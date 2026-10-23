# Reglas generales de diseño — LifeKeeper

Documento de referencia para mantener consistencia visual. Todo cambio de UI debe respetar estas reglas.

## 1. Paleta de colores

Definida en `src/index.css` como tokens. No usar colores sueltos en componentes.

| Rol | Token | Oscuro | Claro |
|---|---|---|---|
| Fondo base | `--color-bg-secondary` | `#0a0a0c` | `#f4f5f7` |
| Superficie | `--color-surface` | `#0f0f13` | `#ffffff` |
| Superficie hover | `--color-surface-hover` | `#16161d` | `#f6f7f9` |
| Borde sutil | `--color-border` | `rgba(255,255,255,.09)` | `rgba(15,23,42,.10)` |
| Texto principal | `--color-text-primary` | `#f5f7fa` | `#0f172a` |
| Texto secundario | `--color-text-secondary` | `#c8cfda` | `#334155` |
| Texto terciario | `--color-text-tertiary` | `#a3adbd` | `#4b5768` |
| Texto atenuado | `--color-text-muted` | `#8b95a5` | `#64748b` |
| Acento azul | `--color-accent-blue` | `#5b8cff` | `#3b6ef0` |
| Acento cian | `--color-accent-cyan` | `#2ee6c0` | `#0f9d86` |
| Acento violeta | `--color-accent-purple` | `#b388ff` | `#7c5cff` |
| Éxito | `--color-success` | `#34d399` | `#0f9d6a` |
| Advertencia | `--color-warning` | `#fbbf24` | `#b45309` |
| Error | `--color-error` | `#f87171` | `#dc2626` |

- Gradiente de marca: `--gradient-accent: linear-gradient(120deg, #5b8cff, #2ee6c0)`.
- Hairline de layout: `--gradient-hairline` (azul → cian → violeta, con extremos transparentes). Se usa igual en el borde inferior del header y en el superior del footer.
- Sobre el gradiente de marca, el texto/ícono usa `--color-accent-ink` (`#04130f`) para contraste.

## 2. Scrollbars (kit “Scrollbar Overlay”)

Implementación adaptada del kit `Scrollbar Overlay - Web` en `src/scrollbar/`.

- **Página:** scrollbar flotante (`PageScrollbar`) que no reserva ancho. Aparece al scrollear, al pasar el mouse o al arrastrar; se desvanece a los **900 ms** de inactividad con fade de **450 ms**.
- **Contenedores con scroll propio** (menú móvil del header, modales legales y modales de preferencias): `ScrollbarOverlay` con la misma estética, montado por portal.
- **Indicador:** ancho 6 px, zona de interacción 9 px, esquinas `--radius-full`, separación vertical 4 px, alto mínimo 36 px.
- **Color:** `--scrollbar-color` (#a7b0c0 en oscuro, #788394 en claro), mezclado al 60 % normal y 90 % en hover.
- **Fallback:** touch y `forced-colors` conservan la scrollbar nativa; tablas/textareas usan la nativa estilizada con los mismos tokens.
- **Movimiento reducido:** sin transiciones (`prefers-reduced-motion`).
- No ocultar globalmente todas las scrollbars ni usar `scrollbar-gutter: stable` en la raíz.

## 3. Shell: header + contenido + footer

- El layout es una columna: **header sticky arriba**, contenido centrado (`--content-max`) y **footer fijo abajo**.
- Header y footer comparten lenguaje glass: fondo translúcido + `backdrop-filter: blur(22px) saturate(155%)`, brillo interno y sombras suaves.
- La **misma hairline gradient** cierra el header por abajo y abre el footer por arriba.
- **Containers borderless:** los paneles, cards, tiles y listas no usan borde; la separación se resuelve con superficies, blur, sombras y estados de hover. Los únicos bordes visibles son los de controles (botones/inputs) y el hairline gradient de los modales.
- Los modales (Configuración, Apariencia, legales y SOS) usan el **mismo borde gradient** (`--gradient-hairline`) que header y footer.
- Sin bordes duros entre regiones; la separación se resuelve con blur, tinte y profundidad.
- Alturas: header 72 px en desktop / 64 px en mobile, footer 78 px.

## 4. Navegación (header con desplegables)

- **Desktop (≥1280 px):** logo + items principales (`Dashboard` + secciones) con desplegables por hover/click y sub-secciones; el item activo se marca con un subrayado con gradiente. La selección actual dentro del desplegable se marca con fondo de acento y check. **Perfil no está en el nav**: se accede desde el menú del avatar.
- La navegación queda **centrada** entre branding y acciones (grid 0.6fr / 2fr / 0.6fr). Si en el futuro hay más items de los que entran, aparecen **flechas circulares glass** a izquierda/derecha con scroll suave y fundido en los bordes; el desplegable se renderiza en portal para que el carrusel no lo recorte.
- **Tablet y mobile (<1280 px):** el nav se reemplaza por un botón hamburguesa que abre un panel debajo del header (con backdrop, bloqueo de scroll y overlay scrollbar).
- El header incluye a la derecha: cambio de tema, menú del avatar y botón hamburguesa en mobile.

## 5. Radios, espaciado y tipografía

- Radios: sm 8 px, md 10 px, lg 12 px, xl 16 px, 2xl 20 px.
- Espaciado base 4 px (`--spacing-*`). Paneles con 1.5rem de padding en desktop.
- Tipografía: `--font-size-2xs` a `--font-size-3xl`; títulos con tracking negativo; cuerpo 0.9375rem.
- Jerarquía: título de página clamp(1.5–1.875rem) · título de panel 1.0625rem · labels 0.8125rem · metadatos 0.6875–0.75rem.

## 6. Footer y legales

- Footer fijo de 78 px, full width, con 2 filas: enlaces legales y metadata (`© año autor · marca · versión`).
- “Privacidad” y “Términos y condiciones” abren modales (`LegalModal`) con foco, ESC, click afuera y bloqueo de scroll.
- El contenido legal vive en `src/content/legal.ts`.
- Autor, enlace y versión se configuran en `src/config.ts` (`siteConfig`).

## 6.5 Login y creación de bóveda

- **Una sola tarjeta borderless** (sin borde exterior ni divisor interno) contiene el branding (logo + tagline + puntos de confianza) y el formulario. Sin hero separado ni scroll de página en desktop.
- **Login:** tarjeta horizontal de hasta 900 px (branding centrado a la izquierda, formulario a la derecha), centrada entre header y footer; logo grande y centrado en su panel, formulario de 360 px centrado, y todo dentro del alto del viewport (`authPanelScroll:false`, `pageScroll:false`).
- **Crear bóveda:** la tarjeta se ensancha hasta 1040 px y el formulario pasa a **dos columnas** en desktop; en mobile se apila y permite scroll de página.
- El logo respeta la variante elegida en Apariencia (lockup vertical, isotipo o logotipo) y vive dentro de la tarjeta.
- Tipografía compacta (título ≤1.875 rem, inputs 42–44 px), foco visible y footer fijo de 78 px.

## 7. Branding

- Header: isotipo + wordmark **sin contenedor** (se integran directo al vidrio del header). El logo usa 44 px de isotipo y 28 px de wordmark, con halo radial suave detrás para ganar legibilidad sin volver a un chip. Variantes configurables desde Apariencia: completo, solo isotipo o solo logotipo; se aplican también al login.
- Assets actuales (kit corregido, `public/LifeKeeper_Logo_Kit_alt/`): `isotipo.png` ← `01_emblema_original_transparente.png`, `wordmark.png` ← `02_wordmark_transparente.png`, `logo-login.png` ← `login_vertical_600.png`, `logo-horizontal.png` ← `header_horizontal_1400x280.png`.
- Login: lockup vertical del kit (`logo-login.png`) o la variante elegida, **dentro de la tarjeta de login**.
- **Logo en modo claro:** se utilizan los assets dedicados `isotipo-light.png`, `wordmark-light.png` y `logo-login-light.png` en `public/brand/` (que conservan el exterior transparente, rellenan las cavidades internas del escudo y del perrito con `#07111f`, y aplican tinta oscura `#0f172a` + acento profundo en el wordmark sin filtros `brightness` destructivos).
- Favicon/PWA: `favicon.ico`, `brand/icon-32.png`, `icon-180.png` (Apple), `icon-192.png` y `icon-512.png` (manifest), todos del kit nuevo.
- El kit original anterior se conserva en `public/LifeKeeper_Logo_Kit/`; el kit alternativo corregido vive en `public/LifeKeeper_Logo_Kit_alt/`.

## 8. Preferencias y apariencia

- Menú del avatar (header): Mi perfil, Configuración, Apariencia y Bloquear ahora. El header no repite el botón de cerrar ni el acceso a Perfil.
- **Configuración:** auto-bloqueo por inactividad y sección inicial (dashboard o última visitada).
- **Apariencia:** tema de color, modo oscuro/claro, fondo animado (14 efectos del pack Motion FX + “sin fondo”), opacidad de la capa, **cantidad de puntos** (multiplicador 1×–5× de la densidad del efecto), variante de logo y **todos los parámetros del efecto**.
- Los parámetros de cada fondo replican exactamente los del HTML original (`backgroundConfig.ts`): velocidad, intensidad, altura, densidad, definición, fluidez, mezcla y paleta, con sus rangos, defaults y etiquetas específicas por efecto (matrix, ecg y los efectos 2D). Cada efecto incluye “Restablecer”.
- Persistencia: `localStorage` con la clave `lifekeeper:preferences` (incluye `backgroundSettings` por efecto); el tema se aplica con `data-theme` en `<html>` y el modo con la clase `light-theme`.
- Los temas viven en `src/styles/themes.css` y solo redefinen acentos, gradientes y el `--fx-hue` de los fondos, de modo que todas las superficies se adaptan solas.
- Los fondos animados se sirven desde `public/backgrounds/motion-fx.html` en un iframe aislado (`pointer-events: none`), controlado por `postMessage` (efecto + settings); la capa se tiñe con `hue-rotate`/`saturate` según el tema.
- **Adaptación por tema:** cada tema define `--fx-hue`, `--fx-saturation` y `--fx-brightness` para el modo oscuro. En modo claro se usa `--fx-light-hue` (azul ≈200°, verde ≈120°, violeta ≈285°, cálidos 20–35°), `invert(.88)`, saturación reducida y opacidad al 60 %; así los fondos se vuelven pastel y acompañan las superficies claras en lugar de quedar como neón oscuro.
- La opacidad del fondo se pasa como `--fx-opacity`; el modo claro la multiplica por `--fx-light-opacity`.
- **Responsive/fullscreen:** la densidad de los puntos se multiplica por `clamp(0.9, altoViewport / 1000, 2)` y se recalcula al redimensionar (incluye F11/fullscreen); así la cantidad de puntos por área se mantiene estable en 1080p, 1440p, 4K y ultrawide, y no queda un patrón raro/estirado.
- Todos los íconos del Dashboard usan el mismo azul de acento (`--color-accent-blue`).

## 9. Controles custom y modales propios

- **Selects**: `src/components/Select.tsx`. Reemplazan a los `<select>` nativos en toda la app; trigger con el mismo estilo que los inputs y menú flotante en portal, glass, bordes redondeados y check del activo.
- **Fechas**: `src/components/DatePicker.tsx`. Calendario propio (semana empieza lunes, mes navegable, hoy/ahora/limpiar, modo fecha+hora) alineado al lenguaje visual de la app. Reemplaza todos los `input[type="date"]` y el `datetime-local` de Recordatorios.
- **Horarios**: `src/components/TimePicker.tsx`. Selector de hora custom (horas, minutos, chips rápidos y botón "Ahora") que reemplaza todos los `input[type="time"]` nativos tanto standalone como dentro de `DatePicker` con `withTime`.
- **TagInput**: `src/components/TagInput.tsx`. Un solo contenedor visual y un solo anillo de foco, con soporte para `suggestions` (chips de autocompletado de etiquetas existentes).
- **Confirmaciones (`ConfirmModal`)**: `src/components/ConfirmModal.tsx`. Prohibido usar `window.confirm` del navegador; toda acción destructiva (eliminar registros, restaurar backup) utiliza nuestro modal `.pref-modal.confirm-modal` con `--gradient-hairline`.
- **Subpaneles y grillas**: No anidar `.panel` dentro de `.panel`; para tarjetas o bloques internos usar `.subpanel`. Para campos de ancho completo en `.form-grid`, usar la clase `.field-full` en lugar de estilos inline.

## 10. Historial clínico

- Las entradas se muestran siempre **de la más nueva a la más vieja**.
- CRUD completo: crear, leer, **editar** y eliminar. La edición precarga la entrada, conserva la fecha y permite cancelar.
- Incluye un **gráfico de línea de tiempo** con todos los eventos clínicos (puntos por evento, coloreados por etiqueta, tooltip y ejes por año/mes).
