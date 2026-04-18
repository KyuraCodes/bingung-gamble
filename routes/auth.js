const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { getProgressionSnapshot } = require('../config/progression');

function buildPlayerPayload(player = {}) {
    const walletBalance = Number(player.wallet_balance ?? 0);
    const vaultBalance = Number(player.balance ?? 0);
    const progression = getProgressionSnapshot(player.xp);

    return {
        username: player.username,
        balance: walletBalance,
        walletBalance,
        vaultBalance,
        ...progression
    };
}

// Login with code
router.post('/login', async (req, res) => {
    const { username, code } = req.body;

    if (!username || !code) {
        return res.status(400).json({ success: false, message: 'Username and code required' });
    }

    try {
        // Check if code exists and is valid
        const [codes] = await db.query(
            'SELECT * FROM auth_codes WHERE username = ? AND code = ? AND used = FALSE AND expires_at > NOW()',
            [username, code]
        );

        if (codes.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid or expired code' });
        }

        // Mark code as used
        await db.query('UPDATE auth_codes SET used = TRUE WHERE code = ?', [code]);

        // Get or create player
        let [players] = await db.query('SELECT * FROM players WHERE username = ?', [username]);
        
        if (players.length === 0) {
            // Create a placeholder row if the plugin has not synced this player yet.
            await db.query(
                'INSERT INTO players (username, uuid, balance, wallet_balance) VALUES (?, ?, ?, ?)',
                [username, `temp-${Date.now()}`, 0.00, 0.00]
            );
            [players] = await db.query('SELECT * FROM players WHERE username = ?', [username]);
        }

        const player = players[0];

        // Create session
        req.session.username = username;
        req.session.loggedIn = true;

        res.json({
            success: true,
            message: 'Login successful',
            player: buildPlayerPayload(player)
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Check session
router.get('/session', async (req, res) => {
    if (!req.session.loggedIn) {
        return res.json({ loggedIn: false });
    }

    try {
        const [players] = await db.query('SELECT * FROM players WHERE username = ?', [req.session.username]);
        
        if (players.length === 0) {
            req.session.destroy();
            return res.json({ loggedIn: false });
        }

        const player = players[0];
        res.json({
            loggedIn: true,
            player: buildPlayerPayload(player)
        });
    } catch (error) {
        console.error('Session check error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Logout
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Logout failed' });
        }
        res.json({ success: true, message: 'Logged out successfully' });
    });
});

module.exports = router;
