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

const GENERIC_BET_EDGE = 0.8;
const DICE_EDGE = 0.78;
const LIMBO_EDGE = 0.68;
const CRASH_EDGE = 0.8;
const CRASH_GROWTH_RATE = 0.136;
const LIMBO_MAX_TARGET = 25;
const DEFAULT_PLINKO_ROWS = 8;
const MIN_PLINKO_ROWS = 8;
const MAX_PLINKO_ROWS = 16;
const MIN_GAME_BET = 1e6;
const MAX_GAME_BET = 5e15;
const CRASH_INSTANT_BUST_CHANCE = 0.065;
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
const COINFLIP_PAYOUT = 2;
const DEAL_NO_DEAL_CASE_MULTIPLIERS = [0.05, 0.09, 0.14, 0.2, 0.28, 0.38, 0.5, 0.62, 0.75, 0.85, 0.94, 1, 2.5, 8, 20, 50];
const DEAL_NO_DEAL_REVEAL_COUNT = 6;
const DEAL_NO_DEAL_OFFER_FACTOR = 0.74;
const DEAL_NO_DEAL_SESSION_TTL_MS = 30 * 60 * 1000;
const PLINKO_RISK_CONFIG = {
    low: { label: 'Low', targetEv: 0.78, centerFloor: 0.46, edgeBase: 2.7, edgeGrowth: 0.14, curve: 1.42 },
    medium: { label: 'Medium', targetEv: 0.68, centerFloor: 0.1, edgeBase: 4.8, edgeGrowth: 0.26, curve: 1.18 },
    high: { label: 'High', targetEv: 0.56, centerFloor: 0.02, edgeBase: 11.8, edgeGrowth: 0.28, curve: 0.98 }
};
const WHEEL_SEGMENT_MAP = {
    low: [0.2, 0.35, 0.45, 0.62, 0.78, 0.92, 1.06, 1.18, 1.4, 1.18, 0.92, 0.62],
    medium: [0.03, 0.08, 0.12, 0.18, 0.28, 0.42, 0.6, 0.82, 1.1, 1.45, 2.4, 1.45, 0.82, 0.42],
    high: [0.01, 0.01, 0.02, 0.02, 0.03, 0.04, 0.06, 0.08, 0.1, 0.14, 0.18, 0.26, 0.36, 0.58, 1.4, 7.2]
};
const JACKPOT_MAX_PLAYERS = 10;
const JACKPOT_ROUND_MS = 30000;
const SPORTSBOOK_EDGE = 0.84;
const SPORTSBOOK_FIXTURES = [
    {
        id: 'bot-hoops',
        sport: 'Basketball',
        league: 'Bot Arena',
        home: 'You',
        away: 'Pulse Bot',
        scoreMode: 'points',
        suffix: '',
        totalLine: 201.5,
        markets: [
            { id: 'home', label: 'You', odds: 1.94, kind: 'home' },
            { id: 'away', label: 'Pulse Bot', odds: 1.94, kind: 'away' },
            { id: 'over', label: 'Over 201.5', odds: 1.9, kind: 'over', line: 201.5 }
        ]
    },
    {
        id: 'goal-bot',
        sport: 'Soccer',
        league: 'Bot Cup',
        home: 'You',
        away: 'Keeper Bot',
        scoreMode: 'goals',
        suffix: '',
        totalLine: 2.5,
        markets: [
            { id: 'home', label: 'You', odds: 2.02, kind: 'home' },
            { id: 'away', label: 'Keeper Bot', odds: 1.86, kind: 'away' },
            { id: 'over', label: 'Over 2.5', odds: 2.08, kind: 'over', line: 2.5 }
        ]
    },
    {
        id: 'court-royal',
        sport: 'Tennis',
        league: 'Royal Indoor',
        home: 'Mika Stone',
        away: 'Rian Vale',
        scoreMode: 'sets',
        suffix: 'sets',
        totalLine: 2.5,
        markets: [
            { id: 'home', label: 'Mika Stone', odds: 1.72, kind: 'home' },
            { id: 'away', label: 'Rian Vale', odds: 2.34, kind: 'away' },
            { id: 'over', label: 'Over 2.5 sets', odds: 2.48, kind: 'over', line: 2.5 }
        ]
    },
    {
        id: 'rift-rush',
        sport: 'Esports',
        league: 'Rift Rush Series',
        home: 'Ghost Signal',
        away: 'Nova Pulse',
        scoreMode: 'maps',
        suffix: 'maps',
        totalLine: 2.5,
        markets: [
            { id: 'home', label: 'Ghost Signal', odds: 1.9, kind: 'home' },
            { id: 'away', label: 'Nova Pulse', odds: 1.98, kind: 'away' },
            { id: 'over', label: 'Over 2.5 maps', odds: 2.18, kind: 'over', line: 2.5 }
        ]
    }
];
const KNOWN_GAME_TYPES = new Set([
    'casino',
    'crash',
    'sports',
    'dealnodeal',
    'mines',
    'towers',
    'plinko',
    'dice',
    'roulette',
    'blackjack',
    'coinflip',
    'wheel',
    'limbo',
    'slots',
    'cases',
    'jackpot'
]);
const SERVER_PLAY_GAME_TYPES = new Set(['sports', 'dice', 'plinko', 'roulette', 'coinflip', 'wheel', 'limbo']);
const INTERACTIVE_SETTLE_GAME_TYPES = new Set(['mines', 'towers', 'blackjack', 'slots']);
const MAX_MULTIPLIER_BY_GAME = {
    casino: 40,
    crash: 80,
    sports: 4,
    dealnodeal: 50,
    mines: 6.5,
    towers: 3.6,
    plinko: 30,
    dice: 48,
    roulette: 10,
    blackjack: 2.5,
    coinflip: COINFLIP_PAYOUT,
    wheel: 24,
    limbo: LIMBO_MAX_TARGET,
    slots: 24,
    cases: 12,
    jackpot: 100
};
let crashIo = null;
let crashRoundCounter = 0;
const serverActionCooldowns = new Map();
const dealNoDealSessions = new Map();
let jackpotRoundCounter = 0;
const jackpotRoundState = {
    roundId: Date.now(),
    status: 'open',
    entries: [],
    pot: 0,
    closesAt: null,
    winner: null,
    timer: null,
    resolving: false,
    history: []
};
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

