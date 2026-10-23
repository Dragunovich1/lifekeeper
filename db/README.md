# LifeKeeper Vault — Base de Datos PostgreSQL (Zero-Knowledge)

Este directorio contiene el esquema de base de datos y la configuración para desplegar la capa de persistencia de LifeKeeper en la nube o en servidores propios.

## Principio Criptográfico Fundamental
- **Zero-Knowledge (Conocimiento Cero):** La base de datos almacena exclusivamente **bloques cifrados con AES-256-GCM** (`encrypted_data`), vectores de inicialización (`iv`) y etiquetas de autenticación (`auth_tag`).
- **Nadie en el servidor** (ni administradores de base de datos ni atacantes) puede leer la información de salud, finanzas, contraseñas o diarios personales.
- La derivación de claves usa **PBKDF2 con 600.000 iteraciones** y salting individual por cuenta.

## Cómo levantar PostgreSQL localmente con Docker
Para pruebas o desarrollo local con Docker instalado:

```bash
cd db
docker compose up -d
```

Esto levantará PostgreSQL 16 en el puerto `5432` y ejecutará automáticamente `schema.sql` para inicializar las tablas y políticas de aislamiento (RLS).
