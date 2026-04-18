const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { getCaseById, getCaseCatalog, pickCaseItem } = require('../config/caseCatalog');
const { getLevelFromXp, getWagerXpGain } = require('../config/progression');
const {
    buildDefaultClientSeed,
    buildFairnessPayload,
    generateServerSeed,
    hashServerSeed,
    rollFloat,
    rollInt,
    sanitizeClientSeed
} = require('../config/provablyFair');

const GENERIC_BET_EDGE = 0.86;
const DICE_EDGE = 0.86;
const LIMBO_EDGE = 0.84;
const CRASH_EDGE = 0.86;
const LIMBO_MAX_TARGET = 25;
const DEFAULT_PLINKO_ROWS = 8;
const MIN_PLINKO_ROWS = 8;
const MAX_PLINKO_ROWS = 16;
const CRASH_BETTING_WINDOW_MS = 8000;
const CRASH_RESULT_WINDOW_MS = 2400;
const CRASH_TICK_INTERVAL_MS = 120;
const CRASH_HISTORY_LIMIT = 12;
const GAME_ACTION_SERVER_COOLDOWN_MS = 650;
const ROULETTE_SEGMENTS = [
    { color: 'green', label: '0' },
    { color: 'red', label: '1' },
    { color: 'black', label: '2' },
    { color: 'red', label: '3' },
    { color: 'black', label: '4' },
    { color: 'red', label: '5' },
    { color: 'black', label: '6' },
    { color: 'red', label: '7' },
    { color: 'black', label: '8' },
    { color: 'red', label: '9' },
    { color: 'black', label: '10' },
    { color: 'red', label: '11' },
    { color: 'black', label: '12' },
    { color: 'red', label: '13' },
    { color: 'black', label: '14' }
];
const ROULETTE_PAYOUTS = { red: 1.78, black: 1.78, green: 8 };
const COINFLIP_PAYOUT = 1.78;
const PLINKO_RISK_CONFIG = {
    low: { label: 'Low', targetEv: 0.86, centerFloor: 0.58, edgeBase: 3.4, edgeGrowth: 0.18, curve: 1.34 },
    medium: { label: 'Medium', targetEv: 0.83, centerFloor: 0.14, edgeBase: 6.4, edgeGrowth: 0.34, curve: 1.1 },
    high: { label: 'High', targetEv: 0.8, centerFloor: 0.03, edgeBase: 18, edgeGrowth: 0.34, curve: 0.92 }
};
const WHEEL_SEGMENT_MAP = {
    low: [0.72, 0.92, 1.08, 1.42, 2.45, 1.42, 1.08, 0.92],
    medium: [0.12, 0.45, 0.92, 1.75, 4.4, 1.75, 0.92, 0.45],
    high: [0.02, 0.12, 0.38, 1.45, 16, 1.45, 0.38, 0.12]
};
const KENO_PAYOUTS = { 5: 1.15, 6: 1.8, 7: 3.2, 8: 6.4, 9: 12, 10: 24 };
const KNOWN_GAME_TYPES = new Set([
    'casino',
    'crash',
    'mines',
    'towers',
    'plinko',
    'dice',
    'roulette',
    'blackjack',
    'coinflip',
    'wheel',
    'limbo',
    'keno',
    'slots',
    'cases',
    'casebattles'
]);
const SERVER_PLAY_GAME_TYPES = new Set(['dice', 'plinko', 'roulette', 'coinflip', 'wheel', 'limbo', 'keno']);
const INTERACTIVE_SETTLE_GAME_TYPES = new Set(['mines', 'towers', 'blackjack', 'slots', 'casebattles']);
const MAX_MULTIPLIER_BY_GAME = {
    casino: 40,
    crash: 80,
    mines: 6.5,
    towers: 3.6,
    plinko: 30,
    dice: 48,
    roulette: 10,
    blackjack: 2.5,
    coinflip: COINFLIP_PAYOUT,
    wheel: 24,
    limbo: LIMBO_MAX_TARGET,
    keno: 24,
    slots: 24,
    cases: 12,
    casebattles: 4
};
let crashIo = null;
let crashRoundCounter = 0;
const serverActionCooldowns = new Map();
const crashRoundState = {
    phase: 'betting',
    roundId: 0,
    multiplier: 1,
    crashPoint: 1,
    bettingClosesAt: 0,
    startedAt: 0,
    crashedAt: 0,
    bets: new Map(),
    history: [],
    timer: null,
    launchTimer: null,
    resultTimer: null,
    tickBusy: false
};

const requireAuth = (req, res, next) => {
    if (!req.session.loggedIn) {
        return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    next();
};

function sanitizeGameType(gameType) {
    const safeValue = String(gameType || 'casino')
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '')
        .slice(0, 32);

    return KNOWN_GAME_TYPES.has(safeValue) ? safeValue : 'casino';
}

function claimServerActionCooldown(username, actionKey, cooldownMs = GAME_ACTION_SERVER_COOLDOWN_MS) {
    const key = `${username}:${actionKey}`;
    const now = Date.now();
    const nextAllowedAt = serverActionCooldowns.get(key) || 0;

    if (now < nextAllowedAt) {
        return false;
    }

    serverActionCooldowns.set(key, now + cooldownMs);

    if (serverActionCooldowns.size > 5000) {
        for (const [storedKey, storedAt] of serverActionCooldowns.entries()) {
            if (storedAt < now) {
                serverActionCooldowns.delete(storedKey);
            }
        }
    }

    return true;
}

function sanitizeRequestId(value) {
    const safeValue = String(value || '')
        .trim()
        .replace(/[^a-zA-Z0-9:_-]/g, '')
        .slice(0, 80);

    return safeValue || crypto.randomUUID();
}

function toMoney(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
}

function readNumber(value) {
    return Number(value || 0);
}

function readWalletBalance(playerRow = {}) {
    return Number(playerRow.wallet_balance ?? playerRow.balance ?? 0);
}

function buildError(status, message) {
    return { status, message };
}

