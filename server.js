require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const db = require('./config/database');
const authRoutes = require('./routes/auth');
const gameRoutes = require('./routes/game');
const playerRoutes = require('./routes/player');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

const PORT = process.env.PORT || 3000;
const MAX_CHAT_HISTORY = 40;
const MINECRAFT_BRIDGE_SECRET = process.env.MINECRAFT_BRIDGE_SECRET || 'bingung-local-bridge-secret';
const WEBSITE_CHAT_RATE_LIMIT_MS = 900;
const WEBSITE_TIP_RATE_LIMIT_MS = 1500;

const chatMessages = [];
let globalBetStats = {
    totalBets: 0,
    totalWins: 0,
    totalLosses: 0,
    totalWagered: 0,
    netProfit: 0
};
const connectedWebsiteUsers = new Map();
const websiteUserSockets = new Map();
const minecraftOnlineUsers = new Set();
let minecraftPresenceSyncedAt = 0;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET || 'bingung-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 72 * 60 * 60 * 1000,
        httpOnly: true
    }
});
app.use(sessionMiddleware);
io.use((socket, next) => sessionMiddleware(socket.request, socket.request.res || {}, next));

app.use(express.static('public'));

app.set('io', io);
if (typeof gameRoutes.setIo === 'function') {
    gameRoutes.setIo(io);
}
app.use('/api/auth', authRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/player', playerRoutes);

function sanitizeUsername(value, fallback = 'Player') {
    const safeValue = String(value || fallback)
        .replace(/[^a-zA-Z0-9_]/g, '')
        .slice(0, 16);

    return safeValue || fallback;
}

function sanitizeMessage(value) {
    return String(value || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 220);
}

function toMoney(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
}

function registerWebsiteSocket(socketId, username) {
    if (!socketId || !username) {
        return;
    }

    connectedWebsiteUsers.set(socketId, username);

    if (!websiteUserSockets.has(username)) {
        websiteUserSockets.set(username, new Set());
    }

    websiteUserSockets.get(username).add(socketId);
}

function unregisterWebsiteSocket(socketId) {
    const username = connectedWebsiteUsers.get(socketId);
    if (!username) {
        return;
    }

    connectedWebsiteUsers.delete(socketId);

    const socketIds = websiteUserSockets.get(username);
    if (!socketIds) {
        return;
    }

    socketIds.delete(socketId);

    if (socketIds.size === 0) {
        websiteUserSockets.delete(username);
    }
}

function emitToWebsiteUser(username, event, payload) {
    const socketIds = websiteUserSockets.get(username);
    if (!socketIds || socketIds.size === 0) {
        return;
    }

    socketIds.forEach((socketId) => {
        io.to(socketId).emit(event, payload);
    });
}

function getPresencePayload() {
    const websiteUsernames = [...new Set(connectedWebsiteUsers.values())];
    const minecraftUsernames = [...minecraftOnlineUsers];
    const usingMinecraftPresence = minecraftPresenceSyncedAt > 0;
    const usernames = usingMinecraftPresence ? minecraftUsernames : websiteUsernames;

    return {
        onlinePlayers: usernames.length,
        usernames: usernames.slice(0, 12),
        websiteOnlinePlayers: websiteUsernames.length,
        source: usingMinecraftPresence ? 'minecraft' : 'website',
        syncedAt: usingMinecraftPresence ? minecraftPresenceSyncedAt : Date.now()
    };
}

function getGlobalStatsPayload() {
    return {
        ...globalBetStats,
        ...getPresencePayload()
    };
}

function broadcastPresence() {
    io.emit('presence:update', getPresencePayload());
}

function emitGlobalStats() {
    io.emit('global:stats', getGlobalStatsPayload());
}

function pushChatMessage(entry) {
    chatMessages.unshift(entry);

    while (chatMessages.length > MAX_CHAT_HISTORY) {
        chatMessages.pop();
    }
}

function requireMinecraftBridgeAuth(req, res, next) {
    const secret = String(req.get('x-minecraft-bridge-secret') || req.body?.secret || '');

    if (!secret || secret !== MINECRAFT_BRIDGE_SECRET) {
        return res.status(401).json({ success: false, message: 'Invalid bridge secret' });
    }

    next();
}

app.post('/api/realtime/minecraft/presence', requireMinecraftBridgeAuth, (req, res) => {
    const usernames = Array.isArray(req.body?.usernames) ? req.body.usernames : [];
    minecraftOnlineUsers.clear();
    usernames
        .map((username) => sanitizeUsername(username, ''))
        .filter(Boolean)
        .slice(0, 80)
        .forEach((username) => minecraftOnlineUsers.add(username));
    minecraftPresenceSyncedAt = Date.now();

    const presence = getPresencePayload();
    broadcastPresence();
    emitGlobalStats();

    res.json({
        success: true,
        presence
    });
});

app.post('/api/realtime/minecraft/chat', requireMinecraftBridgeAuth, (req, res) => {
    res.json({ success: true, relayed: false });
});

app.post('/api/realtime/minecraft/wallet', requireMinecraftBridgeAuth, (req, res) => {
    const username = sanitizeUsername(req.body?.username, '');
    if (!username) {
        return res.status(400).json({ success: false, message: 'Username is required' });
    }

    const walletBalance = Number(req.body?.walletBalance ?? 0);
    const vaultBalance = Number(req.body?.vaultBalance ?? 0);

    emitToWebsiteUser(username, 'wallet:updated', {
        username,
        walletBalance: Number.isFinite(walletBalance) ? walletBalance : 0,
        vaultBalance: Number.isFinite(vaultBalance) ? vaultBalance : 0,
        source: 'minecraft',
        syncedAt: Date.now()
    });

    return res.json({ success: true });
});

io.on('connection', (socket) => {
    console.log('New client connected');
    const sessionData = socket.request.session || {};
    const sessionUsername = sessionData.loggedIn
        ? sanitizeUsername(sessionData.username, '')
        : '';

    socket.data.chatReady = !!sessionUsername;
    socket.data.lastChatAt = 0;
    socket.data.lastTipAt = 0;

    if (sessionUsername) {
        registerWebsiteSocket(socket.id, sessionUsername);
    }

    socket.emit('casino:snapshot', {
        globalStats: getGlobalStatsPayload(),
        chatMessages: chatMessages.slice(0, 24),
        chatMode: 'website',
        crashState: typeof global.getCrashStateSnapshot === 'function'
            ? global.getCrashStateSnapshot(sessionUsername || null)
            : null
    });

    if (sessionUsername) {
        broadcastPresence();
        emitGlobalStats();
    }

    socket.on('chat:send', (payload) => {
        const username = socket.data.chatReady ? sessionUsername : '';
        if (!username) {
            socket.emit('chat:error', {
                message: 'Login first to use website chat.'
            });
            return;
        }

        const message = sanitizeMessage(payload?.message);
        if (!message) {
            socket.emit('chat:error', {
                message: 'Chat message cannot be empty.'
            });
            return;
        }

        const now = Date.now();
        if (now - Number(socket.data.lastChatAt || 0) < WEBSITE_CHAT_RATE_LIMIT_MS) {
            socket.emit('chat:error', {
                message: 'Slow down a little before sending another message.'
            });
            return;
        }

        socket.data.lastChatAt = now;

        const entry = {
            username,
            avatarUrl: '',
            message,
            timestamp: now,
            source: 'website'
        };

        pushChatMessage(entry);
        io.emit('chat:new', entry);
    });

    socket.on('chat:tip', async (payload) => {
        const sender = socket.data.chatReady ? sessionUsername : '';
        if (!sender) {
            socket.emit('chat:error', { message: 'Login first to tip players.' });
            return;
        }

        const recipient = sanitizeUsername(payload?.recipient, '');
        const amount = toMoney(payload?.amount);
        const now = Date.now();

        if (!recipient || recipient === sender) {
            socket.emit('chat:error', { message: 'Choose another player to tip.' });
            return;
        }

        if (!Number.isFinite(amount) || amount <= 0) {
            socket.emit('chat:error', { message: 'Enter a valid tip amount.' });
            return;
        }

        if (now - Number(socket.data.lastTipAt || 0) < WEBSITE_TIP_RATE_LIMIT_MS) {
            socket.emit('chat:error', { message: 'Give tips a tiny cooldown.' });
            return;
        }

        socket.data.lastTipAt = now;
        let connection;

        try {
            connection = await db.getConnection();
            await connection.beginTransaction();

            const [players] = await connection.query(
                `SELECT username, balance, wallet_balance
                 FROM players
                 WHERE username IN (?, ?)
                 ORDER BY username
                 FOR UPDATE`,
                [sender, recipient]
            );

            const senderRow = players.find((player) => player.username === sender);
            const recipientRow = players.find((player) => player.username === recipient);

            if (!senderRow || !recipientRow) {
                await connection.rollback();
                socket.emit('chat:error', { message: 'That player does not exist yet.' });
                return;
            }

            const senderWallet = Number(senderRow.wallet_balance || 0);
            const recipientWallet = Number(recipientRow.wallet_balance || 0);
            if (senderWallet < amount) {
                await connection.rollback();
                socket.emit('chat:error', { message: 'Not enough website wallet balance for that tip.' });
                return;
            }

            const senderAfter = toMoney(senderWallet - amount);
            const recipientAfter = toMoney(recipientWallet + amount);

            await connection.query(
                'UPDATE players SET wallet_balance = ? WHERE username = ?',
                [senderAfter, sender]
            );
            await connection.query(
                'UPDATE players SET wallet_balance = ? WHERE username = ?',
                [recipientAfter, recipient]
            );
            await connection.query(
                `INSERT INTO chat_tips (sender, recipient, amount)
                 VALUES (?, ?, ?)`,
                [sender, recipient, amount]
            );

            await connection.commit();

            emitToWebsiteUser(sender, 'wallet:updated', {
                username: sender,
                walletBalance: senderAfter,
                vaultBalance: Number(senderRow.balance || 0),
                source: 'chat-tip',
                syncedAt: Date.now()
            });
            emitToWebsiteUser(recipient, 'wallet:updated', {
                username: recipient,
                walletBalance: recipientAfter,
                vaultBalance: Number(recipientRow.balance || 0),
                source: 'chat-tip',
                syncedAt: Date.now()
            });

            const entry = {
                username: sender,
                avatarUrl: '',
                message: `tipped ${recipient} $${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                timestamp: Date.now(),
                source: 'tip',
                tip: { sender, recipient, amount }
            };

            pushChatMessage(entry);
            io.emit('chat:new', entry);
        } catch (error) {
            if (connection) {
                await connection.rollback();
            }
            console.error('Chat tip error:', error);
            socket.emit('chat:error', { message: 'Tip failed. Try again in a moment.' });
        } finally {
            if (connection) {
                connection.release();
            }
        }
    });

    socket.on('disconnect', () => {
        unregisterWebsiteSocket(socket.id);
        broadcastPresence();
        emitGlobalStats();
        console.log('Client disconnected');
    });
});

global.emitToWebsiteUser = emitToWebsiteUser;

global.broadcastJackpotState = (payload) => {
    io.emit('jackpot:state', payload);
};

global.broadcastBet = (betData) => {
    globalBetStats.totalBets += 1;
    globalBetStats.totalWins += betData.won ? 1 : 0;
    globalBetStats.totalLosses += betData.won ? 0 : 1;
    globalBetStats.totalWagered += Number(betData.amount || 0);
    globalBetStats.netProfit += Number(betData.profit || 0);

    io.emit('newBet', betData);
    emitGlobalStats();
};

async function ensureSchema() {
    try {
        await db.query(
            `CREATE TABLE IF NOT EXISTS players (
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
            )`
        );

        await db.query(
            `CREATE TABLE IF NOT EXISTS auth_codes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(16) NOT NULL,
                code VARCHAR(6) NOT NULL UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP NOT NULL,
                used BOOLEAN DEFAULT FALSE,
                INDEX idx_code (code),
                INDEX idx_username (username)
            )`
        );

        await db.query(
            `CREATE TABLE IF NOT EXISTS sessions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(16) NOT NULL,
                session_token VARCHAR(255) NOT NULL UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP NOT NULL,
                INDEX idx_session_token (session_token),
                INDEX idx_username (username)
            )`
        );

        await db.query(
            `CREATE TABLE IF NOT EXISTS bets (
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
            )`
        );
    } catch (error) {
        console.error('Base schema check failed:', error);
    }

    try {
        await db.query(
            `ALTER TABLE players
             ADD COLUMN wallet_balance DECIMAL(20, 2) DEFAULT 0.00 AFTER balance`
        );
        console.log('Added players.wallet_balance column');
    } catch (error) {
        if (error.code !== 'ER_DUP_FIELDNAME') {
            console.error('Player wallet schema check failed:', error);
        }
    }

    try {
        await db.query(
            `ALTER TABLE auth_codes
             ADD COLUMN used BOOLEAN DEFAULT FALSE`
        );
        console.log('Added auth_codes.used column');
    } catch (error) {
        if (error.code !== 'ER_DUP_FIELDNAME') {
            console.error('Auth code schema check failed:', error);
        }
    }

    try {
        await db.query(
            `ALTER TABLE bets
             ADD COLUMN game_type VARCHAR(32) NOT NULL DEFAULT 'casino' AFTER username`
        );
        console.log('Added bets.game_type column');
    } catch (error) {
        if (error.code !== 'ER_DUP_FIELDNAME') {
            console.error('Schema check failed:', error);
        }
    }

    try {
        await db.query(
            `CREATE TABLE IF NOT EXISTS settlement_receipts (
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
            )`
        );
    } catch (error) {
        console.error('Settlement receipt schema failed:', error);
    }

    try {
        await db.query(
            `CREATE TABLE IF NOT EXISTS provably_fair_profiles (
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
            )`
        );
    } catch (error) {
        console.error('Provably fair schema failed:', error);
    }

    try {
        await db.query(
            `CREATE TABLE IF NOT EXISTS wallet_transfers (
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
            )`
        );
    } catch (error) {
        console.error('Wallet transfer schema failed:', error);
    }

    try {
        await db.query(
            `CREATE TABLE IF NOT EXISTS daily_reward_claims (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(16) NOT NULL,
                claim_date DATE NOT NULL,
                level_at_claim INT NOT NULL,
                case_id VARCHAR(32) NOT NULL,
                item_name VARCHAR(80) NOT NULL,
                item_value DECIMAL(20, 2) NOT NULL,
                item_rarity VARCHAR(24) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uq_daily_reward_claim (username, claim_date),
                INDEX idx_daily_rewards_username (username),
                INDEX idx_daily_rewards_created_at (created_at)
            )`
        );
    } catch (error) {
        console.error('Daily reward schema failed:', error);
    }

    try {
        await db.query(
            `CREATE TABLE IF NOT EXISTS chat_tips (
                id INT AUTO_INCREMENT PRIMARY KEY,
                sender VARCHAR(16) NOT NULL,
                recipient VARCHAR(16) NOT NULL,
                amount DECIMAL(20, 2) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_chat_tips_sender (sender),
                INDEX idx_chat_tips_recipient (recipient),
                INDEX idx_chat_tips_created_at (created_at)
            )`
        );
    } catch (error) {
        console.error('Chat tip schema failed:', error);
    }
}

function printDatabaseHint(error) {
    if (!error || !error.code) {
        return;
    }

    if (error.code === 'ER_HOST_NOT_PRIVILEGED') {
        console.error('Database hint: the credentials are reaching MySQL, but the server is rejecting this machine IP. Double-check DB_PORT and make sure the DB provider allows connections from this public IP.');
        return;
    }

    if (error.code === 'ECONNREFUSED') {
        console.error('Database hint: the DB host/port is not accepting connections. Double-check DB_HOST and DB_PORT from your database panel.');
        return;
    }

    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
        console.error('Database hint: the username or password is being rejected by MySQL.');
    }
}

async function verifyDatabaseConnection() {
    try {
        await db.query('SELECT 1');
    } catch (error) {
        console.error('Database connection failed:', error);
        printDatabaseHint(error);
        throw error;
    }
}

async function loadRealtimeState() {
    try {
        const [rows] = await db.query(
            `SELECT
                COUNT(*) AS totalBets,
                COALESCE(SUM(CASE WHEN won = TRUE THEN 1 ELSE 0 END), 0) AS totalWins,
                COALESCE(SUM(CASE WHEN won = TRUE THEN 0 ELSE 1 END), 0) AS totalLosses,
                COALESCE(SUM(bet_amount), 0) AS totalWagered,
                COALESCE(SUM(profit), 0) AS netProfit
             FROM bets`
        );

        if (rows.length > 0) {
            globalBetStats = {
                totalBets: Number(rows[0].totalBets || 0),
                totalWins: Number(rows[0].totalWins || 0),
                totalLosses: Number(rows[0].totalLosses || 0),
                totalWagered: Number(rows[0].totalWagered || 0),
                netProfit: Number(rows[0].netProfit || 0)
            };
        }
    } catch (error) {
        console.error('Failed to load realtime state:', error);
    }
}

async function startServer() {
    try {
        await verifyDatabaseConnection();
        await ensureSchema();
        await loadRealtimeState();
    } catch (error) {
        console.error('Starting website in degraded mode until MySQL is reachable.');
    }

    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`Visit http://localhost:${PORT}`);
    });
}

startServer();
