-- Remote VS Code Controller - PostgreSQL / SQLite compatible schema

CREATE TABLE IF NOT EXISTS devices (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    hostname VARCHAR(255),
    platform VARCHAR(64) NOT NULL,
    os_version VARCHAR(128),
    arch VARCHAR(64),
    vscode_installed BOOLEAN DEFAULT FALSE,
    vscode_version VARCHAR(64),
    status VARCHAR(32) DEFAULT 'offline',
    ip_address VARCHAR(64),
    last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS paired_controllers (
    id VARCHAR(64) PRIMARY KEY,
    device_id VARCHAR(64) NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    controller_id VARCHAR(64) NOT NULL,
    controller_name VARCHAR(255) NOT NULL,
    paired_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_connected_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(64) PRIMARY KEY,
    device_id VARCHAR(64) NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    controller_id VARCHAR(64) NOT NULL,
    workspace_path TEXT NOT NULL,
    port INTEGER,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE,
    granted_permissions JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(64),
    device_id VARCHAR(64) NOT NULL,
    controller_id VARCHAR(64),
    event_type VARCHAR(64) NOT NULL,
    details JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
CREATE INDEX IF NOT EXISTS idx_sessions_device ON sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_audit_device ON audit_logs(device_id);