function buildSettlementValidation({ amount, payout, gameType }) {
    const safeAmount = toMoney(amount);
    const safePayout = toMoney(Math.max(0, payout));
    const safeGameType = sanitizeGameType(gameType);

    if (!Number.isFinite(safeAmount) || safeAmount <= 0) {
        return buildError(400, 'Invalid bet amount');
    }

    if (!Number.isFinite(safePayout) || safePayout < 0) {
        return buildError(400, 'Invalid payout');
    }

    const maxMultiplier = MAX_MULTIPLIER_BY_GAME[safeGameType] || 1;
    const effectiveMultiplier = safePayout > 0 ? safePayout / safeAmount : 0;

    if (effectiveMultiplier > maxMultiplier + 0.0001) {
        return buildError(400, 'Payout exceeds game limit');
    }

    return {
        amount: safeAmount,
        payout: safePayout,
        gameType: safeGameType,
        multiplier: safePayout > 0 ? toMoney(effectiveMultiplier) : 0,
        won: safePayout >= safeAmount
    };
}

function sanitizePlinkoRows(value) {
    const parsed = Math.round(readNumber(value) || DEFAULT_PLINKO_ROWS);
    return Math.max(MIN_PLINKO_ROWS, Math.min(MAX_PLINKO_ROWS, parsed));
}

function getBinomialCoefficients(rows) {
    const coefficients = [1];

    for (let step = 1; step <= rows; step += 1) {
        coefficients[step] = (coefficients[step - 1] * (rows - step + 1)) / step;
    }

    return coefficients;
}

function getPlinkoBuckets(risk, rows) {
    const safeRisk = PLINKO_RISK_CONFIG[risk] ? risk : 'medium';
    const safeRows = sanitizePlinkoRows(rows);
    const config = PLINKO_RISK_CONFIG[safeRisk];
    const centerIndex = safeRows / 2;
    const edgePeak = config.edgeBase + Math.max(0, safeRows - DEFAULT_PLINKO_ROWS) * config.edgeGrowth;
    const rawBuckets = Array.from({ length: safeRows + 1 }, (_, index) => {
        const distance = Math.abs(index - centerIndex) / Math.max(1, safeRows / 2);
        const shapedDistance = Math.pow(distance, config.curve);
        return config.centerFloor + shapedDistance * (edgePeak - config.centerFloor);
    });

    const coefficients = getBinomialCoefficients(safeRows);
    const totalPaths = 2 ** safeRows;
    const expectedValue = rawBuckets.reduce((total, value, index) => (
        total + (coefficients[index] / totalPaths) * value
    ), 0);
    const scale = expectedValue > 0 ? config.targetEv / expectedValue : 1;

    return rawBuckets.map((value) => {
        const scaled = value * scale;
        return toMoney(Math.max(0.02, Math.min(30, scaled)));
    });
}

function buildCrashSettlementRequestId(roundId, username) {
    return `crash:${roundId}:${sanitizeUsernameForMeta(username)}`;
}

function sanitizeUsernameForMeta(username) {
    return String(username || '')
        .replace(/[^a-zA-Z0-9_]/g, '')
        .slice(0, 16);
}

async function getOrCreateFairProfile(connection, username, options = {}) {
    const forUpdateClause = options.forUpdate ? ' FOR UPDATE' : '';
    let [rows] = await connection.query(
        `SELECT username, server_seed, server_seed_hash, client_seed, nonce, previous_server_seed, previous_server_seed_hash, rotated_at
         FROM provably_fair_profiles
         WHERE username = ?${forUpdateClause}`,
        [username]
    );

    if (rows.length > 0) {
        return rows[0];
    }

    const serverSeed = generateServerSeed();
    try {
        await connection.query(
            `INSERT INTO provably_fair_profiles (username, server_seed, server_seed_hash, client_seed, nonce)
             VALUES (?, ?, ?, ?, 0)`,
            [username, serverSeed, hashServerSeed(serverSeed), buildDefaultClientSeed(username)]
        );
    } catch (error) {
        if (error.code !== 'ER_DUP_ENTRY') {
            throw error;
        }
    }

    [rows] = await connection.query(
        `SELECT username, server_seed, server_seed_hash, client_seed, nonce, previous_server_seed, previous_server_seed_hash, rotated_at
         FROM provably_fair_profiles
         WHERE username = ?${forUpdateClause}`,
        [username]
    );

    return rows[0];
}

function parseReceiptMeta(metaJson) {
    if (!metaJson) {
        return {};
    }

    try {
        return JSON.parse(metaJson);
    } catch (error) {
        return {};
    }
}

async function claimReceipt(connection, { requestId, username, gameType }) {
    try {
        await connection.query(
            `INSERT INTO settlement_receipts (request_id, username, game_type)
             VALUES (?, ?, ?)`,
            [requestId, username, gameType]
        );

        return null;
    } catch (error) {
        if (error.code !== 'ER_DUP_ENTRY') {
            throw error;
        }

        const [rows] = await connection.query(
            `SELECT game_type, amount, payout, multiplier, won, profit, new_balance, level, xp_gained, meta_json
             FROM settlement_receipts
             WHERE request_id = ? AND username = ?
             LIMIT 1`,
            [requestId, username]
        );

        if (rows.length === 0 || rows[0].new_balance === null || rows[0].new_balance === undefined) {
            return buildError(409, 'Wager is already processing');
        }

        const stored = rows[0];
        return {
            status: 200,
            payload: {
                success: true,
                won: !!stored.won,
                payout: Number(stored.payout || 0),
                profit: Number(stored.profit || 0),
                newBalance: Number(stored.new_balance || 0),
                xpGained: Number(stored.xp_gained || 0),
                level: Number(stored.level || 1),
                multiplier: Number(stored.multiplier || 0),
                gameType: stored.game_type || gameType,
                duplicate: true,
                ...parseReceiptMeta(stored.meta_json)
            }
        };
    }
}