function getFairnessSupportedGames() {
    return ['cases', 'dealnodeal', ...SERVER_PLAY_GAME_TYPES];
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

function formatBetLimit(value) {
    const amount = Number(value || 0);
    if (amount >= 1e15) return `${toMoney(amount / 1e15)}Q`;
    if (amount >= 1e12) return `${toMoney(amount / 1e12)}T`;
    if (amount >= 1e9) return `${toMoney(amount / 1e9)}B`;
    if (amount >= 1e6) return `${toMoney(amount / 1e6)}M`;
    if (amount >= 1e3) return `${toMoney(amount / 1e3)}K`;
    return `${toMoney(amount)}`;
}

function validateGameBetAmount(amount) {
    const safeAmount = toMoney(amount);
    if (!Number.isFinite(safeAmount) || safeAmount < MIN_GAME_BET || safeAmount > MAX_GAME_BET) {
        return buildError(400, `Bet amount must stay between $${formatBetLimit(MIN_GAME_BET)} and $${formatBetLimit(MAX_GAME_BET)}`);
    }

    return null;
}

function buildSettlementValidation({ amount, payout, gameType }) {
    const safeAmount = toMoney(amount);
    const safePayout = toMoney(Math.max(0, payout));
    const safeGameType = sanitizeGameType(gameType);

    if (!Number.isFinite(safeAmount) || safeAmount <= 0) {
        return buildError(400, 'Invalid bet amount');
    }

    const boundError = validateGameBetAmount(safeAmount);
    if (boundError) {
        return boundError;
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

function getSportsbookFixture(fixtureId) {
    return SPORTSBOOK_FIXTURES.find((fixture) => fixture.id === String(fixtureId || '').toLowerCase()) || null;
}

function getSportsbookMarket(fixture, marketId) {
    if (!fixture) {
        return null;
    }

    return fixture.markets.find((market) => market.id === String(marketId || '').toLowerCase()) || null;
}

function seededRoll(profile, nonceUsed, cursor = 0) {
    return rollFloat({
        serverSeed: profile.server_seed,
        clientSeed: profile.client_seed,
        nonce: nonceUsed,
        cursor
    });
}

function seededInt(profile, nonceUsed, cursor, minInclusive, maxInclusive) {
    return minInclusive + rollInt({
        serverSeed: profile.server_seed,
        clientSeed: profile.client_seed,
        nonce: nonceUsed,
        cursor,
        maxExclusive: (maxInclusive - minInclusive) + 1
    });
}

function buildSportsbookSeriesScore({ fixture, market, won, profile, nonceUsed }) {
    const preferHome = market.kind === 'home';
    const actualHomeWins = market.kind === 'over'
        ? seededRoll(profile, nonceUsed, 6) >= 0.5
        : (preferHome ? won : !won);
    const actualOver = market.kind === 'over' ? won : seededRoll(profile, nonceUsed, 7) >= 0.5;

    let homeScore;
    let awayScore;

    if (actualOver) {
        homeScore = actualHomeWins ? 2 : 1;
        awayScore = actualHomeWins ? 1 : 2;
    } else {
        homeScore = actualHomeWins ? 2 : 0;
        awayScore = actualHomeWins ? 0 : 2;
    }

    const scoreline = `${fixture.home} ${homeScore}-${awayScore} ${fixture.away}`;
    const suffix = fixture.suffix ? ` ${fixture.suffix}` : '';
    const winner = homeScore > awayScore ? fixture.home : fixture.away;

    return {
        scoreline,
        headline: `${winner} closed the match ${homeScore}-${awayScore}${suffix}.`,
        detail: market.kind === 'over'
            ? `${market.label} ${won ? 'cleared' : 'missed'} with a ${homeScore + awayScore}${suffix} finish.`
            : `${market.label} ${won ? 'held the ticket' : 'fell short'} over ${homeScore + awayScore}${suffix}.`
    };
}

function buildSportsbookPointsScore({ fixture, market, won, profile, nonceUsed }) {
    const isFootball = fixture.scoreMode === 'goals';
    let homeScore = seededInt(profile, nonceUsed, 2, isFootball ? 0 : 92, isFootball ? 3 : 121);
    let awayScore = seededInt(profile, nonceUsed, 3, isFootball ? 0 : 88, isFootball ? 4 : 118);

    if (market.kind === 'home' || market.kind === 'away') {
        const actualHomeWins = market.kind === 'home' ? won : !won;
        if (actualHomeWins && homeScore <= awayScore) {
            homeScore = awayScore + seededInt(profile, nonceUsed, 4, 1, isFootball ? 2 : 12);
        }
        if (!actualHomeWins && awayScore <= homeScore) {
            awayScore = homeScore + seededInt(profile, nonceUsed, 5, 1, isFootball ? 2 : 12);
        }
    } else {
        const totalLine = Number(market.line || fixture.totalLine || 0);
        const actualOver = won;
        const minimumTotal = actualOver ? Math.ceil(totalLine + 1) : 0;
        const maximumTotal = actualOver
            ? (isFootball ? 6 : 244)
            : Math.max(0, Math.floor(totalLine));
        const total = Math.max(minimumTotal, seededInt(profile, nonceUsed, 4, minimumTotal, Math.max(minimumTotal, maximumTotal)));
        const homeShareFloor = isFootball ? 0 : 84;
        const homeShareCeiling = total - (isFootball ? 0 : 80);
        homeScore = seededInt(profile, nonceUsed, 5, Math.max(0, homeShareFloor), Math.max(Math.max(0, homeShareFloor), homeShareCeiling));
        awayScore = Math.max(0, total - homeScore);
    }

    const scoreline = `${fixture.home} ${homeScore} - ${awayScore} ${fixture.away}`;
    const winner = homeScore === awayScore ? 'The board' : (homeScore > awayScore ? fixture.home : fixture.away);

    return {
        scoreline,
        headline: `${winner} ${homeScore === awayScore ? 'finished level' : 'closed it'} at ${homeScore}-${awayScore}.`,
        detail: market.kind === 'over'
            ? `${market.label} ${won ? 'cashed' : 'stayed under'} on a ${homeScore + awayScore} total.`
            : `${market.label} ${won ? 'got home clean' : 'missed the ticket'} on the final whistle.`
    };
}

function buildSportsbookPresentation({ fixture, market, won, profile, nonceUsed }) {
    if (fixture.scoreMode === 'sets' || fixture.scoreMode === 'maps') {
        return buildSportsbookSeriesScore({ fixture, market, won, profile, nonceUsed });
    }

    return buildSportsbookPointsScore({ fixture, market, won, profile, nonceUsed });
}

function buildDealNoDealBoard(amount, profile, nonceUsed) {
    const board = DEAL_NO_DEAL_CASE_MULTIPLIERS.map((multiplier) => toMoney(amount * multiplier));

    for (let index = board.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(seededRoll(profile, nonceUsed, 20 + index) * (index + 1));
        [board[index], board[swapIndex]] = [board[swapIndex], board[index]];
    }

    return board.map((value, index) => ({
        caseNumber: index + 1,
        value
    }));
}

function buildDealNoDealOpenedIndices(chosenCaseIndex, profile, nonceUsed) {
    const available = Array.from({ length: DEAL_NO_DEAL_CASE_MULTIPLIERS.length }, (_, index) => index)
        .filter((index) => index !== chosenCaseIndex);
    const opened = [];

    for (let step = 0; step < DEAL_NO_DEAL_REVEAL_COUNT && available.length > 0; step += 1) {
        const pickIndex = Math.floor(seededRoll(profile, nonceUsed, 60 + step) * available.length);
        opened.push(available.splice(pickIndex, 1)[0]);
    }

    return opened.sort((left, right) => left - right);
}

function calculateDealNoDealOffer(board, chosenCaseIndex, openedIndices) {
    const openedSet = new Set(openedIndices);
    const remaining = board.filter((entry, index) => index === chosenCaseIndex || !openedSet.has(index));
    const averageRemaining = remaining.reduce((total, entry) => total + Number(entry.value || 0), 0) / Math.max(1, remaining.length);
    return toMoney(averageRemaining * DEAL_NO_DEAL_OFFER_FACTOR);
}

function getDealNoDealSession(username) {
    if (!username) {
        return null;
    }

    const session = dealNoDealSessions.get(username);
    if (!session) {
        return null;
    }

    if ((Date.now() - Number(session.startedAt || 0)) > DEAL_NO_DEAL_SESSION_TTL_MS) {
        dealNoDealSessions.delete(username);
        return null;
    }

    return session;
}

function clearDealNoDealSession(username) {
    if (!username) {
        return;
    }

    dealNoDealSessions.delete(username);
}

function serializeDealNoDealState(session, options = {}) {
    if (!session) {
        return { active: false };
    }

    const revealAll = !!options.revealAll;
    const openedSet = new Set(session.openedIndices || []);

    return {
        active: true,
        amount: session.amount,
        bankerOffer: session.bankerOffer,
        chosenCaseIndex: session.chosenCaseIndex,
        startedAt: session.startedAt,
        resolved: !!session.resolved,
        resolution: session.resolution || null,
        cases: session.board.map((entry, index) => {
            const shouldReveal = revealAll || session.resolved || openedSet.has(index) || (session.resolution === 'no-deal' && index === session.chosenCaseIndex);
            return {
                index,
                label: entry.caseNumber,
                value: shouldReveal ? entry.value : null,
                opened: revealAll || session.resolved ? true : openedSet.has(index),
                isChosen: index === session.chosenCaseIndex
            };
        })
    };
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
        newBalance: payload.newBalance,
        walletBalance: payload.newBalance,
        level: payload.level,
        timestamp: Date.now()
    });
}

function buildJackpotEntries(entries = jackpotRoundState.entries, pot = jackpotRoundState.pot) {
    const safePot = Math.max(0, Number(pot || 0));
    return entries.map((entry) => ({
        username: entry.username,
        amount: toMoney(entry.amount),
        chance: safePot > 0 ? toMoney((entry.amount / safePot) * 100) : 0,
        joinedAt: entry.joinedAt
    }));
}

function getJackpotStateSnapshot() {
    return {
        roundId: jackpotRoundState.roundId,
        status: jackpotRoundState.status,
        maxPlayers: JACKPOT_MAX_PLAYERS,
        playerCount: jackpotRoundState.entries.length,
        pot: toMoney(jackpotRoundState.pot),
        closesAt: jackpotRoundState.closesAt,
        winner: jackpotRoundState.winner,
        entries: buildJackpotEntries(),
        history: jackpotRoundState.history.slice(0, 8)
    };
}

function emitJackpotState() {
    if (global.broadcastJackpotState) {
        global.broadcastJackpotState(getJackpotStateSnapshot());
    }
}

function resetJackpotRound() {
    if (jackpotRoundState.timer) {
        clearTimeout(jackpotRoundState.timer);
    }

    jackpotRoundCounter += 1;
    jackpotRoundState.roundId = Date.now() + jackpotRoundCounter;
    jackpotRoundState.status = 'open';
    jackpotRoundState.entries = [];
    jackpotRoundState.pot = 0;
    jackpotRoundState.closesAt = null;
    jackpotRoundState.winner = null;
    jackpotRoundState.timer = null;
    jackpotRoundState.resolving = false;
    emitJackpotState();
}

function scheduleJackpotDraw(delayMs = JACKPOT_ROUND_MS) {
    if (jackpotRoundState.timer || jackpotRoundState.resolving || jackpotRoundState.entries.length < 2) {
        return;
    }

    jackpotRoundState.closesAt = Date.now() + delayMs;
    jackpotRoundState.timer = setTimeout(() => {
        resolveJackpotRound().catch((error) => {
            console.error('Jackpot draw failed:', error);
            jackpotRoundState.resolving = false;
            jackpotRoundState.status = 'open';
            jackpotRoundState.timer = null;
            jackpotRoundState.closesAt = null;
            emitJackpotState();
        });
    }, delayMs);
    emitJackpotState();
}

function pickJackpotWinner(entries, pot) {
    const roll = Math.random() * pot;
    let cursor = 0;

    for (const entry of entries) {
        cursor += entry.amount;
        if (roll <= cursor) {
            return { winner: entry, roll };
        }
    }

    return { winner: entries[entries.length - 1], roll };
}

async function resolveJackpotRound() {
    if (jackpotRoundState.resolving || jackpotRoundState.entries.length < 2) {
        return;
    }

    jackpotRoundState.resolving = true;
    jackpotRoundState.status = 'drawing';
    if (jackpotRoundState.timer) {
        clearTimeout(jackpotRoundState.timer);
        jackpotRoundState.timer = null;
    }
    emitJackpotState();

    const entries = jackpotRoundState.entries.map((entry) => ({ ...entry }));
    const pot = toMoney(entries.reduce((total, entry) => total + Number(entry.amount || 0), 0));
    const { winner, roll } = pickJackpotWinner(entries, pot);
    const usernames = [...new Set(entries.map((entry) => entry.username))];
    let connection;
    const walletUpdates = [];

    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const [players] = await connection.query(
            'SELECT username, balance, wallet_balance, xp, level FROM players WHERE username IN (?) FOR UPDATE',
            [usernames]
        );
        const playersByName = new Map(players.map((player) => [player.username, player]));

        for (const entry of entries) {
            const player = playersByName.get(entry.username);
            if (!player) {
                continue;
            }

            const won = entry.username === winner.username;
            const payout = won ? pot : 0;
            const profit = toMoney(payout - entry.amount);
            const nextWallet = toMoney(Number(player.wallet_balance || 0) + payout);
            const xpGained = getWagerXpGain(entry.amount, won);
            const updatedXp = Number(player.xp || 0) + xpGained;
            const computedLevel = getLevelFromXp(updatedXp);
            const multiplier = won && entry.amount > 0 ? toMoney(pot / entry.amount) : 0;

            await connection.query(
                `UPDATE players
                 SET wallet_balance = ?, total_wagered = total_wagered + ?, total_won = total_won + ?, xp = ?, level = ?
                 WHERE username = ?`,
                [nextWallet, entry.amount, payout, updatedXp, computedLevel, entry.username]
            );

            await insertBetRecord(connection, {
                username: entry.username,
                gameType: 'jackpot',
                amount: entry.amount,
                multiplier,
                payout,
                profit,
                won
            });

            walletUpdates.push({
                username: entry.username,
                walletBalance: nextWallet,
                vaultBalance: Number(player.balance || 0),
                level: computedLevel,
                xpGained,
                bet: {
                    username: entry.username,
                    gameType: 'jackpot',
                    amount: entry.amount,
                    multiplier,
                    payout,
                    profit,
                    won,
                    newBalance: nextWallet,
                    walletBalance: nextWallet,
                    level: computedLevel
                }
            });
        }

        await connection.commit();

        walletUpdates.forEach((update) => {
            broadcastBet(update.bet);
            if (global.emitToWebsiteUser) {
                global.emitToWebsiteUser(update.username, 'wallet:updated', {
                    username: update.username,
                    walletBalance: update.walletBalance,
                    vaultBalance: update.vaultBalance,
                    source: 'jackpot',
                    syncedAt: Date.now()
                });
            }
        });

        jackpotRoundState.status = 'complete';
        jackpotRoundState.winner = {
            username: winner.username,
            amount: toMoney(winner.amount),
            chance: pot > 0 ? toMoney((winner.amount / pot) * 100) : 0,
            payout: pot
        };
        jackpotRoundState.history.unshift({
            roundId: jackpotRoundState.roundId,
            winner: jackpotRoundState.winner,
            pot,
            roll: toMoney(roll),
            entries: buildJackpotEntries(entries, pot),
            completedAt: Date.now()
        });
        jackpotRoundState.history = jackpotRoundState.history.slice(0, 8);
        emitJackpotState();

        setTimeout(resetJackpotRound, 6500);
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        throw error;
    } finally {
        if (connection) {
            connection.release();
        }
    }
}

