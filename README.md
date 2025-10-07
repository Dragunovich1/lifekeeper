# LifeKeeper

LifeKeeper es una boveda digital segura para gestionar tu informacion personal. Te permite guardar datos sensibles de forma local y cifrada.

## Funcionalidades

- **Gestion de Perfil**: Administra tus datos de usuario.
- **Salud**: Lleva un registro de tu informacion de salud, incluyendo:
    - Vacunas
    - Consultas medicas
    - Medicaciones
    - Historial clinico
    - Tarjeta de Emergencia
- **Diario Personal**: Un diario privado con seguimiento de estado de animo.
- **Seguridad**:
    - Gestor de contrasenas
    - Almacen de documentos sensibles
    - Notas privadas
- **Vida Personal**:
    - Seguimiento de finanzas
    - Proyectos e ideas
    - Registro de mantenimiento de vehiculos
- **Utilidades**:
    - Recordatorios
    - Calendario
    - Respaldos y exportacion de datos (JSON, Excel, CSV, PDF)

## Tecnologias utilizadas

- **Frontend**: React, Vite, TypeScript
- **Estilos**: CSS basico
- **Visualizacion de Datos**: Recharts
- **Cifrado**: crypto-js

## Instalacion

1. Clona el repositorio.
2. Instala las dependencias:
   ```bash
   npm install
   ```

## Uso

Para ejecutar el proyecto en modo de desarrollo:

```bash
npm run dev
```

Esto iniciara el servidor de desarrollo en `http://localhost:5173` (u otro puerto si esta ocupado).

## Scripts disponibles

- `npm run dev`: Inicia el servidor de desarrollo.
- `npm run build`: Compila la aplicacion para produccion.
- `npm run lint`: Analiza el codigo con ESLint.
- `npm run preview`: Sirve la compilacion de produccion de forma local.