async function writeReceipt(connection, requestId, username, payload, meta = {}) {
    await connection.query(
        `UPDATE settlement_receipts
         SET amount = ?, payout = ?, multiplier = ?, won = ?, profit = ?, new_balance = ?, level = ?, xp_gained = ?, meta_json = ?
         WHERE request_id = ? AND username = ?`,
        [
            toMoney(payload.amount),
            toMoney(payload.payout),
            toMoney(payload.multiplier),
            payload.won,
            toMoney(payload.profit),
            toMoney(payload.newBalance),
            Number(payload.level || 1),
            Number(payload.xpGained || 0),
            JSON.stringify(meta || {}),
            requestId,
            username
        ]
    );
}

async function insertBetRecord(connection, { username, gameType, amount, multiplier, payout, profit, won }) {
    try {
        await connection.query(
            `INSERT INTO bets (username, game_type, bet_amount, multiplier, payout, profit, won)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [username, gameType, amount, multiplier, payout, profit, won]
        );
    } catch (error) {
        if (error.code !== 'ER_BAD_FIELD_ERROR') {
            throw error;
        }

        await connection.query(
            `INSERT INTO bets (username, bet_amount, multiplier, payout, profit, won)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [username, amount, multiplier, payout, profit, won]
        );
    }
}

async function settleBalanceChange(connection, playerRow, { username, requestId, gameType, amount, payout, multiplier, won, meta = {} }) {
    const balance = readWalletBalance(playerRow);

    if (balance < amount) {
        return buildError(400, 'Insufficient balance');
    }

    const profit = toMoney(payout - amount);
    const newBalance = toMoney(balance + profit);
    const xpGained = getWagerXpGain(amount, won);
    const updatedXp = Number(playerRow.xp || 0) + xpGained;
    const computedLevel = getLevelFromXp(updatedXp);

    await connection.query(
        `UPDATE players
         SET wallet_balance = ?, total_wagered = total_wagered + ?, total_won = total_won + ?, xp = ?, level = ?
         WHERE username = ?`,
        [newBalance, amount, payout, updatedXp, computedLevel, username]
    );

    await insertBetRecord(connection, {
        username,
        gameType,
        amount,
        multiplier,
        payout,
        profit,
        won
    });

    const payload = {
        success: true,
        won,
        payout,
        profit,
        newBalance,
        xpGained,
        level: computedLevel,
        multiplier,
        amount,
        gameType
    };

    await writeReceipt(connection, requestId, username, payload, meta);
    return { status: 200, payload };
}

async function settleReservedBalanceChange(connection, playerRow, { username, requestId, gameType, amount, payout, multiplier, won, meta = {} }) {
    const balance = readWalletBalance(playerRow);
    const safePayout = toMoney(payout);
    const profit = toMoney(safePayout - amount);
    const newBalance = toMoney(balance + safePayout);
    const xpGained = getWagerXpGain(amount, won);
    const updatedXp = Number(playerRow.xp || 0) + xpGained;
    const computedLevel = getLevelFromXp(updatedXp);

    await connection.query(
        `UPDATE players
         SET wallet_balance = ?, total_wagered = total_wagered + ?, total_won = total_won + ?, xp = ?, level = ?
         WHERE username = ?`,
        [newBalance, amount, safePayout, updatedXp, computedLevel, username]
    );

    await insertBetRecord(connection, {
        username,
        gameType,
        amount,
        multiplier,
        payout: safePayout,
        profit,
        won
    });

    const payload = {
        success: true,
        won,
        payout: safePayout,
        profit,
        newBalance,
        xpGained,
        level: computedLevel,
        multiplier,
        amount,
        gameType
    };

    await writeReceipt(connection, requestId, username, payload, meta);
    return { status: 200, payload };
}

function broadcastBet(payload) {
    if (!global.broadcastBet) {
        return;
    }

    global.broadcastBet({
        username: payload.username,
        gameType: payload.gameType,
        amount: payload.amount,
        multiplier: payload.multiplier,
        won: payload.won,
        profit: payload.profit,
        timestamp: Date.now()
    });
}

function calculateCrashMultiplier(startedAt) {
    const elapsedSeconds = Math.max(0, (Date.now() - startedAt) / 1000);
    const multiplier = Math.exp(elapsedSeconds * 0.34);
    return toMoney(Math.min(80, Math.max(1, multiplier)));
}

function generateCrashPoint() {
    const random = Math.random();
    const point = CRASH_EDGE / Math.max(0.0001, 1 - random);
    return toMoney(Math.max(1.01, Math.min(80, point)));
}

function getCrashUserBet(username) {
    if (!username) {
        return null;
    }

    return crashRoundState.bets.get(username) || null;
}

function getCrashStateSnapshot(username = null) {
    const activeBet = getCrashUserBet(username);

    return {
        roundId: crashRoundState.roundId,
        phase: crashRoundState.phase,
        multiplier: toMoney(crashRoundState.multiplier),
        crashPoint: crashRoundState.phase === 'crashed' ? toMoney(crashRoundState.crashPoint) : null,
        bettingClosesAt: crashRoundState.bettingClosesAt || null,
        startedAt: crashRoundState.startedAt || null,
        crashedAt: crashRoundState.crashedAt || null,
        history: crashRoundState.history.slice(0, CRASH_HISTORY_LIMIT),
        activeBet: activeBet
            ? {
                amount: activeBet.amount,
                autoCashout: activeBet.autoCashout,
                roundId: activeBet.roundId
            }
            : null
    };
}

function emitCrashState() {
    if (!crashIo) {
        return;
    }

    crashIo.emit('crash:state', getCrashStateSnapshot());
}