function calculateCrashMultiplier(startedAt) {
    const elapsedSeconds = Math.max(0, (Date.now() - startedAt) / 1000);
    const multiplier = Math.exp(elapsedSeconds * CRASH_GROWTH_RATE);
    return toMoney(Math.min(80, Math.max(1, multiplier)));
}

function generateCrashPoint() {
    const random = Math.random();
    if (random < CRASH_INSTANT_BUST_CHANCE) {
        return 1;
    }

    const adjustedRandom = (random - CRASH_INSTANT_BUST_CHANCE) / (1 - CRASH_INSTANT_BUST_CHANCE);
    const point = CRASH_EDGE / Math.max(0.0001, 1 - adjustedRandom);
    return toMoney(Math.max(1, Math.min(80, point)));
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

    crashIo.sockets.sockets.forEach((socket) => {
        const sessionData = socket.request?.session || {};
        const username = sessionData.loggedIn ? sanitizeUsernameForMeta(sessionData.username) : null;
        socket.emit('crash:state', getCrashStateSnapshot(username));
    });
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
    if (gameType === 'sports') {
        const fixture = getSportsbookFixture(body.fixtureId);
        const market = getSportsbookMarket(fixture, body.marketId);

        if (!fixture || !market) {
            return buildError(400, 'That market is no longer available');
        }

        const roll = seededRoll(profile, nonceUsed, 0);
        const winChance = Math.min(0.92, SPORTSBOOK_EDGE / Number(market.odds || 1));
        const won = roll < winChance;
        const presentation = buildSportsbookPresentation({ fixture, market, won, profile, nonceUsed });

        return {
            amount,
            payout: won ? toMoney(amount * market.odds) : 0,
            multiplier: won ? Number(market.odds) : 0,
            won,
            meta: {
                sportsbook: {
                    fixtureId: fixture.id,
                    sport: fixture.sport,
                    league: fixture.league,
                    matchup: `${fixture.home} vs ${fixture.away}`,
                    selection: market.label,
                    odds: Number(market.odds),
                    scoreline: presentation.scoreline,
                    headline: presentation.headline,
                    detail: presentation.detail
                },
                fairness: buildFairnessPayload(profile, nonceUsed, { roll }),
                winChance
            }
        };
    }

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

    return buildError(400, 'Unsupported game');
}

