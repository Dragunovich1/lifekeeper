-- ============================================================================
-- LIFEKEEPER VAULT — ESQUEMA DE BASE DE DATOS POSTGRESQL (ZERO-KNOWLEDGE E2EE)
-- ============================================================================
-- Diseñado para arquitectura de Conocimiento Cero (Zero-Knowledge).
-- El servidor NUNCA conoce las contraseñas maestras ni el contenido de la bóveda.
-- Todos los datos sensibles viajan y se almacenan cifrados con AES-256-GCM.
-- ============================================================================

-- Extensiones requeridas
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. TABLA: users (Identidad y metadatos de autenticación)
-- ----------------------------------------------------------------------------
-- Nota: 'auth_hash' NO es la contraseña maestra. Es un hash derivado con salt
-- y 600.000 iteraciones PBKDF2 que solo sirve para comprobar la sesión.
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    auth_hash VARCHAR(255) NOT NULL,
    salt VARCHAR(128) NOT NULL,
    recovery_hash VARCHAR(255),
    two_factor_secret VARCHAR(128),
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    current_vault_version INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ----------------------------------------------------------------------------
-- 2. TABLA: vault_snapshots (Almacenamiento de la Bóveda Cifrada)
-- ----------------------------------------------------------------------------
-- 'encrypted_data' contiene el paquete completo de la bóveda (salud, finanzas,
-- notas, contraseñas, diario) cifrado en el navegador con AES-256-GCM.
-- Para el servidor y la base de datos es un bloque 100% ilegible.
CREATE TABLE IF NOT EXISTS vault_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    version INT NOT NULL DEFAULT 1,
    encrypted_data TEXT NOT NULL,
    iv VARCHAR(64) NOT NULL,
    auth_tag VARCHAR(64) NOT NULL,
    checksum VARCHAR(64) NOT NULL,
    device_id VARCHAR(128),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_vault UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_vault_snapshots_user_id ON vault_snapshots(user_id);

-- ----------------------------------------------------------------------------
-- 3. TABLA: vault_history (Historial de respaldos para recuperación de versiones)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vault_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    version INT NOT NULL,
    encrypted_data TEXT NOT NULL,
    iv VARCHAR(64) NOT NULL,
    checksum VARCHAR(64) NOT NULL,
    device_id VARCHAR(128),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vault_history_user ON vault_history(user_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 4. TABLA: security_audit_logs (Auditoría de accesos e intentos de login)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS security_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    event_type VARCHAR(64) NOT NULL, -- 'login_success', 'login_failed', 'sync_pushed', 'recovery_used'
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_logs_user_date ON security_audit_logs(user_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 5. POLÍTICAS DE ROW LEVEL SECURITY (RLS)
-- ----------------------------------------------------------------------------
-- Garantiza que cada usuario autenticado SOLO pueda ver y modificar sus propios registros.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE vault_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE vault_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_audit_logs ENABLE ROW LEVEL SECURITY;

-- Política de lectura/escritura para vault_snapshots
CREATE POLICY user_vault_isolation_policy ON vault_snapshots
    FOR ALL
    USING (user_id = current_setting('request.jwt.claim.sub', true)::uuid)
    WITH CHECK (user_id = current_setting('request.jwt.claim.sub', true)::uuid);

-- ----------------------------------------------------------------------------
-- 6. TRIGGER PARA ACTUALIZAR updated_at AUTOMÁTICAMENTE
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_timestamp
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp_column();

CREATE TRIGGER update_vault_timestamp
    BEFORE UPDATE ON vault_snapshots
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp_column();