async function settleCrashBet(bet, { won, multiplier, payout, resultType }) {
    if (!bet || bet.settled) {
        return bet?.cachedPayload || null;
    }

    if (bet.settling) {
        return bet.cachedPayload || null;
    }

    bet.settling = true;
    const requestId = buildCrashSettlementRequestId(bet.roundId, bet.username);
    let connection;

    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const claimedReceipt = await claimReceipt(connection, {
            requestId,
            username: bet.username,
            gameType: 'crash'
        });

        if (claimedReceipt) {
            await connection.rollback();
            bet.cachedPayload = claimedReceipt.payload || null;
            bet.settled = true;
            crashRoundState.bets.delete(bet.username);
            emitCrashState();
            return bet.cachedPayload;
        }

        const [playerRows] = await connection.query(
            'SELECT balance, wallet_balance, xp, level FROM players WHERE username = ? FOR UPDATE',
            [bet.username]
        );

        if (playerRows.length === 0) {
            await connection.rollback();
            throw new Error('Player not found');
        }

        const result = await settleReservedBalanceChange(connection, playerRows[0], {
            username: bet.username,
            requestId,
            gameType: 'crash',
            amount: bet.amount,
            payout,
            multiplier,
            won,
            meta: {
                roundId: bet.roundId,
                resultType,
                autoCashout: bet.autoCashout,
                crashPoint: toMoney(crashRoundState.crashPoint)
            }
        });

        if (result.status !== 200) {
            await connection.rollback();
            throw new Error(result.message || 'Crash settlement failed');
        }

        await connection.commit();

        const payload = {
            ...result.payload,
            roundId: bet.roundId,
            resultType
        };

        bet.cachedPayload = payload;
        bet.settled = true;
        crashRoundState.bets.delete(bet.username);
        emitCrashState();
        broadcastBet({ username: bet.username, ...result.payload });

        if (global.emitToWebsiteUser) {
            global.emitToWebsiteUser(bet.username, 'crash:bet-settled', payload);
        }

        return payload;
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        bet.settling = false;
        console.error('Crash settlement error:', error);
        throw error;
    } finally {
        if (connection) {
            connection.release();
        }
    }
}

async function endCrashRound() {
    if (crashRoundState.phase === 'crashed') {
        return;
    }

    if (crashRoundState.timer) {
        clearInterval(crashRoundState.timer);
        crashRoundState.timer = null;
    }

    crashRoundState.phase = 'crashed';
    crashRoundState.multiplier = toMoney(crashRoundState.crashPoint);
    crashRoundState.crashedAt = Date.now();
    crashRoundState.history.unshift({
        roundId: crashRoundState.roundId,
        multiplier: toMoney(crashRoundState.crashPoint),
        timestamp: crashRoundState.crashedAt
    });
    crashRoundState.history = crashRoundState.history.slice(0, CRASH_HISTORY_LIMIT);
    emitCrashState();

    const pendingLosses = [...crashRoundState.bets.values()]
        .filter((bet) => !bet.settled && !bet.settling)
        .map((bet) => settleCrashBet(bet, {
            won: false,
            multiplier: 0,
            payout: 0,
            resultType: 'crash'
        }));

    if (pendingLosses.length > 0) {
        await Promise.allSettled(pendingLosses);
    }

    emitCrashState();

    crashRoundState.resultTimer = setTimeout(() => {
        startCrashBettingRound();
    }, CRASH_RESULT_WINDOW_MS);
}

async function tickCrashRound() {
    if (crashRoundState.tickBusy || crashRoundState.phase !== 'running') {
        return;
    }

    crashRoundState.tickBusy = true;

    try {
        crashRoundState.multiplier = calculateCrashMultiplier(crashRoundState.startedAt);

        const dueAutoCashouts = [...crashRoundState.bets.values()].filter((bet) => (
            !bet.settled &&
            !bet.settling &&
            bet.autoCashout > 1.01 &&
            crashRoundState.multiplier >= bet.autoCashout
        ));

        emitCrashState();

        if (dueAutoCashouts.length > 0) {
            await Promise.allSettled(dueAutoCashouts.map((bet) => settleCrashBet(bet, {
                won: true,
                multiplier: toMoney(bet.autoCashout),
                payout: toMoney(bet.amount * bet.autoCashout),
                resultType: 'auto_cashout'
            })));
        }

        if (crashRoundState.multiplier >= crashRoundState.crashPoint) {
            await endCrashRound();
        }
    } finally {
        crashRoundState.tickBusy = false;
    }
}

function startCrashRound() {
    crashRoundState.phase = 'running';
    crashRoundState.startedAt = Date.now();
    crashRoundState.crashedAt = 0;
    crashRoundState.multiplier = 1;
    emitCrashState();

    crashRoundState.timer = setInterval(() => {
        tickCrashRound().catch((error) => {
            console.error('Crash tick error:', error);
        });
    }, CRASH_TICK_INTERVAL_MS);
}

function startCrashBettingRound() {
    if (crashRoundState.timer) {
        clearInterval(crashRoundState.timer);
        crashRoundState.timer = null;
    }

    if (crashRoundState.launchTimer) {
        clearTimeout(crashRoundState.launchTimer);
    }

    if (crashRoundState.resultTimer) {
        clearTimeout(crashRoundState.resultTimer);
    }

    crashRoundCounter += 1;
    crashRoundState.phase = 'betting';
    crashRoundState.roundId = Date.now() + crashRoundCounter;
    crashRoundState.multiplier = 1;
    crashRoundState.crashPoint = generateCrashPoint();
    crashRoundState.bettingClosesAt = Date.now() + CRASH_BETTING_WINDOW_MS;
    crashRoundState.startedAt = 0;
    crashRoundState.crashedAt = 0;
    crashRoundState.bets = new Map();
    crashRoundState.tickBusy = false;
    emitCrashState();

    crashRoundState.launchTimer = setTimeout(() => {
        startCrashRound();
    }, CRASH_BETTING_WINDOW_MS);
}

function ensureCrashLoopStarted() {
    if (crashRoundState.roundId > 0) {
        return;
    }

    startCrashBettingRound();
}

