CREATE DATABASE IF NOT EXISTS bingung_gambling;
USE bingung_gambling;

-- Players table
CREATE TABLE IF NOT EXISTS players (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(16) NOT NULL UNIQUE,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    balance DECIMAL(20, 2) DEFAULT 0.00,
    wallet_balance DECIMAL(20, 2) DEFAULT 0.00,
    total_wagered DECIMAL(20, 2) DEFAULT 0.00,
    total_won DECIMAL(20, 2) DEFAULT 0.00,
    level INT DEFAULT 1,
    xp BIGINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_uuid (uuid)
);

-- Auth codes table
CREATE TABLE IF NOT EXISTS auth_codes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(16) NOT NULL,
    code VARCHAR(6) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    INDEX idx_code (code),
    INDEX idx_username (username)
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(16) NOT NULL,
    session_token VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    INDEX idx_session_token (session_token),
    INDEX idx_username (username)
);

-- Bets table
CREATE TABLE IF NOT EXISTS bets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(16) NOT NULL,
    game_type VARCHAR(32) NOT NULL DEFAULT 'casino',
    bet_amount DECIMAL(20, 2) NOT NULL,
    multiplier DECIMAL(10, 2) NOT NULL,
    payout DECIMAL(20, 2) NOT NULL,
    profit DECIMAL(20, 2) NOT NULL,
    won BOOLEAN NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_created_at (created_at)
);

CREATE TABLE IF NOT EXISTS settlement_receipts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    request_id VARCHAR(80) NOT NULL,
    username VARCHAR(16) NOT NULL,
    game_type VARCHAR(32) NOT NULL,
    amount DECIMAL(20, 2) NULL,
    payout DECIMAL(20, 2) NULL,
    multiplier DECIMAL(10, 2) NULL,
    won BOOLEAN NULL,
    profit DECIMAL(20, 2) NULL,
    new_balance DECIMAL(20, 2) NULL,
    level INT NULL,
    xp_gained INT NULL,
    meta_json LONGTEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_request_id (request_id),
    INDEX idx_receipts_username (username),
    INDEX idx_receipts_created_at (created_at)
);

CREATE TABLE IF NOT EXISTS provably_fair_profiles (
    username VARCHAR(16) NOT NULL PRIMARY KEY,
    server_seed VARCHAR(128) NOT NULL,
    server_seed_hash VARCHAR(128) NOT NULL,
    client_seed VARCHAR(64) NOT NULL,
    nonce BIGINT NOT NULL DEFAULT 0,
    previous_server_seed VARCHAR(128) NULL,
    previous_server_seed_hash VARCHAR(128) NULL,
    rotated_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wallet_transfers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    request_id VARCHAR(80) NOT NULL,
    username VARCHAR(16) NOT NULL,
    transfer_type VARCHAR(16) NOT NULL,
    transfer_source VARCHAR(24) NOT NULL,
    amount DECIMAL(20, 2) NOT NULL,
    wallet_balance_before DECIMAL(20, 2) NULL,
    wallet_balance_after DECIMAL(20, 2) NULL,
    vault_balance_before DECIMAL(20, 2) NULL,
    vault_balance_after DECIMAL(20, 2) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_wallet_transfer_request_id (request_id),
    INDEX idx_wallet_transfers_username (username),
    INDEX idx_wallet_transfers_created_at (created_at)
);

-- Insert test data
INSERT INTO players (username, uuid, balance, wallet_balance, level, xp) 
VALUES ('TestPlayer', '00000000-0000-0000-0000-000000000000', 100000.00, 25000.00, 5, 2500)
ON DUPLICATE KEY UPDATE balance = balance;
