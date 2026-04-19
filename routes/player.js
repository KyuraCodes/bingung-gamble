const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { getCaseCatalog, pickCaseItem } = require('../config/caseCatalog');
const { getProgressionSnapshot } = require('../config/progression');

const TRANSFER_TYPES = new Set(['deposit', 'withdraw']);
const TRANSFER_SOURCES = new Set(['website', 'minecraft-command']);

// Middleware to check authentication
const requireAuth = (req, res, next) => {
    if (!req.session.loggedIn) {
        return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    next();
};

function toMoney(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
}

function buildPlayerPayload(player = {}, betStats = {}) {
    const walletBalance = Number(player.wallet_balance ?? 0);
    const vaultBalance = Number(player.balance ?? 0);
    const progression = getProgressionSnapshot(player.xp);

    return {
        username: player.username,
        balance: walletBalance,
        walletBalance,
        vaultBalance,
        ...progression,
        totalWagered: Number(player.total_wagered || 0),
        totalWon: Number(player.total_won || 0),
        totalBets: Number(betStats.total_bets || 0),
        wins: Number(betStats.wins || 0),
        biggestWin: Number(betStats.biggest_win || 0),
        biggestLoss: Math.abs(Number(betStats.biggest_loss || 0)),
        totalProfit: Number(betStats.total_profit || 0),
        totalLost: Number(betStats.total_lost || 0)
    };
}

function buildPublicProfilePayload(player = {}, betStats = {}, options = {}) {
    const payload = buildPlayerPayload(player, betStats);
    const totalBets = Number(payload.totalBets || 0);
    const wins = Number(payload.wins || 0);

    return {
        ...payload,
        totalBets,
        wins,
        losses: Math.max(0, totalBets - wins),
        winRate: totalBets > 0 ? Math.round((wins / totalBets) * 100) : 0,
        online: !!options.online
    };
}

function sanitizeTransferType(value) {
    const safeType = String(value || '').trim().toLowerCase();
    return TRANSFER_TYPES.has(safeType) ? safeType : '';
}

function sanitizeTransferSource(value) {
    const safeSource = String(value || '').trim().toLowerCase();
    return TRANSFER_SOURCES.has(safeSource) ? safeSource : 'website';
}

function sanitizeRequestId(value, prefix = 'wallet') {
    const safeValue = String(value || '')
        .trim()
        .replace(/[^a-zA-Z0-9:_-]/g, '')
        .slice(0, 80);

    return safeValue || `${prefix}:${crypto.randomUUID()}`;
}

function getDailyDateKey(date = new Date()) {
    return date.toISOString().slice(0, 10);
}

function getDailyRewardCaseForLevel(level) {
    const catalog = getCaseCatalog();
    if (catalog.length === 0) {
        return null;
    }

    const safeLevel = Math.max(1, Math.min(100, Math.floor(Number(level || 1))));
    const tierIndex = Math.round(((safeLevel - 1) / 99) * (catalog.length - 1));
    return catalog[Math.max(0, Math.min(catalog.length - 1, tierIndex))];
}

function buildDailyRewardPayload(player, claim = null) {
    const progression = getProgressionSnapshot(player?.xp || 0);
    const rewardCase = getDailyRewardCaseForLevel(progression.level);
    const claimedToday = !!claim;

    return {
        level: progression.level,
        maxLevel: progression.maxLevel,
        xp: progression.xp,
        xpToNextLevel: progression.xpToNextLevel,
        levelProgress: progression.levelProgress,
        claimDate: getDailyDateKey(),
        claimedToday,
        nextClaimAt: claimedToday ? `${getDailyDateKey(new Date(Date.now() + 24 * 60 * 60 * 1000))}T00:00:00.000Z` : null,
        rewardCase
    };
}

async function claimWalletTransfer(connection, { requestId, username, transferType, transferSource, amount }) {
    try {
        await connection.query(
            `INSERT INTO wallet_transfers (request_id, username, transfer_type, transfer_source, amount)
             VALUES (?, ?, ?, ?, ?)`,
            [requestId, username, transferType, transferSource, toMoney(amount)]
        );
        return null;
    } catch (error) {
        if (error.code !== 'ER_DUP_ENTRY') {
            throw error;
        }

        const [rows] = await connection.query(
            `SELECT transfer_type, amount, wallet_balance_after, vault_balance_after
             FROM wallet_transfers
             WHERE request_id = ? AND username = ?
             LIMIT 1`,
            [requestId, username]
        );

        if (
            rows.length === 0
            || rows[0].wallet_balance_after === null
            || rows[0].vault_balance_after === null
        ) {
            return {
                status: 409,
                payload: { success: false, message: 'Transfer is already processing.' }
            };
        }

        return {
            status: 200,
            payload: {
                success: true,
                type: rows[0].transfer_type,
                amount: Number(rows[0].amount || 0),
                newBalance: Number(rows[0].wallet_balance_after || 0),
                walletBalance: Number(rows[0].wallet_balance_after || 0),
                vaultBalance: Number(rows[0].vault_balance_after || 0),
                duplicate: true
            }
        };
    }
}

async function finalizeWalletTransfer(connection, {
    requestId,
    username,
    walletBefore,
    walletAfter,
    vaultBefore,
    vaultAfter
}) {
    await connection.query(
        `UPDATE wallet_transfers
         SET wallet_balance_before = ?, wallet_balance_after = ?, vault_balance_before = ?, vault_balance_after = ?
         WHERE request_id = ? AND username = ?`,
        [
            toMoney(walletBefore),
            toMoney(walletAfter),
            toMoney(vaultBefore),
            toMoney(vaultAfter),
            requestId,
            username
        ]
    );
}

async function getPlayerWithBetStats(username) {
    const [players] = await db.query('SELECT * FROM players WHERE username = ?', [username]);
    if (players.length === 0) {
        return null;
    }

    const [betStats] = await db.query(
        `SELECT
            COUNT(*) AS total_bets,
            SUM(CASE WHEN won = TRUE THEN 1 ELSE 0 END) AS wins,
            MAX(profit) AS biggest_win,
            MIN(profit) AS biggest_loss,
            SUM(CASE WHEN profit > 0 THEN profit ELSE 0 END) AS total_profit,
            SUM(CASE WHEN profit < 0 THEN ABS(profit) ELSE 0 END) AS total_lost
         FROM bets
         WHERE username = ?`,
        [username]
    );

    return {
        player: players[0],
        betStats: betStats[0] || {}
    };
}

async function getPublicPlayerProfile(username, options = {}) {
    const result = await getPlayerWithBetStats(username);

    if (!result) {
        return null;
    }

    const [recentBets] = await db.query(
        `SELECT game_type, bet_amount, multiplier, payout, profit, won, created_at
         FROM bets
         WHERE username = ?
         ORDER BY created_at DESC
         LIMIT 6`,
        [username]
    );

    return {
        ...buildPublicProfilePayload(result.player, result.betStats, options),
        recentBets: recentBets.map((bet) => ({
            gameType: bet.game_type || 'casino',
            amount: Number(bet.bet_amount || 0),
            multiplier: Number(bet.multiplier || 0),
            payout: Number(bet.payout || 0),
            profit: Number(bet.profit || 0),
            won: !!bet.won,
            timestamp: bet.created_at
        }))
    };
}

// Get player stats
router.get('/stats', requireAuth, async (req, res) => {
    const username = req.session.username;

    try {
        const result = await getPlayerWithBetStats(username);

        if (!result) {
            return res.status(404).json({ success: false, message: 'Player not found' });
        }

        return res.json({
            success: true,
            player: buildPlayerPayload(result.player, result.betStats)
        });
    } catch (error) {
        console.error('Stats error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.get('/directory', requireAuth, async (req, res) => {
    const limit = Math.max(1, Math.min(12, parseInt(req.query.limit, 10) || 6));
    const requestedUsernames = String(req.query.usernames || '')
        .split(',')
        .map((value) => String(value || '').trim().replace(/[^a-zA-Z0-9_]/g, '').slice(0, 16))
        .filter(Boolean);
    const uniqueRequested = [...new Set(requestedUsernames)];
    const onlineSet = new Set(uniqueRequested.map((value) => value.toLowerCase()));

    try {
        let playerRows = [];

        if (uniqueRequested.length > 0) {
            [playerRows] = await db.query(
                `SELECT
                    p.username,
                    p.balance,
                    p.wallet_balance,
                    p.xp,
                    p.level,
                    p.total_wagered,
                    COALESCE(COUNT(b.id), 0) AS total_bets,
                    COALESCE(SUM(CASE WHEN b.won = TRUE THEN 1 ELSE 0 END), 0) AS wins,
                    COALESCE(MAX(b.profit), 0) AS biggest_win,
                    COALESCE(MIN(b.profit), 0) AS biggest_loss,
                    COALESCE(SUM(CASE WHEN b.profit > 0 THEN b.profit ELSE 0 END), 0) AS total_profit,
                    COALESCE(SUM(CASE WHEN b.profit < 0 THEN ABS(b.profit) ELSE 0 END), 0) AS total_lost
                 FROM players p
                 LEFT JOIN bets b ON b.username = p.username
                 WHERE p.username IN (?)
                 GROUP BY p.username, p.balance, p.wallet_balance, p.xp, p.level, p.total_wagered`,
                [uniqueRequested]
            );
        } else {
            [playerRows] = await db.query(
                `SELECT
                    p.username,
                    p.balance,
                    p.wallet_balance,
                    p.xp,
                    p.level,
                    p.total_wagered,
                    COALESCE(COUNT(b.id), 0) AS total_bets,
                    COALESCE(SUM(CASE WHEN b.won = TRUE THEN 1 ELSE 0 END), 0) AS wins,
                    COALESCE(MAX(b.profit), 0) AS biggest_win,
                    COALESCE(MIN(b.profit), 0) AS biggest_loss,
                    COALESCE(SUM(CASE WHEN b.profit > 0 THEN b.profit ELSE 0 END), 0) AS total_profit,
                    COALESCE(SUM(CASE WHEN b.profit < 0 THEN ABS(b.profit) ELSE 0 END), 0) AS total_lost
                 FROM players p
                 LEFT JOIN bets b ON b.username = p.username
                 GROUP BY p.username, p.balance, p.wallet_balance, p.xp, p.level, p.total_wagered
                 ORDER BY p.wallet_balance DESC, p.total_wagered DESC, p.username ASC
                 LIMIT ?`,
                [limit]
            );
        }

        const sortedRows = uniqueRequested.length > 0
            ? playerRows.sort((left, right) => uniqueRequested.indexOf(left.username) - uniqueRequested.indexOf(right.username))
            : playerRows;

        return res.json({
            success: true,
            players: sortedRows
                .slice(0, limit)
                .map((player) => buildPublicProfilePayload(player, player, {
                    online: onlineSet.has(String(player.username || '').toLowerCase())
                }))
        });
    } catch (error) {
        console.error('Player directory error:', error);
        return res.status(500).json({ success: false, message: 'Could not load player directory' });
    }
});

router.get('/profile/:username', requireAuth, async (req, res) => {
    const username = String(req.params.username || '')
        .trim()
        .replace(/[^a-zA-Z0-9_]/g, '')
        .slice(0, 16);

    if (!username) {
        return res.status(400).json({ success: false, message: 'Player username is required' });
    }

    try {
        const playerProfile = await getPublicPlayerProfile(username);

        if (!playerProfile) {
            return res.status(404).json({ success: false, message: 'Player not found' });
        }

        return res.json({
            success: true,
            player: playerProfile
        });
    } catch (error) {
        console.error('Public profile error:', error);
        return res.status(500).json({ success: false, message: 'Could not load that player profile' });
    }
});

router.get('/daily-rewards', requireAuth, async (req, res) => {
    const username = req.session.username;
    const today = getDailyDateKey();

    try {
        const [players] = await db.query(
            'SELECT username, balance, wallet_balance, xp, level FROM players WHERE username = ?',
            [username]
        );

        if (players.length === 0) {
            return res.status(404).json({ success: false, message: 'Player not found' });
        }

        const [claims] = await db.query(
            `SELECT claim_date, case_id, item_name, item_value, item_rarity, created_at
             FROM daily_reward_claims
             WHERE username = ?
             ORDER BY created_at DESC
             LIMIT 8`,
            [username]
        );

        const todaysClaim = claims.find((claim) => {
            const dateValue = claim.claim_date instanceof Date
                ? claim.claim_date.toISOString().slice(0, 10)
                : String(claim.claim_date).slice(0, 10);
            return dateValue === today;
        }) || null;

        return res.json({
            success: true,
            dailyReward: buildDailyRewardPayload(players[0], todaysClaim),
            recentClaims: claims.map((claim) => ({
                claimDate: claim.claim_date,
                caseId: claim.case_id,
                itemName: claim.item_name,
                itemValue: Number(claim.item_value || 0),
                itemRarity: claim.item_rarity,
                timestamp: claim.created_at
            }))
        });
    } catch (error) {
        console.error('Daily rewards load error:', error);
        return res.status(500).json({ success: false, message: 'Could not load daily rewards' });
    }
});

router.post('/daily-rewards/claim', requireAuth, async (req, res) => {
    const username = req.session.username;
    const today = getDailyDateKey();
    let connection;

    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const [players] = await connection.query(
            'SELECT username, balance, wallet_balance, xp, level FROM players WHERE username = ? FOR UPDATE',
            [username]
        );

        if (players.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'Player not found' });
        }

        const player = players[0];
        const progression = getProgressionSnapshot(player.xp);
        const rewardCase = getDailyRewardCaseForLevel(progression.level);

        if (!rewardCase) {
            await connection.rollback();
            return res.status(503).json({ success: false, message: 'Daily crate catalog is unavailable.' });
        }

        const winningItem = pickCaseItem(rewardCase, Math.random());
        const itemValue = toMoney(winningItem.value);
        const walletBefore = Number(player.wallet_balance || 0);
        const walletAfter = toMoney(walletBefore + itemValue);

        try {
            await connection.query(
                `INSERT INTO daily_reward_claims
                 (username, claim_date, level_at_claim, case_id, item_name, item_value, item_rarity)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    username,
                    today,
                    progression.level,
                    rewardCase.id,
                    winningItem.name,
                    itemValue,
                    winningItem.rarity
                ]
            );
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                await connection.rollback();
                return res.status(409).json({ success: false, message: 'You already claimed today. Come back tomorrow.' });
            }
            throw error;
        }

        await connection.query(
            'UPDATE players SET wallet_balance = ? WHERE username = ?',
            [walletAfter, username]
        );

        await connection.commit();

        if (global.emitToWebsiteUser) {
            global.emitToWebsiteUser(username, 'wallet:updated', {
                username,
                walletBalance: walletAfter,
                vaultBalance: Number(player.balance || 0),
                source: 'daily-reward',
                syncedAt: Date.now()
            });
        }

        return res.json({
            success: true,
            message: `Daily ${rewardCase.name} opened.`,
            rewardCase,
            winningItem,
            payout: itemValue,
            newBalance: walletAfter,
            walletBalance: walletAfter,
            vaultBalance: Number(player.balance || 0),
            dailyReward: buildDailyRewardPayload({ ...player, xp: progression.xp }, { claim_date: today })
        });
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        console.error('Daily reward claim error:', error);
        return res.status(500).json({ success: false, message: 'Daily reward claim failed' });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

router.post('/transfer', requireAuth, async (req, res) => {
    const username = req.session.username;
    const type = sanitizeTransferType(req.body.type);
    const source = sanitizeTransferSource(req.body.source);
    const amount = toMoney(req.body.amount);
    const requestId = sanitizeRequestId(req.body.requestId, `wallet:${type || 'transfer'}`);

    if (!type) {
        return res.status(400).json({ success: false, message: 'Invalid transfer type' });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid transfer amount' });
    }

    let connection;

    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const claimedTransfer = await claimWalletTransfer(connection, {
            requestId,
            username,
            transferType: type,
            transferSource: source,
            amount
        });

        if (claimedTransfer) {
            await connection.rollback();
            return res.status(claimedTransfer.status).json(claimedTransfer.payload);
        }

        const [players] = await connection.query(
            'SELECT balance, wallet_balance FROM players WHERE username = ? FOR UPDATE',
            [username]
        );

        if (players.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'Player not found' });
        }

        const player = players[0];
        const walletBefore = Number(player.wallet_balance || 0);
        const vaultBefore = Number(player.balance || 0);
        let walletAfter = walletBefore;
        let vaultAfter = vaultBefore;

        if (type === 'deposit') {
            if (vaultBefore < amount) {
                await connection.rollback();
                return res.status(400).json({ success: false, message: 'Not enough Minecraft balance to deposit.' });
            }

            walletAfter = toMoney(walletBefore + amount);
            vaultAfter = toMoney(vaultBefore - amount);
        } else {
            if (walletBefore < amount) {
                await connection.rollback();
                return res.status(400).json({ success: false, message: 'Not enough website wallet balance to withdraw.' });
            }

            walletAfter = toMoney(walletBefore - amount);
            vaultAfter = toMoney(vaultBefore + amount);
        }

        await connection.query(
            `UPDATE players
             SET balance = ?, wallet_balance = ?
             WHERE username = ?`,
            [vaultAfter, walletAfter, username]
        );

        await finalizeWalletTransfer(connection, {
            requestId,
            username,
            walletBefore,
            walletAfter,
            vaultBefore,
            vaultAfter
        });

        await connection.commit();

        if (global.emitToWebsiteUser) {
            global.emitToWebsiteUser(username, 'wallet:updated', {
                username,
                walletBalance: walletAfter,
                vaultBalance: vaultAfter,
                source,
                syncedAt: Date.now()
            });
        }

        return res.json({
            success: true,
            type,
            amount,
            message: type === 'deposit'
                ? 'Moved funds into your website wallet.'
                : 'Moved funds back to your Minecraft balance.',
            newBalance: walletAfter,
            balance: walletAfter,
            walletBalance: walletAfter,
            vaultBalance: vaultAfter
        });
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        console.error('Transfer error:', error);
        return res.status(500).json({ success: false, message: 'Transfer failed' });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

// Get player bet history
router.get('/history', requireAuth, async (req, res) => {
    const username = req.session.username;
    const limit = parseInt(req.query.limit, 10) || 20;

    try {
        const [bets] = await db.query(
            'SELECT * FROM bets WHERE username = ? ORDER BY created_at DESC LIMIT ?',
            [username, limit]
        );

        return res.json({
            success: true,
            bets: bets.map((bet) => ({
                id: bet.id,
                gameType: bet.game_type || 'casino',
                amount: parseFloat(bet.bet_amount),
                multiplier: parseFloat(bet.multiplier),
                payout: parseFloat(bet.payout),
                profit: parseFloat(bet.profit),
                won: bet.won,
                timestamp: bet.created_at
            }))
        });
    } catch (error) {
        console.error('History error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