function resolveServerGame({ gameType, amount, body, profile, nonceUsed }) {
    if (gameType === 'dice') {
        const rollOver = Math.min(98, Math.max(2, Math.floor(readNumber(body.rollOver))));
        const roll = rollFloat({ serverSeed: profile.server_seed, clientSeed: profile.client_seed, nonce: nonceUsed });
        const result = Math.floor(roll * 100);
        const multiplier = toMoney(DICE_EDGE / ((100 - rollOver) / 100));
        const won = result > rollOver;
        return {
            amount,
            payout: won ? toMoney(amount * multiplier) : 0,
            multiplier: won ? multiplier : 0,
            won,
            meta: { result, rollOver, fairness: buildFairnessPayload(profile, nonceUsed, { roll }) }
        };
    }

    if (gameType === 'plinko') {
        const risk = ['low', 'medium', 'high'].includes(body.risk) ? body.risk : 'medium';
        const rows = sanitizePlinkoRows(body.rows);
        const buckets = getPlinkoBuckets(risk, rows);
        const decisions = Array.from({ length: rows }, (_, index) => (
            rollFloat({ serverSeed: profile.server_seed, clientSeed: profile.client_seed, nonce: nonceUsed, cursor: index }) < 0.5 ? 0 : 1
        ));
        const bucketIndex = decisions.reduce((total, value) => total + value, 0);
        const multiplier = buckets[bucketIndex];
        const payout = toMoney(amount * multiplier);
        return {
            amount,
            payout,
            multiplier,
            won: payout >= amount,
            meta: { risk, rows, bucketIndex, decisions, buckets, fairness: buildFairnessPayload(profile, nonceUsed, { roll: bucketIndex / (rows + 1) }) }
        };
    }

    if (gameType === 'roulette') {
        const color = ['red', 'black', 'green'].includes(body.color) ? body.color : 'red';
        const winningIndex = rollInt({ serverSeed: profile.server_seed, clientSeed: profile.client_seed, nonce: nonceUsed, maxExclusive: ROULETTE_SEGMENTS.length });
        const winningSegment = ROULETTE_SEGMENTS[winningIndex];
        const won = winningSegment.color === color;
        const multiplier = won ? ROULETTE_PAYOUTS[winningSegment.color] : 0;
        return {
            amount,
            payout: won ? toMoney(amount * multiplier) : 0,
            multiplier,
            won,
            meta: { color, winningIndex, winningSegment, fairness: buildFairnessPayload(profile, nonceUsed, { roll: winningIndex / ROULETTE_SEGMENTS.length }) }
        };
    }

    if (gameType === 'coinflip') {
        const choice = body.choice === 'tails' ? 'tails' : 'heads';
        const roll = rollFloat({ serverSeed: profile.server_seed, clientSeed: profile.client_seed, nonce: nonceUsed });
        const resultSide = roll < 0.5 ? 'heads' : 'tails';
        const won = resultSide === choice;
        return {
            amount,
            payout: won ? toMoney(amount * COINFLIP_PAYOUT) : 0,
            multiplier: won ? COINFLIP_PAYOUT : 0,
            won,
            meta: { choice, resultSide, fairness: buildFairnessPayload(profile, nonceUsed, { roll }) }
        };
    }

    if (gameType === 'wheel') {
        const risk = ['low', 'medium', 'high'].includes(body.risk) ? body.risk : 'low';
        const segments = WHEEL_SEGMENT_MAP[risk];
        const segmentIndex = rollInt({ serverSeed: profile.server_seed, clientSeed: profile.client_seed, nonce: nonceUsed, maxExclusive: segments.length });
        const multiplier = segments[segmentIndex];
        const payout = toMoney(amount * multiplier);
        return {
            amount,
            payout,
            multiplier,
            won: payout >= amount,
            meta: { risk, segmentIndex, fairness: buildFairnessPayload(profile, nonceUsed, { roll: segmentIndex / segments.length }) }
        };
    }

    if (gameType === 'limbo') {
        const target = Math.min(LIMBO_MAX_TARGET, Math.max(1.01, toMoney(readNumber(body.target) || 2)));
        const roll = rollFloat({ serverSeed: profile.server_seed, clientSeed: profile.client_seed, nonce: nonceUsed });
        const resultMultiplier = Math.min(LIMBO_MAX_TARGET, toMoney(Math.max(1, LIMBO_EDGE / Math.max(0.0001, 1 - roll))));
        const won = resultMultiplier >= target;
        return {
            amount,
            payout: won ? toMoney(amount * target) : 0,
            multiplier: won ? target : 0,
            won,
            meta: { target, resultMultiplier, fairness: buildFairnessPayload(profile, nonceUsed, { roll }) }
        };
    }

    if (gameType === 'keno') {
        const selectedNumbers = Array.isArray(body.selectedNumbers)
            ? [...new Set(body.selectedNumbers.map((value) => Math.floor(readNumber(value))))]
                .filter((value) => value >= 1 && value <= 40)
                .slice(0, 10)
            : [];

        if (selectedNumbers.length === 0) {
            return buildError(400, 'Select at least 1 number');
        }

        const drawn = [];
        let cursor = 0;
        while (drawn.length < 20) {
            const candidate = rollInt({
                serverSeed: profile.server_seed,
                clientSeed: profile.client_seed,
                nonce: nonceUsed,
                cursor,
                maxExclusive: 40
            }) + 1;
            cursor += 1;
            if (!drawn.includes(candidate)) {
                drawn.push(candidate);
            }
        }

        const matches = selectedNumbers.filter((value) => drawn.includes(value)).length;
        const multiplier = KENO_PAYOUTS[matches] || 0;
        return {
            amount,
            payout: multiplier > 0 ? toMoney(amount * multiplier) : 0,
            multiplier,
            won: multiplier > 0,
            meta: { selectedNumbers, drawn, matches, fairness: buildFairnessPayload(profile, nonceUsed, { roll: matches / Math.max(1, selectedNumbers.length) }) }
        };
    }

    return buildError(400, 'Unsupported game');
}

router.get('/crash/state', (req, res) => {
    const username = req.session?.loggedIn ? req.session.username : null;
    ensureCrashLoopStarted();
    res.json({ success: true, crash: getCrashStateSnapshot(username) });
});