async function finalizeDealNoDealSession(username, resolution) {
    const session = getDealNoDealSession(username);
    if (!session) {
        return buildError(404, 'No active Deal or No Deal board found');
    }

    const safeResolution = resolution === 'deal' ? 'deal' : 'no-deal';
    const chosenCase = session.board[session.chosenCaseIndex];
    const payout = safeResolution === 'deal'
        ? toMoney(session.bankerOffer)
        : toMoney(chosenCase?.value || 0);
    const multiplier = session.amount > 0 ? toMoney(payout / session.amount) : 0;
    const won = payout >= session.amount;
    let connection;

    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const claimedReceipt = await claimReceipt(connection, {
            requestId: session.requestId,
            username,
            gameType: 'dealnodeal'
        });
        if (claimedReceipt) {
            await connection.rollback();
            clearDealNoDealSession(username);
            return claimedReceipt;
        }

        const [playerRows] = await connection.query(
            'SELECT balance, wallet_balance, xp, level FROM players WHERE username = ? FOR UPDATE',
            [username]
        );

        if (playerRows.length === 0) {
            await connection.rollback();
            return buildError(404, 'Player not found');
        }

        const result = await settleReservedBalanceChange(connection, playerRows[0], {
            username,
            requestId: session.requestId,
            gameType: 'dealnodeal',
            amount: session.amount,
            payout,
            multiplier,
            won,
            meta: {
                dealNoDeal: {
                    resolution: safeResolution,
                    bankerOffer: session.bankerOffer,
                    chosenCaseNumber: chosenCase?.caseNumber || null,
                    chosenCaseValue: chosenCase?.value || 0,
                    openedCases: session.openedIndices.map((index) => ({
                        caseNumber: session.board[index]?.caseNumber,
                        value: session.board[index]?.value
                    }))
                }
            }
        });

        if (result.status !== 200) {
            await connection.rollback();
            return result;
        }

        await connection.commit();

        const resolvedState = serializeDealNoDealState({
            ...session,
            resolved: true,
            resolution: safeResolution
        }, { revealAll: true });

        clearDealNoDealSession(username);
        broadcastBet({ username, ...result.payload });

        return {
            status: 200,
            payload: {
                ...result.payload,
                dealNoDeal: resolvedState
            }
        };
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        console.error('Deal or No Deal finalize error:', error);
        return buildError(500, 'Could not resolve Deal or No Deal');
    } finally {
        if (connection) {
            connection.release();
        }
    }
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

    const amountValidation = validateGameBetAmount(amount);
    if (amountValidation) {
        return res.status(amountValidation.status).json({ success: false, message: amountValidation.message });
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

router.get('/deal-or-no-deal/state', requireAuth, (req, res) => {
    const username = req.session.username;
    const session = getDealNoDealSession(username);
    return res.json({
        success: true,
        dealNoDeal: serializeDealNoDealState(session)
    });
});

router.post('/deal-or-no-deal/start', requireAuth, async (req, res) => {
    const username = req.session.username;
    const amount = toMoney(req.body.amount);
    const chosenCaseIndex = Number.parseInt(req.body.chosenCaseIndex, 10);

    if (!claimServerActionCooldown(username, 'dealnodeal:start', 1200)) {
        return res.status(429).json({ success: false, message: 'Slow down before opening another Deal or No Deal board' });
    }

    if (getDealNoDealSession(username)) {
        return res.status(409).json({ success: false, message: 'Finish your active Deal or No Deal board first' });
    }

    if (!Number.isInteger(chosenCaseIndex) || chosenCaseIndex < 0 || chosenCaseIndex >= DEAL_NO_DEAL_CASE_MULTIPLIERS.length) {
        return res.status(400).json({ success: false, message: 'Choose one of the 16 cases first' });
    }

    const amountValidation = validateGameBetAmount(amount);
    if (amountValidation) {
        return res.status(amountValidation.status).json({ success: false, message: amountValidation.message });
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

        const profile = await getOrCreateFairProfile(connection, username, { forUpdate: true });
        const nonceUsed = Number(profile.nonce || 0);
        const board = buildDealNoDealBoard(amount, profile, nonceUsed);
        const openedIndices = buildDealNoDealOpenedIndices(chosenCaseIndex, profile, nonceUsed);
        const bankerOffer = calculateDealNoDealOffer(board, chosenCaseIndex, openedIndices);
        const startedAt = Date.now();
        const newBalance = toMoney(currentBalance - amount);
        const requestId = sanitizeRequestId(`dealnodeal:${username}:${startedAt}`);

        await connection.query('UPDATE players SET wallet_balance = ? WHERE username = ?', [newBalance, username]);
        await connection.query('UPDATE provably_fair_profiles SET nonce = nonce + 1 WHERE username = ?', [username]);
        profile.nonce = nonceUsed + 1;

        const session = {
            username,
            amount,
            chosenCaseIndex,
            openedIndices,
            bankerOffer,
            board,
            requestId,
            startedAt
        };
        dealNoDealSessions.set(username, session);

        await connection.commit();
        return res.json({
            success: true,
            newBalance,
            dealNoDeal: serializeDealNoDealState(session),
            fairness: buildFairnessPayload(profile, nonceUsed, { stage: 'deal-or-no-deal' })
        });
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        console.error('Deal or No Deal start error:', error);
        return res.status(500).json({ success: false, message: 'Could not start Deal or No Deal' });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

router.post('/deal-or-no-deal/deal', requireAuth, async (req, res) => {
    const username = req.session.username;

    if (!claimServerActionCooldown(username, 'dealnodeal:deal', 900)) {
        return res.status(429).json({ success: false, message: 'Slow down before taking the banker offer' });
    }

    const result = await finalizeDealNoDealSession(username, 'deal');
    if (result.status !== 200) {
        return res.status(result.status).json(result.payload || { success: false, message: result.message });
    }

    return res.json(result.payload);
});

router.post('/deal-or-no-deal/no-deal', requireAuth, async (req, res) => {
    const username = req.session.username;

    if (!claimServerActionCooldown(username, 'dealnodeal:no-deal', 900)) {
        return res.status(429).json({ success: false, message: 'Slow down before revealing the final case' });
    }

    const result = await finalizeDealNoDealSession(username, 'no-deal');
    if (result.status !== 200) {
        return res.status(result.status).json(result.payload || { success: false, message: result.message });
    }

    return res.json(result.payload);
});

router.get('/jackpot/state', (req, res) => {
    res.json({ success: true, jackpot: getJackpotStateSnapshot() });
});

router.post('/jackpot/join', requireAuth, async (req, res) => {
    const username = req.session.username;
    const amount = toMoney(req.body.amount);

    if (!claimServerActionCooldown(username, 'jackpot:join', 1200)) {
        return res.status(429).json({ success: false, message: 'Slow down before joining Jackpot again' });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid jackpot bet amount' });
    }

    const amountValidation = validateGameBetAmount(amount);
    if (amountValidation) {
        return res.status(amountValidation.status).json({ success: false, message: amountValidation.message });
    }

    if (jackpotRoundState.status !== 'open') {
        return res.status(409).json({ success: false, message: 'Jackpot is drawing. Wait for the next pool.' });
    }

    if (jackpotRoundState.entries.length >= JACKPOT_MAX_PLAYERS) {
        return res.status(409).json({ success: false, message: 'Jackpot pool is full.' });
    }

    if (jackpotRoundState.entries.some((entry) => entry.username === username)) {
        return res.status(409).json({ success: false, message: 'You are already in this Jackpot round.' });
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
            return res.status(400).json({ success: false, message: 'Insufficient website wallet balance' });
        }

        const newBalance = toMoney(currentBalance - amount);
        await connection.query(
            'UPDATE players SET wallet_balance = ? WHERE username = ?',
            [newBalance, username]
        );

        await connection.commit();

        jackpotRoundState.entries.push({
            username,
            amount,
            joinedAt: Date.now()
        });
        jackpotRoundState.pot = toMoney(jackpotRoundState.pot + amount);

        if (jackpotRoundState.entries.length >= JACKPOT_MAX_PLAYERS) {
            scheduleJackpotDraw(900);
        } else if (jackpotRoundState.entries.length >= 2) {
            scheduleJackpotDraw();
        } else {
            emitJackpotState();
        }

        return res.json({
            success: true,
            amount,
            newBalance,
            jackpot: getJackpotStateSnapshot()
        });
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        console.error('Jackpot join error:', error);
        return res.status(500).json({ success: false, message: 'Could not join Jackpot' });
    } finally {
        if (connection) {
            connection.release();
        }
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
                fairness: { ...buildFairnessPayload(profile, Number(profile.nonce), { scope: 'server' }), supportedGames: getFairnessSupportedGames() }
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
                fairness: { ...buildFairnessPayload(profile, Number(profile.nonce), { scope: 'server' }), supportedGames: getFairnessSupportedGames() }
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
                supportedGames: getFairnessSupportedGames()
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

    const amountValidation = validateGameBetAmount(amount);
    if (amountValidation) {
        return res.status(amountValidation.status).json({ success: false, message: amountValidation.message });
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
    const playCooldownMs = gameType === 'plinko' ? 35 : GAME_ACTION_SERVER_COOLDOWN_MS;

    if (!claimServerActionCooldown(username, `play:${gameType}`, playCooldownMs)) {
        return res.status(429).json({ success: false, message: 'Slow down before starting another round' });
    }

    if (!SERVER_PLAY_GAME_TYPES.has(gameType)) {
        return res.status(400).json({ success: false, message: 'This table must be settled on the server' });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid bet amount' });
    }

    const amountValidation = validateGameBetAmount(amount);
    if (amountValidation) {
        return res.status(amountValidation.status).json({ success: false, message: amountValidation.message });
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
                `SELECT b.username, b.game_type, b.bet_amount, b.multiplier, b.won, b.profit, b.created_at,
                        p.wallet_balance, p.level
                 FROM bets b
                 LEFT JOIN players p ON p.username = b.username
                 ${expanded ? 'WHERE b.created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)' : ''}
                 ORDER BY b.created_at DESC
                 LIMIT ?`,
                [limit]
            );
        } catch (error) {
            if (error.code !== 'ER_BAD_FIELD_ERROR') {
                throw error;
            }

            [bets] = await db.query(
                `SELECT b.username, b.bet_amount, b.multiplier, b.won, b.profit, b.created_at,
                        p.wallet_balance, p.level
                 FROM bets b
                 LEFT JOIN players p ON p.username = b.username
                 ${expanded ? 'WHERE b.created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)' : ''}
                 ORDER BY b.created_at DESC
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
                walletBalance: Number(bet.wallet_balance || 0),
                level: Number(bet.level || 1),
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