router.post('/crash/bet', requireAuth, async (req, res) => {
    const username = req.session.username;
    const amount = toMoney(req.body.amount);
    const autoCashoutInput = readNumber(req.body.autoCashout);
    const autoCashout = Number.isFinite(autoCashoutInput) && autoCashoutInput >= 1.01
        ? Math.min(80, toMoney(autoCashoutInput))
        : 0;

    if (!claimServerActionCooldown(username, 'crash:bet')) {
        return res.status(429).json({ success: false, message: 'Slow down before placing another crash bet' });
    }

    ensureCrashLoopStarted();

    if (crashRoundState.phase !== 'betting') {
        return res.status(409).json({ success: false, message: 'Crash betting window is closed for this round.' });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid bet amount' });
    }

    if (getCrashUserBet(username)) {
        return res.status(409).json({ success: false, message: 'You already have a crash bet in this round.' });
    }

    let connection;

    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const [playerRows] = await connection.query(
            'SELECT balance, wallet_balance FROM players WHERE username = ? FOR UPDATE',
            [username]
        );

        if (playerRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'Player not found' });
        }

        const currentBalance = readWalletBalance(playerRows[0]);
        if (currentBalance < amount) {
            await connection.rollback();
            return res.status(400).json({ success: false, message: 'Insufficient balance' });
        }

        const newBalance = toMoney(currentBalance - amount);
        await connection.query(
            'UPDATE players SET wallet_balance = ? WHERE username = ?',
            [newBalance, username]
        );

        await connection.commit();

        crashRoundState.bets.set(username, {
            username,
            amount,
            autoCashout,
            roundId: crashRoundState.roundId,
            placedAt: Date.now(),
            settled: false,
            settling: false,
            cachedPayload: null
        });
        emitCrashState();

        return res.json({
            success: true,
            amount,
            autoCashout,
            roundId: crashRoundState.roundId,
            newBalance
        });
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        console.error('Crash bet error:', error);
        return res.status(500).json({ success: false, message: 'Could not place crash bet' });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

router.post('/crash/cashout', requireAuth, async (req, res) => {
    const username = req.session.username;
    const bet = getCrashUserBet(username);

    ensureCrashLoopStarted();

    if (!bet) {
        return res.status(404).json({ success: false, message: 'No active crash bet found.' });
    }

    if (crashRoundState.phase !== 'running') {
        return res.status(409).json({ success: false, message: 'Crash round is not live yet.' });
    }

    try {
        const result = await settleCrashBet(bet, {
            won: true,
            multiplier: toMoney(crashRoundState.multiplier),
            payout: toMoney(bet.amount * crashRoundState.multiplier),
            resultType: 'cashout'
        });

        if (!result) {
            return res.status(409).json({ success: false, message: 'Crash cashout is already processing.' });
        }

        return res.json(result);
    } catch (error) {
        console.error('Crash cashout error:', error);
        return res.status(500).json({ success: false, message: 'Could not cash out crash bet' });
    }
});

router.get('/cases/catalog', (req, res) => {
    res.json({ success: true, cases: getCaseCatalog() });
});

router.get('/fairness', requireAuth, async (req, res) => {
    const username = req.session.username;

    try {
        const connection = await db.getConnection();
        try {
            const profile = await getOrCreateFairProfile(connection, username);
            return res.json({
                success: true,
                fairness: { ...buildFairnessPayload(profile, Number(profile.nonce), { scope: 'server' }), supportedGames: ['cases', ...SERVER_PLAY_GAME_TYPES] }
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Fairness load error:', error);
        return res.status(500).json({ success: false, message: 'Failed to load provably fair state' });
    }
});

router.post('/fairness/client-seed', requireAuth, async (req, res) => {
    const username = req.session.username;
    const clientSeed = sanitizeClientSeed(req.body.clientSeed, buildDefaultClientSeed(username));
    let connection;

    try {
        connection = await db.getConnection();
        await connection.beginTransaction();
        await getOrCreateFairProfile(connection, username, { forUpdate: true });
        await connection.query(
            `UPDATE provably_fair_profiles
             SET client_seed = ?, nonce = 0
             WHERE username = ?`,
            [clientSeed, username]
        );
        const profile = await getOrCreateFairProfile(connection, username, { forUpdate: true });
        await connection.commit();

        return res.json({
            success: true,
            fairness: { ...buildFairnessPayload(profile, Number(profile.nonce), { scope: 'server' }), supportedGames: ['cases', ...SERVER_PLAY_GAME_TYPES] }
        });
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        console.error('Client seed update error:', error);
        return res.status(500).json({ success: false, message: 'Failed to update client seed' });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

router.post('/fairness/rotate', requireAuth, async (req, res) => {
    const username = req.session.username;
    let connection;

    try {
        connection = await db.getConnection();
        await connection.beginTransaction();
        const profile = await getOrCreateFairProfile(connection, username, { forUpdate: true });
        const newServerSeed = generateServerSeed();
        await connection.query(
            `UPDATE provably_fair_profiles
             SET previous_server_seed = server_seed,
                 previous_server_seed_hash = server_seed_hash,
                 server_seed = ?,
                 server_seed_hash = ?,
                 nonce = 0,
                 rotated_at = CURRENT_TIMESTAMP
             WHERE username = ?`,
            [newServerSeed, hashServerSeed(newServerSeed), username]
        );
        const rotatedProfile = await getOrCreateFairProfile(connection, username, { forUpdate: true });
        await connection.commit();

        return res.json({
            success: true,
            fairness: {
                ...buildFairnessPayload(rotatedProfile, Number(rotatedProfile.nonce), { scope: 'server' }),
                previousServerSeed: profile.server_seed,
                previousServerSeedHash: profile.server_seed_hash,
                supportedGames: ['cases', ...SERVER_PLAY_GAME_TYPES]
            }
        });
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        console.error('Fairness rotate error:', error);
        return res.status(500).json({ success: false, message: 'Failed to rotate server seed' });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

router.post('/bet', requireAuth, async (req, res) => {
    const username = req.session.username;
    const amount = toMoney(req.body.amount);
    const multiplier = toMoney(req.body.multiplier);
    const gameType = sanitizeGameType(req.body.gameType);
    const requestId = sanitizeRequestId(req.body.requestId);

    if (!claimServerActionCooldown(username, `bet:${gameType}`)) {
        return res.status(429).json({ success: false, message: 'Slow down before placing another bet' });
    }

    if (!amount || amount <= 0 || !multiplier || multiplier < 1.01 || multiplier > 40) {
        return res.status(400).json({ success: false, message: 'Invalid bet parameters' });
    }

    let connection;

    try {
        connection = await db.getConnection();
        await connection.beginTransaction();
        const claimedReceipt = await claimReceipt(connection, { requestId, username, gameType });
        if (claimedReceipt) {
            await connection.rollback();
            return res.status(claimedReceipt.status).json(claimedReceipt.payload || { success: false, message: claimedReceipt.message });
        }

        const [playerRows] = await connection.query(
            'SELECT balance, wallet_balance, xp, level FROM players WHERE username = ? FOR UPDATE',
            [username]
        );

        if (playerRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'Player not found' });
        }

        const profile = await getOrCreateFairProfile(connection, username, { forUpdate: true });
        const nonceUsed = Number(profile.nonce || 0);
        const fairRoll = rollFloat({
            serverSeed: profile.server_seed,
            clientSeed: profile.client_seed,
            nonce: nonceUsed
        });
        const winChance = Math.min(0.99, GENERIC_BET_EDGE / multiplier);
        const won = fairRoll < winChance;
        const validation = buildSettlementValidation({
            amount,
            payout: won ? toMoney(amount * multiplier) : 0,
            gameType
        });

        if (validation.status) {
            await connection.rollback();
            return res.status(validation.status).json({ success: false, message: validation.message });
        }

        await connection.query('UPDATE provably_fair_profiles SET nonce = nonce + 1 WHERE username = ?', [username]);
        profile.nonce = nonceUsed + 1;

        const result = await settleBalanceChange(connection, playerRows[0], {
            username,
            requestId,
            gameType,
            amount: validation.amount,
            payout: validation.payout,
            multiplier: validation.multiplier,
            won,
            meta: {
                fairness: buildFairnessPayload(profile, nonceUsed, { roll: fairRoll }),
                winChance
            }
        });

        if (result.status !== 200) {
            await connection.rollback();
            return res.status(result.status).json({ success: false, message: result.message });
        }

        await connection.commit();
        broadcastBet({ username, ...result.payload });
        return res.json({
            ...result.payload,
            fairness: buildFairnessPayload(profile, nonceUsed, { roll: fairRoll }),
            winChance
        });
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        console.error('Bet error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

router.post('/play', requireAuth, async (req, res) => {
    const username = req.session.username;
    const amount = toMoney(req.body.amount);
    const gameType = sanitizeGameType(req.body.gameType);
    const requestId = sanitizeRequestId(req.body.requestId);

    if (!claimServerActionCooldown(username, `play:${gameType}`)) {
        return res.status(429).json({ success: false, message: 'Slow down before starting another round' });
    }

    if (!SERVER_PLAY_GAME_TYPES.has(gameType)) {
        return res.status(400).json({ success: false, message: 'This table must be settled on the server' });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid bet amount' });
    }

    let connection;

    try {
        connection = await db.getConnection();
        await connection.beginTransaction();
        const claimedReceipt = await claimReceipt(connection, { requestId, username, gameType });
        if (claimedReceipt) {
            await connection.rollback();
            return res.status(claimedReceipt.status).json(claimedReceipt.payload || { success: false, message: claimedReceipt.message });
        }

        const [playerRows] = await connection.query(
            'SELECT balance, wallet_balance, xp, level FROM players WHERE username = ? FOR UPDATE',
            [username]
        );

        if (playerRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'Player not found' });
        }

        const profile = await getOrCreateFairProfile(connection, username, { forUpdate: true });
        const nonceUsed = Number(profile.nonce || 0);
        const resolved = resolveServerGame({ gameType, amount, body: req.body, profile, nonceUsed });

        if (resolved.status) {
            await connection.rollback();
            return res.status(resolved.status).json({ success: false, message: resolved.message });
        }

        const validation = buildSettlementValidation({
            amount: resolved.amount,
            payout: resolved.payout,
            gameType
        });

        if (validation.status) {
            await connection.rollback();
            return res.status(validation.status).json({ success: false, message: validation.message });
        }

        await connection.query('UPDATE provably_fair_profiles SET nonce = nonce + 1 WHERE username = ?', [username]);
        profile.nonce = nonceUsed + 1;

        const result = await settleBalanceChange(connection, playerRows[0], {
            username,
            requestId,
            gameType,
            amount: validation.amount,
            payout: validation.payout,
            multiplier: validation.multiplier,
            won: resolved.won,
            meta: resolved.meta
        });

        if (result.status !== 200) {
            await connection.rollback();
            return res.status(result.status).json({ success: false, message: result.message });
        }

        await connection.commit();
        broadcastBet({ username, ...result.payload });
        return res.json({ ...result.payload, ...(resolved.meta || {}) });
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        console.error('Server play error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

router.post('/cases/open', requireAuth, async (req, res) => {
    const username = req.session.username;
    const requestId = sanitizeRequestId(req.body.requestId);
    const caseInfo = getCaseById(req.body.caseId);
    const requestedCount = Number(req.body.count || 1);
    const openCount = [1, 3, 10].includes(requestedCount) ? requestedCount : 1;

    if (!claimServerActionCooldown(username, `case:${caseInfo?.id || req.body.caseId || 'unknown'}`, openCount > 1 ? 1400 : 900)) {
        return res.status(429).json({ success: false, message: 'Finish the current case opening first' });
    }

    if (!caseInfo) {
        return res.status(404).json({ success: false, message: 'Case not found' });
    }

    let connection;

    try {
        connection = await db.getConnection();
        await connection.beginTransaction();
        const claimedReceipt = await claimReceipt(connection, { requestId, username, gameType: 'cases' });
        if (claimedReceipt) {
            await connection.rollback();
            return res.status(claimedReceipt.status).json(claimedReceipt.payload || { success: false, message: claimedReceipt.message });
        }

        const [playerRows] = await connection.query(
            'SELECT balance, wallet_balance, xp, level FROM players WHERE username = ? FOR UPDATE',
            [username]
        );

        if (playerRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'Player not found' });
        }

        const profile = await getOrCreateFairProfile(connection, username, { forUpdate: true });
        const nonceUsed = Number(profile.nonce || 0);
        const openings = Array.from({ length: openCount }, (_, index) => {
            const roll = rollFloat({
                serverSeed: profile.server_seed,
                clientSeed: profile.client_seed,
                nonce: nonceUsed + index
            });
            const winningItem = pickCaseItem(caseInfo, roll);
            return { roll, winningItem };
        });
        const winningItem = openings[openings.length - 1].winningItem;
        const totalPayout = toMoney(openings.reduce((total, opening) => (
            total + Number(opening.winningItem.value || 0)
        ), 0));
        const totalCost = toMoney(caseInfo.price * openCount);
        const validation = buildSettlementValidation({
            amount: totalCost,
            payout: totalPayout,
            gameType: 'cases'
        });

        if (validation.status) {
            await connection.rollback();
            return res.status(validation.status).json({ success: false, message: validation.message });
        }

        await connection.query('UPDATE provably_fair_profiles SET nonce = nonce + ? WHERE username = ?', [openCount, username]);
        profile.nonce = nonceUsed + openCount;

        const result = await settleBalanceChange(connection, playerRows[0], {
            username,
            requestId,
            gameType: 'cases',
            amount: validation.amount,
            payout: validation.payout,
            multiplier: validation.multiplier,
            won: totalPayout >= totalCost,
            meta: {
                caseInfo,
                winningItem,
                winningItems: openings.map((opening) => opening.winningItem),
                openCount,
                fairness: buildFairnessPayload(profile, nonceUsed, {
                    rolls: openings.map((opening) => opening.roll),
                    nonceCount: openCount
                })
            }
        });

        if (result.status !== 200) {
            await connection.rollback();
            return res.status(result.status).json({ success: false, message: result.message });
        }

        await connection.commit();
        broadcastBet({ username, ...result.payload });
        return res.json({
            ...result.payload,
            caseInfo,
            winningItem,
            winningItems: openings.map((opening) => opening.winningItem),
            openCount,
            fairness: buildFairnessPayload(profile, nonceUsed, {
                rolls: openings.map((opening) => opening.roll),
                nonceCount: openCount
            })
        });
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        console.error('Case open error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

router.post('/settle', requireAuth, async (req, res) => {
    const username = req.session.username;
    const gameType = sanitizeGameType(req.body.gameType);
    const requestId = sanitizeRequestId(req.body.requestId);

    if (!claimServerActionCooldown(username, `settle:${gameType}`)) {
        return res.status(429).json({ success: false, message: 'Slow down before settling another round' });
    }

    if (!INTERACTIVE_SETTLE_GAME_TYPES.has(gameType)) {
        return res.status(400).json({ success: false, message: 'This table now resolves directly on the server' });
    }

    const validation = buildSettlementValidation({
        amount: req.body.amount,
        payout: req.body.payout,
        gameType
    });

    if (validation.status) {
        return res.status(validation.status).json({ success: false, message: validation.message });
    }

    let connection;

    try {
        connection = await db.getConnection();
        await connection.beginTransaction();
        const claimedReceipt = await claimReceipt(connection, { requestId, username, gameType });
        if (claimedReceipt) {
            await connection.rollback();
            return res.status(claimedReceipt.status).json(claimedReceipt.payload || { success: false, message: claimedReceipt.message });
        }

        const [playerRows] = await connection.query(
            'SELECT balance, wallet_balance, xp, level FROM players WHERE username = ? FOR UPDATE',
            [username]
        );

        if (playerRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'Player not found' });
        }

        const result = await settleBalanceChange(connection, playerRows[0], {
            username,
            requestId,
            gameType,
            amount: validation.amount,
            payout: validation.payout,
            multiplier: validation.multiplier,
            won: validation.won
        });

        if (result.status !== 200) {
            await connection.rollback();
            return res.status(result.status).json({ success: false, message: result.message });
        }

        await connection.commit();
        broadcastBet({ username, ...result.payload });
        return res.json(result.payload);
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        console.error('Settlement error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

router.get('/recent-bets', async (req, res) => {
    const scope = String(req.query.scope || 'latest').toLowerCase();
    const expanded = scope === 'hour';
    const limit = expanded
        ? Math.max(5, Math.min(200, parseInt(req.query.limit, 10) || 100))
        : 5;
    const whereClause = expanded ? 'WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)' : '';

    try {
        let bets;

        try {
            [bets] = await db.query(
                `SELECT username, game_type, bet_amount, multiplier, won, profit, created_at
                 FROM bets
                 ${whereClause}
                 ORDER BY created_at DESC
                 LIMIT ?`,
                [limit]
            );
        } catch (error) {
            if (error.code !== 'ER_BAD_FIELD_ERROR') {
                throw error;
            }

            [bets] = await db.query(
                `SELECT username, bet_amount, multiplier, won, profit, created_at
                 FROM bets
                 ${whereClause}
                 ORDER BY created_at DESC
                 LIMIT ?`,
                [limit]
            );
        }

        return res.json({
            success: true,
            scope: expanded ? 'hour' : 'latest',
            bets: bets.map((bet) => ({
                username: bet.username,
                gameType: bet.game_type || 'casino',
                amount: Number(bet.bet_amount),
                multiplier: Number(bet.multiplier),
                won: !!bet.won,
                profit: Number(bet.profit),
                timestamp: bet.created_at
            }))
        });
    } catch (error) {
        console.error('Recent bets error:', error);
        return res.json({ success: true, bets: [] });
    }
});

router.setIo = (io) => {
    crashIo = io;
    ensureCrashLoopStarted();
};

global.getCrashStateSnapshot = getCrashStateSnapshot;

module.exports = router;
