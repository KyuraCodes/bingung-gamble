// ===== CRASH GAME WITH ULTRA COMPLEX GRAPH =====
function loadCrashGame(container) {
    container.innerHTML = `
        <div class="game-container">
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px;">
                <div>
                    <div class="crash-stage-panel" style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 16px; padding: 20px; position: relative; height: 500px;">
                        <canvas id="crashCanvas" width="800" height="460" style="width: 100%; height: 100%;"></canvas>
                        <div id="crashCountdownBanner" class="crash-countdown-banner">
                            <span>Round Starting In</span>
                            <strong>--</strong>
                        </div>
                        <div id="crashMultiplierOverlay" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 80px; font-weight: 900; text-shadow: 0 0 30px rgba(0,0,0,0.8); pointer-events: none; z-index: 10;">1.00x</div>
                    </div>
                    
                    <div style="margin-top: 20px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 12px; padding: 16px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">CURRENT BET</div>
                                <div id="crashCurrentBet" style="font-size: 18px; font-weight: 800; color: var(--accent-primary);">$0.00</div>
                            </div>
                            <div>
                                <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">POTENTIAL WIN</div>
                                <div id="crashPotentialWin" style="font-size: 18px; font-weight: 800; color: var(--accent-success);">$0.00</div>
                            </div>
                            <div>
                                <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">PROFIT</div>
                                <div id="crashProfit" style="font-size: 18px; font-weight: 800; color: var(--accent-warning);">$0.00</div>
                            </div>
                        </div>
                    </div>
                    
                    <div id="crashHistory" style="margin-top: 16px; display: flex; gap: 8px; flex-wrap: wrap;"></div>
                </div>
                
                <div class="bet-panel">
                    <div class="bet-input-group">
                        <label class="bet-label">Bet Amount</label>
                        <input type="number" id="crashBetAmount" class="bet-input" placeholder="0.00" min="1" step="0.01">
                        <div class="quick-bets">
                            <button class="quick-bet-btn" onclick="setCrashBet(100)">100</button>
                            <button class="quick-bet-btn" onclick="setCrashBet(1000)">1K</button>
                            <button class="quick-bet-btn" onclick="setCrashBet(10000)">10K</button>
                            <button class="quick-bet-btn" onclick="setCrashBet(Math.floor(currentPlayer.balance))">MAX</button>
                        </div>
                    </div>
                    
                    <div class="bet-input-group">
                        <label class="bet-label">Auto Cashout (Optional)</label>
                        <input type="number" id="crashAutoCashout" class="bet-input" placeholder="2.00x" min="1.01" step="0.01">
                    </div>
                    
                    <div style="background: var(--bg-primary); padding: 16px; border-radius: 12px; margin-bottom: 16px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <span style="font-size: 12px; color: var(--text-secondary);">Round Status</span>
                            <span style="font-size: 12px; font-weight: 700; color: var(--accent-success);" id="crashRoundStatus">Loading...</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <span style="font-size: 12px; color: var(--text-secondary);">Round Timer</span>
                            <span style="font-size: 12px; font-weight: 700;" id="crashRoundTimer">--</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span style="font-size: 12px; color: var(--text-secondary);">Auto Cashout</span>
                            <span style="font-size: 12px; font-weight: 700;" id="crashWinChance">Off</span>
                        </div>
                    </div>
                    
                    <button id="crashBetBtn" class="btn-primary" onclick="startCrashBet()">
                        <i class="fas fa-rocket"></i> Join Next Round
                    </button>
                    <button id="crashCashoutBtn" class="btn-danger" onclick="crashCashout()" style="display: none; margin-top: 12px;">
                        <i class="fas fa-hand-holding-usd"></i> Cash Out <span id="crashCashoutAmount">$0.00</span>
                    </button>
                    
                    <div style="margin-top: 16px; padding: 12px; background: rgba(124, 199, 255, 0.08); border: 1px solid var(--accent-primary); border-radius: 8px; font-size: 12px; color: var(--text-secondary);">
                        <i class="fas fa-earth-asia"></i> Crash is global now. Everyone joins the same countdown and the same live multiplier.
                    </div>
                </div>
            </div>
        </div>
    `;
    
    initCrashGame();
}

let crashCanvas, crashCtx;
let crashInterval = null;
let crashAnimationFrame = null;
let crashMultiplier = 1.00;
let crashBetActive = false;
let crashBetAmount = 0;
let crashGameRunning = false;
let crashPoint = 0;
let crashHistory = [];
let crashGraphData = [];
let crashStartTime = 0;
let crashParticles = [];
let crashSharedState = null;
let crashPreviousPhase = null;
let crashAwaitingBet = false;
let crashAwaitingCashout = false;
let crashAutoCashout = 0;
let crashUiTicker = null;
const CRASH_EDGE = 0.86;
const DICE_EDGE = 0.86;
const COINFLIP_PAYOUT = 1.78;
const LIMBO_EDGE = 0.84;
const GAME_COOLDOWN_MS = 900;
const LONG_GAME_COOLDOWN_MS = 1400;
const CRASH_MAX_MULTIPLIER = 80;
const LIMBO_MAX_TARGET = 25;
const MINES_EDGE = 0.86;
const TOWERS_STEP_MULTIPLIER = 0.24;
const BLACKJACK_NATURAL_PAYOUT = 2.2;
const KENO_PAYOUTS = { 5: 1.15, 6: 1.8, 7: 3.2, 8: 6.4, 9: 12, 10: 24 };
const SLOTS_PAYTABLE = {
    'ðŸ’': 2,
    'ðŸ‹': 4,
    'ðŸŠ': 6,
    'ðŸ‡': 9,
    'ðŸ’Ž': 14,
    '7ï¸âƒ£': 24
};
const GAME_ACTION_BUSY = new Set();
const GAME_ACTION_COOLDOWNS = new Map();

function clampMultiplier(value, maxMultiplier) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return 1;
    }

    return Math.max(1, Math.min(maxMultiplier, parsed));
}

function rollInverseMultiplier(edge, maxMultiplier) {
    return clampMultiplier(edge / Math.max(0.0001, 1 - Math.random()), maxMultiplier);
}

function startGameAction(actionKey, cooldownMs = GAME_COOLDOWN_MS) {
    const now = performance.now();
    const nextAllowed = GAME_ACTION_COOLDOWNS.get(actionKey) || 0;

    if (GAME_ACTION_BUSY.has(actionKey)) {
        showNotification('Finish the current round first.', 'info');
        return false;
    }

    if (now < nextAllowed) {
        showNotification('Slow down a bit before starting another round.', 'info');
        return false;
    }

    GAME_ACTION_BUSY.add(actionKey);
    return true;
}

function finishGameAction(actionKey, cooldownMs = GAME_COOLDOWN_MS) {
    GAME_ACTION_BUSY.delete(actionKey);
    GAME_ACTION_COOLDOWNS.set(actionKey, performance.now() + cooldownMs);
}

function initCrashGame() {
    crashCanvas = document.getElementById('crashCanvas');
    crashCtx = crashCanvas.getContext('2d');
    crashCanvas.width = 800;
    crashCanvas.height = 460;

    if (crashUiTicker) {
        clearInterval(crashUiTicker);
    }

    crashUiTicker = setInterval(() => {
        updateCrashPanel();
    }, 200);

    drawCrashGraph();
    updateCrashHistory();

    if (!isBetaMode) {
        loadCrashState();
    } else {
        crashSharedState = {
            phase: 'betting',
            multiplier: 1,
            bettingClosesAt: Date.now() + 8000,
            activeBet: null,
            history: []
        };
        updateCrashPanel();
    }
}

function setCrashBet(amount) {
    setAmountInputValue('crashBetAmount', amount);
}

async function loadCrashState() {
    try {
        const response = await fetch('/api/game/crash/state');
        const data = await response.json();

        if (data.success && data.crash) {
            handleCrashRealtimeState(data.crash);
        }
    } catch (error) {
        console.error('Failed to load crash state:', error);
        updateCrashPanel();
    }
}

function formatCrashCountdown(targetTimestamp) {
    if (!targetTimestamp) {
        return '--';
    }

    const remainingMs = Math.max(0, Number(targetTimestamp) - Date.now());
    const totalSeconds = Math.ceil(remainingMs / 1000);
    const seconds = totalSeconds % 60;
    const minutes = Math.floor(totalSeconds / 60);
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function normalizeCrashHistory(history = []) {
    return history.map((entry) => ({
        multiplier: clampMultiplier(entry.multiplier || 1, CRASH_MAX_MULTIPLIER),
        won: clampMultiplier(entry.multiplier || 1, CRASH_MAX_MULTIPLIER) >= 2,
        timestamp: entry.timestamp || Date.now()
    }));
}

function syncCrashGraphState(state) {
    const phase = state?.phase || 'betting';
    const nextMultiplier = clampMultiplier(state?.multiplier || state?.crashPoint || 1, CRASH_MAX_MULTIPLIER);

    if (crashPreviousPhase !== phase) {
        if (phase === 'betting') {
            crashGraphData = [1];
            crashMultiplier = 1;
            crashPoint = 0;
        } else if (phase === 'running') {
            crashGraphData = [1];
            crashMultiplier = 1;
        } else if (phase === 'crashed') {
            crashMultiplier = clampMultiplier(state?.crashPoint || nextMultiplier || 1, CRASH_MAX_MULTIPLIER);
            crashPoint = crashMultiplier;
            crashGraphData.push(crashMultiplier);
            createCrashParticles(crashCanvas ? crashCanvas.width / 2 : 400, crashCanvas ? crashCanvas.height / 2 : 230, '239, 68, 68');
        }
    }

    if (phase === 'running') {
        crashMultiplier = nextMultiplier;
        if (crashGraphData.length === 0) {
            crashGraphData = [1];
        }
        if (Math.abs((crashGraphData[crashGraphData.length - 1] || 1) - crashMultiplier) > 0.001) {
            crashGraphData.push(crashMultiplier);
        }
        while (crashGraphData.length > 120) {
            crashGraphData.shift();
        }
    }

    crashGameRunning = phase === 'running';
    crashPreviousPhase = phase;
}

function handleCrashRealtimeState(state) {
    if (!state || isBetaMode) {
        return;
    }

    crashSharedState = state;
    crashHistory = normalizeCrashHistory(state.history || []);
    syncCrashGraphState(state);

    if (state.activeBet) {
        crashBetActive = true;
        crashBetAmount = Number(state.activeBet.amount || 0);
        crashAutoCashout = Number(state.activeBet.autoCashout || 0);
    } else if (!crashAwaitingCashout) {
        crashBetActive = false;
        crashBetAmount = 0;
        crashAutoCashout = 0;
    }

    updateCrashHistory();
    updateCrashPanel();
    drawCrashGraph();
}

function handleCrashBetSettlement(payload) {
    if (!payload) {
        return;
    }

    crashAwaitingCashout = false;
    crashAwaitingBet = false;
    crashBetActive = false;
    crashBetAmount = 0;
    crashAutoCashout = 0;

    const amount = Number(payload.amount || 0);
    const payout = Number(payload.payout || 0);
    const multiplier = clampMultiplier(payload.multiplier || crashSharedState?.crashPoint || 1, CRASH_MAX_MULTIPLIER);
    const profit = Number(payload.profit || 0);

    if (amount <= 0 && payout <= 0 && profit === 0) {
        updateCrashPanel();
        drawCrashGraph();
        return;
    }

    if (payload.resultType === 'crash') {
        createCrashParticles(crashCanvas ? crashCanvas.width / 2 : 400, crashCanvas ? crashCanvas.height / 2 : 230, '239, 68, 68');
        showNotification(`Crashed at ${multiplier.toFixed(2)}x. Lost $${formatAmount(Math.abs(profit))}`, 'error');
        playGameSound('explode');
    } else {
        createCrashParticles(crashCanvas ? crashCanvas.width / 2 : 400, crashCanvas ? crashCanvas.height / 2 : 230, '16, 185, 129');
        showNotification(`Cashed out at ${multiplier.toFixed(2)}x for +$${formatAmount(Math.max(0, profit))}`, 'success');
        playGameSound('cashout');
    }

    updateCrashPanel();
    drawCrashGraph();
}

function drawCrashGraph() {
    if (!crashCtx) return;
    
    const width = crashCanvas.width;
    const height = crashCanvas.height;
    const visibleMaxMultiplier = Math.max(6, Math.min(CRASH_MAX_MULTIPLIER, Math.ceil(Math.max(...crashGraphData, crashMultiplier, 6))));
    
    // Clear canvas
    crashCtx.fillStyle = '#0f172a';
    crashCtx.fillRect(0, 0, width, height);
    
    // Draw grid
    crashCtx.strokeStyle = '#1e293b';
    crashCtx.lineWidth = 1;
    
    // Vertical lines
    for (let i = 0; i < 10; i++) {
        crashCtx.beginPath();
        crashCtx.moveTo((width / 10) * i, 0);
        crashCtx.lineTo((width / 10) * i, height);
        crashCtx.stroke();
    }
    
    // Horizontal lines
    for (let i = 0; i < 8; i++) {
        crashCtx.beginPath();
        crashCtx.moveTo(0, (height / 8) * i);
        crashCtx.lineTo(width, (height / 8) * i);
        crashCtx.stroke();
    }
    
    // Draw axes labels
    crashCtx.fillStyle = '#64748b';
    crashCtx.font = 'bold 12px Inter';
    crashCtx.textAlign = 'right';
    
    for (let i = 0; i <= 10; i++) {
        const mult = (1 + ((visibleMaxMultiplier - 1) * i) / 10).toFixed(1);
        const y = height - (i * height / 10);
        crashCtx.fillText(mult + 'x', 35, y + 4);
    }
    
    // Draw graph line
    if (crashGraphData.length > 1) {
        const gradient = crashCtx.createLinearGradient(0, 0, 0, height);
        
        if (crashGameRunning) {
            gradient.addColorStop(0, '#10b981');
            gradient.addColorStop(1, '#38bdf8');
        } else {
            gradient.addColorStop(0, '#ef4444');
            gradient.addColorStop(1, '#dc2626');
        }
        
        crashCtx.strokeStyle = gradient;
        crashCtx.lineWidth = 4;
        crashCtx.lineCap = 'round';
        crashCtx.lineJoin = 'round';
        
        // Draw glow effect
        crashCtx.shadowBlur = 20;
        crashCtx.shadowColor = crashGameRunning ? '#10b981' : '#ef4444';
        
        crashCtx.beginPath();
        
        for (let i = 0; i < crashGraphData.length; i++) {
            const x = (i / crashGraphData.length) * width;
            const mult = clampMultiplier(crashGraphData[i], CRASH_MAX_MULTIPLIER);
            const y = height - ((mult - 1) / Math.max(1, visibleMaxMultiplier - 1)) * height;
            
            if (i === 0) {
                crashCtx.moveTo(x, y);
            } else {
                crashCtx.lineTo(x, y);
            }
        }
        
        crashCtx.stroke();
        crashCtx.shadowBlur = 0;
        
        // Fill area under curve
        crashCtx.lineTo(width, height);
        crashCtx.lineTo(0, height);
        crashCtx.closePath();
        
        const areaGradient = crashCtx.createLinearGradient(0, 0, 0, height);
        if (crashGameRunning) {
            areaGradient.addColorStop(0, 'rgba(16, 185, 129, 0.2)');
            areaGradient.addColorStop(1, 'rgba(56, 189, 248, 0.06)');
        } else {
            areaGradient.addColorStop(0, 'rgba(239, 68, 68, 0.2)');
            areaGradient.addColorStop(1, 'rgba(220, 38, 38, 0.05)');
        }
        
        crashCtx.fillStyle = areaGradient;
        crashCtx.fill();
    }
    
    // Draw particles
    crashParticles.forEach((particle, index) => {
        particle.y -= particle.speed;
        particle.opacity -= 0.02;
        particle.x += particle.vx;
        
        crashCtx.fillStyle = `rgba(${particle.color}, ${particle.opacity})`;
        crashCtx.beginPath();
        crashCtx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        crashCtx.fill();
        
        if (particle.opacity <= 0) {
            crashParticles.splice(index, 1);
        }
    });
    
    if (crashGameRunning) {
        crashAnimationFrame = requestAnimationFrame(drawCrashGraph);
    }
}

function createCrashParticles(x, y, color) {
    for (let i = 0; i < 20; i++) {
        crashParticles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 5,
            speed: Math.random() * 3 + 2,
            size: Math.random() * 4 + 2,
            opacity: 1,
            color: color
        });
    }
}

function updateCrashPanel() {
    const overlay = document.getElementById('crashMultiplierOverlay');
    const currentBet = document.getElementById('crashCurrentBet');
    const potentialWin = document.getElementById('crashPotentialWin');
    const profit = document.getElementById('crashProfit');
    const cashoutAmount = document.getElementById('crashCashoutAmount');
    const betButton = document.getElementById('crashBetBtn');
    const cashoutButton = document.getElementById('crashCashoutBtn');
    const status = document.getElementById('crashRoundStatus');
    const timer = document.getElementById('crashRoundTimer');
    const autoCashoutLabel = document.getElementById('crashWinChance');
    const countdownBanner = document.getElementById('crashCountdownBanner');

    if (!overlay || !betButton || !cashoutButton) {
        return;
    }

    const selectedAutoCashout = Number(document.getElementById('crashAutoCashout')?.value || crashAutoCashout || 0);
    if (autoCashoutLabel) {
        autoCashoutLabel.textContent = selectedAutoCashout >= 1.01 ? `${selectedAutoCashout.toFixed(2)}x` : 'Off';
    }

    if (isBetaMode) {
        overlay.style.color = '';
        const betaMultiplier = clampMultiplier(crashMultiplier, CRASH_MAX_MULTIPLIER);
        overlay.textContent = `${betaMultiplier.toFixed(2)}x`;
        if (status) status.textContent = crashGameRunning ? 'Live beta round' : 'Ready';
        if (timer) timer.textContent = crashGameRunning ? 'Live' : '--';
        if (currentBet) currentBet.textContent = `$${formatAmount(crashBetAmount)}`;
        if (potentialWin) potentialWin.textContent = `$${formatAmount(crashBetAmount * betaMultiplier)}`;
        if (profit) profit.textContent = `$${formatAmount(crashBetAmount * Math.max(0, betaMultiplier - 1))}`;
        if (cashoutAmount) cashoutAmount.textContent = `$${formatAmount(crashBetAmount * betaMultiplier)}`;

        if (crashGameRunning && crashBetAmount > 0) {
            betButton.style.display = 'none';
            cashoutButton.style.display = 'inline-flex';
            cashoutButton.disabled = false;
        } else {
            betButton.style.display = 'inline-flex';
            betButton.disabled = false;
            betButton.innerHTML = '<i class="fas fa-rocket"></i> Join Next Round';
            cashoutButton.style.display = 'none';
        }
        return;
    }

    const state = crashSharedState || { phase: 'betting', multiplier: 1, bettingClosesAt: null, activeBet: null };
    const liveMultiplier = clampMultiplier(state.phase === 'crashed' ? (state.crashPoint || state.multiplier || 1) : (state.multiplier || 1), CRASH_MAX_MULTIPLIER);
    const activeBetAmount = crashBetActive ? crashBetAmount : Number(state.activeBet?.amount || 0);
    const projectedPayout = activeBetAmount > 0 ? activeBetAmount * liveMultiplier : 0;
    const projectedProfit = activeBetAmount > 0 ? projectedPayout - activeBetAmount : 0;

    overlay.style.color = state.phase === 'crashed' ? '#ef4444' : '';
    overlay.textContent = `${liveMultiplier.toFixed(2)}x`;

    if (currentBet) currentBet.textContent = `$${formatAmount(activeBetAmount)}`;
    if (potentialWin) potentialWin.textContent = `$${formatAmount(projectedPayout)}`;
    if (profit) profit.textContent = `${projectedProfit >= 0 ? '' : '-'}$${formatAmount(Math.abs(projectedProfit))}`;
    if (cashoutAmount) cashoutAmount.textContent = `$${formatAmount(projectedPayout)}`;

    if (state.phase === 'betting') {
        const countdown = formatCrashCountdown(state.bettingClosesAt);
        overlay.style.color = '#7cc7ff';
        overlay.textContent = countdown;
        if (countdownBanner) {
            countdownBanner.classList.add('active');
            countdownBanner.innerHTML = `<span>Round Starting In</span><strong>${countdown}</strong>`;
        }
        if (status) status.textContent = activeBetAmount > 0 ? 'Bet locked for launch' : 'Betting open';
        if (timer) timer.textContent = countdown;
        betButton.style.display = 'inline-flex';
        betButton.disabled = crashAwaitingBet || activeBetAmount > 0;
        betButton.innerHTML = activeBetAmount > 0
            ? '<i class="fas fa-lock"></i> Locked In'
            : '<i class="fas fa-rocket"></i> Join Next Round';
        cashoutButton.style.display = 'none';
        return;
    }

    if (state.phase === 'running') {
        if (countdownBanner) {
            countdownBanner.classList.remove('active');
            countdownBanner.innerHTML = `<span>Betting Closed</span><strong>Live</strong>`;
        }
        if (status) status.textContent = activeBetAmount > 0 ? 'Round live - cash out any time' : 'Round live';
        if (timer) timer.textContent = 'Live';

        if (activeBetAmount > 0) {
            betButton.style.display = 'none';
            cashoutButton.style.display = 'inline-flex';
            cashoutButton.disabled = crashAwaitingCashout;
        } else {
            betButton.style.display = 'inline-flex';
            betButton.disabled = true;
            betButton.innerHTML = '<i class="fas fa-hourglass-half"></i> Wait For Next Round';
            cashoutButton.style.display = 'none';
        }
        return;
    }

    if (countdownBanner) {
        countdownBanner.classList.remove('active');
    }
    if (status) status.textContent = `Crashed at ${liveMultiplier.toFixed(2)}x`;
    if (timer) timer.textContent = 'Resetting';
    betButton.style.display = 'inline-flex';
    betButton.disabled = true;
    betButton.innerHTML = '<i class="fas fa-rotate"></i> Next Round Soon';
    cashoutButton.style.display = 'none';
}

function startCrashBet() {
    const amount = readAmountInput('crashBetAmount');
    const autoCashout = parseFloat(document.getElementById('crashAutoCashout').value) || 0;
    
    if (!amount || amount <= 0) {
        showNotification('Enter a valid bet amount', 'error');
        return;
    }
    
    if (amount > currentPlayer.balance) {
        showNotification('Insufficient balance', 'error');
        return;
    }

    if (!isBetaMode && (!crashSharedState || crashSharedState.phase !== 'betting')) {
        showNotification('Crash betting window is closed. Wait for the next round.', 'error');
        return;
    }

    if (!isBetaMode && (crashBetActive || crashAwaitingBet)) {
        showNotification('Your crash bet is already in this round.', 'info');
        return;
    }

    if (!startGameAction('crash', isBetaMode ? LONG_GAME_COOLDOWN_MS : GAME_COOLDOWN_MS)) {
        return;
    }

    if (isBetaMode) {
        crashBetAmount = amount;
        crashBetActive = true;
        crashGameRunning = true;
        crashAutoCashout = autoCashout;
        reserveDisplayedBalance(amount);

        crashMultiplier = 1.00;
        crashGraphData = [1.00];
        crashStartTime = Date.now();

        crashPoint = rollInverseMultiplier(CRASH_EDGE, CRASH_MAX_MULTIPLIER);

        let speed = 0.01;

        crashInterval = setInterval(() => {
            speed += 0.0005;
            crashMultiplier = clampMultiplier(crashMultiplier + speed, CRASH_MAX_MULTIPLIER);
            crashGraphData.push(crashMultiplier);

            if (crashGraphData.length > 100) {
                crashGraphData.shift();
            }

            updateCrashPanel();

            if (autoCashout > 0 && crashMultiplier >= autoCashout) {
                crashCashout();
            }

            if (crashMultiplier >= crashPoint) {
                crashEnd(false);
            }
        }, 50);

        drawCrashGraph();
        updateCrashPanel();
        return;
    }

    crashAwaitingBet = true;
    updateCrashPanel();

    fetch('/api/game/crash/bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, autoCashout })
    })
        .then((response) => response.json())
        .then((data) => {
            if (!data.success) {
                throw new Error(data.message || 'Could not place crash bet');
            }

            crashBetActive = true;
            crashBetAmount = amount;
            crashAutoCashout = Number(data.autoCashout || 0);
            hydratePlayerStateFromResult({
                newBalance: data.newBalance,
                level: currentPlayer.level
            });
            handleCrashRealtimeState({
                ...(crashSharedState || {}),
                activeBet: {
                    amount,
                    autoCashout: crashAutoCashout,
                    roundId: data.roundId
                }
            });
            showNotification('Crash bet locked in for the shared round.', 'success');
            playGameSound('bet-place');
        })
        .catch((error) => {
            showNotification(error.message || 'Could not place crash bet', 'error');
        })
        .finally(() => {
            finishGameAction('crash');
            crashAwaitingBet = false;
            updateCrashPanel();
        });
}

async function crashCashout() {
    if (!crashBetActive) return;

    if (isBetaMode) {
        clearInterval(crashInterval);
        crashGameRunning = false;
        await crashEnd(true);
        return;
    }

    if (crashAwaitingCashout) {
        return;
    }

    crashAwaitingCashout = true;
    updateCrashPanel();

    try {
        const response = await fetch('/api/game/crash/cashout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || 'Could not cash out');
        }
    } catch (error) {
        crashAwaitingCashout = false;
        updateCrashPanel();
        showNotification(error.message || 'Could not cash out', 'error');
    }
}

async function crashEnd(won) {
    if (!isBetaMode) {
        return;
    }

    crashBetActive = false;
    crashGameRunning = false;
    finishGameAction('crash', LONG_GAME_COOLDOWN_MS);
    clearInterval(crashInterval);

    const payout = won ? crashBetAmount * crashMultiplier : 0;
    const settlement = await settleWager({
        amount: crashBetAmount,
        payout,
        multiplier: won ? crashMultiplier : 0,
        won,
        gameType: 'crash'
    });

    if (!settlement) {
        document.getElementById('crashBetBtn').style.display = 'block';
        document.getElementById('crashCashoutBtn').style.display = 'none';
        return;
    }
    
    if (won) {
        const profit = payout - crashBetAmount;
        createCrashParticles(crashCanvas ? crashCanvas.width / 2 : 400, crashCanvas ? crashCanvas.height / 2 : 230, '16, 185, 129');
        showNotification(`Cashed out at ${clampMultiplier(crashMultiplier, CRASH_MAX_MULTIPLIER).toFixed(2)}x! Won $${formatAmount(profit)}`, 'success');
        crashHistory.unshift({ multiplier: crashMultiplier, won: true });
        updateCrashHistory();
    } else {
        // Create explosion particles
        createCrashParticles(crashCanvas ? crashCanvas.width / 2 : 400, crashCanvas ? crashCanvas.height / 2 : 230, '239, 68, 68');
        
        document.getElementById('crashMultiplierOverlay').style.color = '#ef4444';
        showNotification(`Crashed at ${clampMultiplier(crashMultiplier, CRASH_MAX_MULTIPLIER).toFixed(2)}x! Lost $${formatAmount(crashBetAmount)}`, 'error');
        
        crashHistory.unshift({ multiplier: crashMultiplier, won: false });
        updateCrashHistory();
    }
    
    updateCrashPanel();
    
    // Continue animation for particles
    const particleAnimation = () => {
        drawCrashGraph();
        if (crashParticles.length > 0) {
            requestAnimationFrame(particleAnimation);
        }
    };
    particleAnimation();
    
    setTimeout(() => {
        document.getElementById('crashMultiplierOverlay').style.color = '';
        crashMultiplier = 1.00;
        crashGraphData = [];
        document.getElementById('crashMultiplierOverlay').textContent = '1.00x';
        document.getElementById('crashCurrentBet').textContent = '$0.00';
        document.getElementById('crashPotentialWin').textContent = '$0.00';
        document.getElementById('crashProfit').textContent = '$0.00';
        crashBetAmount = 0;
        crashAutoCashout = 0;
        updateCrashPanel();
        drawCrashGraph();
    }, 3000);
}

function updateCrashHistory() {
    const historyDiv = document.getElementById('crashHistory');
    if (!historyDiv) return;
    
    historyDiv.innerHTML = crashHistory.slice(0, 15).map(h => `
        <div style="
            padding: 8px 12px;
            background: ${h.won ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'};
            border: 1px solid ${h.won ? 'var(--accent-success)' : 'var(--accent-danger)'};
            border-radius: 8px;
            font-weight: 800;
            font-size: 14px;
            color: ${h.won ? 'var(--accent-success)' : 'var(--accent-danger)'};
        ">
            ${h.multiplier.toFixed(2)}x
        </div>
    `).join('');
}

function showNotification(message, type) {
    if (window.dispatchSiteNotification) {
        window.dispatchSiteNotification(message, type || 'info');
    }
}

function playGameSound(kind) {
    if (window.playUiSound) {
        window.playUiSound(kind);
    }
}

// ===== MINES GAME =====
function loadMinesGame(container) {
    container.innerHTML = `
        <div class="game-container">
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px;">
                <div>
                    <div id="minesGrid" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 20px;"></div>
                    <div id="minesResult" style="text-align: center; font-size: 24px; font-weight: 800; padding: 20px;"></div>
                </div>
                
                <div class="bet-panel">
                    <div class="bet-input-group">
                        <label class="bet-label">Bet Amount</label>
                        <input type="number" id="minesBetAmount" class="bet-input" placeholder="0.00" min="1">
                    </div>
                    
                    <div class="bet-input-group">
                        <label class="bet-label">Mines Count</label>
                        <input type="number" id="minesCount" class="bet-input" value="3" min="1" max="24">
                    </div>
                    
                    <div id="minesMultiplier" style="text-align: center; font-size: 32px; font-weight: 900; color: var(--accent-success); margin: 20px 0;">1.00x</div>
                    
                    <button id="minesStartBtn" class="btn-primary" onclick="startMinesGame()">Start Game</button>
                    <button id="minesCashoutBtn" class="btn-danger" onclick="minesCashout()" style="display: none; margin-top: 12px;">Cash Out</button>
                </div>
            </div>
        </div>
    `;
    
    createMinesGrid();
}

let minesGameActive = false;
let minesBetAmount = 0;
let minesRevealed = 0;
let minesPositions = [];
let minesMultiplier = 1.00;
let minesCountActive = 3;

function getMinesSurvivalChance(revealed, minesCount) {
    let chance = 1;

    for (let step = 0; step < revealed; step += 1) {
        chance *= (25 - minesCount - step) / (25 - step);
    }

    return Math.max(0.0001, chance);
}

function getMinesMultiplier(revealed, minesCount) {
    if (revealed <= 0) {
        return 1;
    }

    return Math.round(Math.min(6.5, Math.max(0.25, MINES_EDGE / getMinesSurvivalChance(revealed, minesCount))) * 100) / 100;
}

function createMinesGrid() {
    const grid = document.getElementById('minesGrid');
    grid.innerHTML = '';
    
    for (let i = 0; i < 25; i++) {
        const tile = document.createElement('div');
        tile.className = 'mines-tile';
        tile.style.cssText = `
            aspect-ratio: 1;
            background: var(--bg-secondary);
            border: 2px solid var(--border-color);
            border-radius: 12px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 32px;
            transition: all 0.3s;
        `;
        tile.onclick = () => revealMinesTile(i, tile);
        grid.appendChild(tile);
    }
}

function startMinesGame() {
    const amount = readAmountInput('minesBetAmount');
    const minesCount = Math.max(1, Math.min(24, parseInt(document.getElementById('minesCount').value, 10) || 3));
    
    if (!amount || amount <= 0) {
        showNotification('Enter a valid bet amount', 'error');
        return;
    }
    
    if (amount > currentPlayer.balance) {
        showNotification('Insufficient balance', 'error');
        return;
    }

    if (minesGameActive || !startGameAction('mines', LONG_GAME_COOLDOWN_MS)) {
        return;
    }
    
    minesBetAmount = amount;
    minesGameActive = true;
    minesRevealed = 0;
    minesMultiplier = 1.00;
    minesCountActive = minesCount;
    playGameSound('bet-place');
    reserveDisplayedBalance(amount);
    
    // Generate mine positions
    minesPositions = [];
    while (minesPositions.length < minesCount) {
        const pos = Math.floor(Math.random() * 25);
        if (!minesPositions.includes(pos)) {
            minesPositions.push(pos);
        }
    }
    
    createMinesGrid();
    document.getElementById('minesStartBtn').style.display = 'none';
    document.getElementById('minesCashoutBtn').style.display = 'block';
    document.getElementById('minesResult').textContent = '';
}

function revealMinesTile(index, tile) {
    if (!minesGameActive || tile.classList.contains('revealed')) return;
    
    tile.classList.add('revealed');
    
    if (minesPositions.includes(index)) {
        tile.textContent = '💣';
        tile.style.background = 'var(--accent-danger)';
        playGameSound('explode');
        minesGameEnd(false);
    } else {
        tile.textContent = '💎';
        tile.style.background = 'var(--accent-success)';
        minesRevealed++;
        minesMultiplier = getMinesMultiplier(minesRevealed, minesCountActive);
        document.getElementById('minesMultiplier').textContent = minesMultiplier.toFixed(2) + 'x';
        playGameSound('reveal');
    }
}

function minesCashout() {
    if (!minesGameActive) return;
    playGameSound('cashout');
    minesGameEnd(true);
}

async function minesGameEnd(won) {
    minesGameActive = false;
    finishGameAction('mines', LONG_GAME_COOLDOWN_MS);

    const payout = won ? minesBetAmount * minesMultiplier : 0;
    const settlement = await settleWager({
        amount: minesBetAmount,
        payout,
        multiplier: won ? minesMultiplier : 0,
        won,
        gameType: 'mines'
    });

    if (!settlement) {
        document.getElementById('minesStartBtn').style.display = 'block';
        document.getElementById('minesCashoutBtn').style.display = 'none';
        return;
    }
    
    if (won) {
        document.getElementById('minesResult').innerHTML = `
            <span style="color: var(--accent-success);">WON! +$${formatAmount(payout - minesBetAmount)}</span>
        `;
    } else {
        document.getElementById('minesResult').innerHTML = `
            <span style="color: var(--accent-danger);">BOOM! -$${formatAmount(minesBetAmount)}</span>
        `;
        
        // Reveal all mines
        const tiles = document.querySelectorAll('.mines-tile');
        minesPositions.forEach(pos => {
            tiles[pos].textContent = '💣';
            tiles[pos].style.background = 'rgba(239, 68, 68, 0.3)';
        });
    }
    
    document.getElementById('minesStartBtn').style.display = 'block';
    document.getElementById('minesCashoutBtn').style.display = 'none';
}

// ===== DICE GAME =====
function loadDiceGame(container) {
    container.innerHTML = `
        <div class="game-container">
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px;">
                <div>
                    <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 16px; padding: 60px; text-align: center;">
                        <div id="diceResult" style="font-size: 120px; margin-bottom: 20px;">🎲</div>
                        <div id="diceNumber" style="font-size: 48px; font-weight: 900; color: var(--accent-primary);">--</div>
                        <div id="diceStatus" style="color: var(--text-secondary); margin-top: 20px; font-size: 18px;">Roll the dice!</div>
                    </div>
                </div>
                
                <div class="bet-panel">
                    <div class="bet-input-group">
                        <label class="bet-label">Bet Amount</label>
                        <input type="number" id="diceBetAmount" class="bet-input" placeholder="0.00" min="1">
                    </div>
                    
                    <div class="bet-input-group">
                        <label class="bet-label">Roll Over</label>
                        <input type="range" id="diceRollOver" class="bet-input" min="2" max="98" value="50" oninput="updateDiceChance()">
                        <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 14px; color: var(--text-secondary);">
                            <span id="diceRollOverValue">50</span>
                            <span id="diceWinChance">49.5%</span>
                            <span id="diceMultiplier">1.86x</span>
                        </div>
                    </div>
                    
                    <button class="btn-primary" onclick="rollDice()">Roll Dice</button>
                </div>
            </div>
        </div>
    `;
    updateDiceChance();
}

function updateDiceChance() {
    const rollOver = parseInt(document.getElementById('diceRollOver').value);
    const winChance = (100 - rollOver) * DICE_EDGE;
    const multiplier = (DICE_EDGE * 100) / (100 - rollOver);
    
    document.getElementById('diceRollOverValue').textContent = rollOver;
    document.getElementById('diceWinChance').textContent = winChance.toFixed(2) + '%';
    document.getElementById('diceMultiplier').textContent = multiplier.toFixed(2) + 'x';
}

async function rollDice() {
    const amount = readAmountInput('diceBetAmount');
    const rollOver = parseInt(document.getElementById('diceRollOver').value);
    
    if (!amount || amount <= 0) {
        showNotification('Enter a valid bet amount', 'error');
        return;
    }
    
    if (amount > currentPlayer.balance) {
        showNotification('Insufficient balance', 'error');
        return;
    }

    if (!startGameAction('dice')) {
        return;
    }

    if (isBetaMode) {
        reserveDisplayedBalance(amount);
    }
    
    // Animate dice
    let rolls = 0;
    const rollInterval = setInterval(() => {
        document.getElementById('diceNumber').textContent = Math.floor(Math.random() * 100);
        rolls++;
        if (rolls >= 10) {
            clearInterval(rollInterval);
            finishDiceRoll(amount, rollOver);
        }
    }, 100);
}

async function finishDiceRoll(amount, rollOver) {
    let result;
    let won;
    let payout;

    if (isBetaMode) {
        result = Math.floor(Math.random() * 100);
        won = result > rollOver;
        const multiplier = (DICE_EDGE * 100) / (100 - rollOver);
        payout = won ? amount * multiplier : 0;
        const settlement = await settleWager({
            amount,
            payout,
            multiplier: won ? multiplier : 0,
            won,
            gameType: 'dice'
        });

        if (!settlement) {
            finishGameAction('dice');
            return;
        }
    } else {
        const playResult = await playServerGame({
            gameType: 'dice',
            amount,
            payload: { rollOver }
        });

        if (!playResult) {
            finishGameAction('dice');
            return;
        }

        result = playResult.result;
        won = !!playResult.won;
        payout = Number(playResult.payout || 0);
    }

    document.getElementById('diceNumber').textContent = result;
    
    if (won) {
        document.getElementById('diceStatus').innerHTML = `
            <span style="color: var(--accent-success); font-weight: 800;">YOU WON! +$${formatAmount(payout - amount)}</span>
        `;
        document.getElementById('diceResult').textContent = '🎉';
    } else {
        document.getElementById('diceStatus').innerHTML = `
            <span style="color: var(--accent-danger); font-weight: 800;">YOU LOST! -$${formatAmount(amount)}</span>
        `;
        document.getElementById('diceResult').textContent = '😢';
    }
    
    setTimeout(() => {
        document.getElementById('diceResult').textContent = '🎲';
        document.getElementById('diceStatus').textContent = 'Roll the dice!';
    }, 3000);
    finishGameAction('dice');
}

// ===== PLINKO GAME =====
const DEFAULT_PLINKO_ROWS = 8;
const MIN_PLINKO_ROWS = 8;
const MAX_PLINKO_ROWS = 16;
const PLINKO_RISK_CONFIG = {
    low: {
        label: 'Low Risk',
        targetEv: 0.86,
        centerFloor: 0.58,
        edgeBase: 3.4,
        edgeGrowth: 0.18,
        curve: 1.34
    },
    medium: {
        label: 'Medium Risk',
        targetEv: 0.83,
        centerFloor: 0.14,
        edgeBase: 6.4,
        edgeGrowth: 0.34,
        curve: 1.1
    },
    high: {
        label: 'High Risk',
        targetEv: 0.8,
        centerFloor: 0.03,
        edgeBase: 18,
        edgeGrowth: 0.34,
        curve: 0.92
    }
};

let plinkoCanvas = null;
let plinkoCtx = null;
let plinkoAnimating = false;
let plinkoState = {
    risk: 'medium',
    rows: DEFAULT_PLINKO_ROWS,
    ball: null,
    trail: [],
    targetBucket: null,
    buckets: []
};

function loadPlinkoGame(container) {
    container.innerHTML = `
        <div class="game-container">
            <div class="responsive-grid" style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px;">
                <div>
                    <div class="plinko-stage">
                        <canvas id="plinkoCanvas" width="860" height="540"></canvas>
                    </div>

                    <div id="plinkoBuckets" class="plinko-buckets"></div>

                    <div class="plinko-footer">
                        <div class="selector-summary">
                            <strong id="plinkoRiskLabel">Medium Risk</strong>
                            <span id="plinkoRiskSummary">Balanced spread with colder middle lanes and live edge pressure.</span>
                        </div>
                        <div id="plinkoResult" class="plinko-result">Choose a risk profile and drop the ball.</div>
                    </div>
                </div>

                <div class="bet-panel">
                    <div class="bet-input-group">
                        <label class="bet-label">Bet Amount</label>
                        <input type="number" id="plinkoBetAmount" class="bet-input" placeholder="0.00" min="1">
                    </div>

                    <div class="bet-input-group">
                        <label class="bet-label">Risk Level</label>
                        <select id="plinkoRisk" class="bet-input">
                            <option value="low">Low</option>
                            <option value="medium" selected>Medium</option>
                            <option value="high">High (Max 30x)</option>
                        </select>
                    </div>

                    <div class="bet-input-group">
                        <label class="bet-label">Board Holes</label>
                        <input type="range" id="plinkoRows" min="${MIN_PLINKO_ROWS}" max="${MAX_PLINKO_ROWS}" value="${DEFAULT_PLINKO_ROWS}">
                        <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:13px;">
                            <span style="color: var(--text-secondary);">Peg rows</span>
                            <span id="plinkoRowsLabel" style="font-weight:700;color:var(--accent-primary);">${DEFAULT_PLINKO_ROWS}</span>
                        </div>
                    </div>

                    <div class="stat-list">
                        <div class="stat-row">
                            <span class="stat-row-label">Rows</span>
                            <span class="stat-row-value" id="plinkoRowsValue">${DEFAULT_PLINKO_ROWS}</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-row-label">Buckets</span>
                            <span class="stat-row-value" id="plinkoBucketsValue">${DEFAULT_PLINKO_ROWS + 1}</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-row-label">Best Hit</span>
                            <span class="stat-row-value" id="plinkoBestHit">8x</span>
                        </div>
                    </div>

                    <button id="plinkoDropBtn" class="btn-primary" onclick="dropPlinkoBall()">
                        <i class="fas fa-circle-nodes"></i> Drop Ball
                    </button>
                </div>
            </div>
        </div>
    `;

    initPlinkoGame();
}

function initPlinkoGame() {
    plinkoCanvas = document.getElementById('plinkoCanvas');
    plinkoCtx = plinkoCanvas ? plinkoCanvas.getContext('2d') : null;
    plinkoAnimating = false;

    const riskSelect = document.getElementById('plinkoRisk');
    const rowsInput = document.getElementById('plinkoRows');
    plinkoState.risk = riskSelect ? riskSelect.value : 'medium';
    plinkoState.rows = rowsInput ? sanitizePlinkoRows(rowsInput.value) : DEFAULT_PLINKO_ROWS;
    plinkoState.ball = null;
    plinkoState.trail = [];
    plinkoState.targetBucket = null;
    plinkoState.buckets = [];

    if (riskSelect) {
        riskSelect.addEventListener('change', () => {
            if (plinkoAnimating) {
                return;
            }

            plinkoState.risk = riskSelect.value;
            updatePlinkoBoardUi();
            drawPlinkoBoard();
        });
    }

    if (rowsInput) {
        rowsInput.addEventListener('input', () => {
            if (plinkoAnimating) {
                return;
            }

            plinkoState.rows = sanitizePlinkoRows(rowsInput.value);
            updatePlinkoBoardUi();
            drawPlinkoBoard();
        });
    }

    updatePlinkoBoardUi();
    drawPlinkoBoard();
}

function sanitizePlinkoRows(value) {
    const parsed = Math.round(Number(value || DEFAULT_PLINKO_ROWS));
    return Math.max(MIN_PLINKO_ROWS, Math.min(MAX_PLINKO_ROWS, parsed));
}

function getPlinkoBinomialCoefficients(rows) {
    const coefficients = [1];

    for (let step = 1; step <= rows; step += 1) {
        coefficients[step] = (coefficients[step - 1] * (rows - step + 1)) / step;
    }

    return coefficients;
}

function buildPlinkoBuckets(risk, rows) {
    const config = PLINKO_RISK_CONFIG[risk] || PLINKO_RISK_CONFIG.medium;
    const safeRows = sanitizePlinkoRows(rows);
    const centerIndex = safeRows / 2;
    const edgePeak = config.edgeBase + Math.max(0, safeRows - DEFAULT_PLINKO_ROWS) * config.edgeGrowth;
    const rawBuckets = Array.from({ length: safeRows + 1 }, (_, index) => {
        const distance = Math.abs(index - centerIndex) / Math.max(1, safeRows / 2);
        const shapedDistance = Math.pow(distance, config.curve);
        return config.centerFloor + shapedDistance * (edgePeak - config.centerFloor);
    });
    const coefficients = getPlinkoBinomialCoefficients(safeRows);
    const totalPaths = 2 ** safeRows;
    const expectedValue = rawBuckets.reduce((total, multiplier, index) => (
        total + (coefficients[index] / totalPaths) * multiplier
    ), 0);
    const scale = expectedValue > 0 ? config.targetEv / expectedValue : 1;

    return rawBuckets.map((multiplier) => Math.round(Math.max(0.02, Math.min(30, multiplier * scale)) * 100) / 100);
}

function getPlinkoProfile(risk, rows = plinkoState.rows) {
    const config = PLINKO_RISK_CONFIG[risk] || PLINKO_RISK_CONFIG.medium;
    const safeRows = sanitizePlinkoRows(rows);
    const maxMultiplier = Math.max(...buildPlinkoBuckets(risk, safeRows));
    const riskCopy = risk === 'low'
        ? 'Safer middle buckets with cleaner recoveries.'
        : risk === 'high'
            ? 'Brutal middle lanes with sharp edge spikes.'
            : 'Balanced spread with colder middle lanes and live edge pressure.';

    return {
        label: config.label,
        description: `${riskCopy} ${safeRows + 1} holes are live on this board.`,
        multipliers: buildPlinkoBuckets(risk, safeRows),
        rows: safeRows,
        maxMultiplier
    };
}

function getPlinkoBucketColor(multiplier) {
    if (multiplier >= 10) return 'var(--accent-warning)';
    if (multiplier >= 2) return 'var(--accent-success)';
    if (multiplier >= 1) return 'var(--accent-primary)';
    return 'var(--accent-danger)';
}

function getPlinkoBucketCanvasColor(multiplier) {
    if (multiplier >= 10) return '#fbbf24';
    if (multiplier >= 2) return '#34d399';
    if (multiplier >= 1) return '#7cc7ff';
    return '#fb7185';
}

function formatGameMultiplier(multiplier) {
    if (Number.isInteger(multiplier)) {
        return `${multiplier}x`;
    }

    return `${multiplier.toFixed(multiplier >= 1 ? 1 : 2)}x`;
}

function getPlinkoGeometry() {
    const width = plinkoCanvas ? plinkoCanvas.width : 860;
    const height = plinkoCanvas ? plinkoCanvas.height : 540;
    const rows = sanitizePlinkoRows(plinkoState.rows);
    const slotCount = rows + 1;
    const centerX = width / 2;
    const sidePadding = Math.max(68, Math.min(112, width * 0.11));
    const playableWidth = width - sidePadding * 2;
    const pegSpacing = Math.min(74, Math.max(30, playableWidth / Math.max(1, slotCount - 1)));
    const startY = Math.max(42, height * 0.085);
    const laneTopY = startY + 16;
    const firstRowY = laneTopY + 30;
    const boardBottomPadding = 104;
    const rowSpacing = rows > 1
        ? Math.min(38, Math.max(18, (height - boardBottomPadding - firstRowY) / (rows - 1)))
        : 0;
    const lastRowY = firstRowY + Math.max(0, rows - 1) * rowSpacing;
    const bucketDividerTop = Math.min(height - 92, lastRowY + Math.max(24, rowSpacing * 0.95));
    const bucketBallY = Math.min(height - 54, bucketDividerTop + 18);
    const bucketLabelY = Math.min(height - 18, bucketDividerTop + 44);
    const laneBottomY = Math.min(height - 20, bucketDividerTop + 34);
    const pegRadius = Math.max(5.4, Math.min(8.5, pegSpacing * 0.18));
    const ballRadius = Math.max(9.5, pegRadius + 3.8);
    const laneLeft = centerX - ((slotCount - 1) / 2) * pegSpacing - pegSpacing * 0.56;
    const laneRight = centerX + ((slotCount - 1) / 2) * pegSpacing + pegSpacing * 0.56;

    return {
        width,
        height,
        rows,
        slotCount,
        sidePadding,
        playableWidth,
        pegSpacing,
        centerX,
        startY,
        laneTopY,
        firstRowY,
        rowSpacing,
        lastRowY,
        bucketDividerTop,
        bucketBallY,
        bucketLabelY,
        laneBottomY,
        pegRadius,
        ballRadius,
        laneLeft,
        laneRight
    };
}

function getPlinkoBucketX(index) {
    const geometry = getPlinkoGeometry();
    return geometry.centerX + (index - (geometry.slotCount - 1) / 2) * geometry.pegSpacing;
}

function buildPlinkoPath(decisions) {
    const geometry = getPlinkoGeometry();
    const path = [{ x: geometry.centerX, y: geometry.startY }];
    let currentX = geometry.centerX;

    decisions.forEach((direction, row) => {
        currentX += direction === 1 ? geometry.pegSpacing / 2 : -geometry.pegSpacing / 2;
        path.push({
            x: currentX,
            y: geometry.firstRowY + row * geometry.rowSpacing
        });
    });

    const bucketIndex = decisions.reduce((total, move) => total + move, 0);
    path.push({
        x: getPlinkoBucketX(bucketIndex),
        y: geometry.bucketBallY
    });

    return path;
}

function updatePlinkoBoardUi() {
    const profile = getPlinkoProfile(plinkoState.risk, plinkoState.rows);
    const riskLabel = document.getElementById('plinkoRiskLabel');
    const riskSummary = document.getElementById('plinkoRiskSummary');
    const bestHit = document.getElementById('plinkoBestHit');
    const buckets = document.getElementById('plinkoBuckets');
    const rowsLabel = document.getElementById('plinkoRowsLabel');
    const rowsValue = document.getElementById('plinkoRowsValue');
    const bucketsValue = document.getElementById('plinkoBucketsValue');

    plinkoState.buckets = profile.multipliers;

    if (riskLabel) {
        riskLabel.textContent = profile.label;
    }

    if (riskSummary) {
        riskSummary.textContent = profile.description;
    }

    if (bestHit) {
        bestHit.textContent = formatGameMultiplier(Math.max(...profile.multipliers));
    }

    if (rowsLabel) {
        rowsLabel.textContent = `${profile.rows}`;
    }

    const rowsInput = document.getElementById('plinkoRows');
    if (rowsInput) {
        rowsInput.value = `${profile.rows}`;
    }

    if (rowsValue) {
        rowsValue.textContent = `${profile.rows}`;
    }

    if (bucketsValue) {
        bucketsValue.textContent = `${profile.rows + 1}`;
    }

    if (buckets) {
        buckets.innerHTML = profile.multipliers.map((multiplier, index) => {
            const toneClass = multiplier >= 10
                ? 'is-jackpot'
                : multiplier >= 1
                    ? 'is-positive'
                    : 'is-negative';

            return `
                <div
                    class="plinko-bucket ${toneClass}"
                    data-bucket-index="${index}"
                    style="--bucket-color: ${getPlinkoBucketColor(multiplier)};"
                >
                    <span>${formatGameMultiplier(multiplier)}</span>
                </div>
            `;
        }).join('');
    }

    setPlinkoHighlightedBucket(plinkoState.targetBucket);
}

function setPlinkoHighlightedBucket(bucketIndex = null) {
    document.querySelectorAll('#plinkoBuckets .plinko-bucket').forEach((bucket, index) => {
        bucket.classList.toggle('active', bucketIndex === index);
    });
}

function drawPlinkoBoard() {
    if (!plinkoCtx || !plinkoCanvas) {
        return;
    }

    const geometry = getPlinkoGeometry();
    const profile = getPlinkoProfile(plinkoState.risk, plinkoState.rows);

    plinkoCtx.clearRect(0, 0, geometry.width, geometry.height);

    const background = plinkoCtx.createLinearGradient(0, 0, 0, geometry.height);
    background.addColorStop(0, '#06111d');
    background.addColorStop(1, '#0f2033');
    plinkoCtx.fillStyle = background;
    plinkoCtx.fillRect(0, 0, geometry.width, geometry.height);

    const glow = plinkoCtx.createRadialGradient(
        geometry.centerX,
        geometry.firstRowY,
        20,
        geometry.centerX,
        geometry.firstRowY,
        geometry.width * 0.4
    );
    glow.addColorStop(0, 'rgba(103, 232, 249, 0.18)');
    glow.addColorStop(1, 'rgba(103, 232, 249, 0)');
    plinkoCtx.fillStyle = glow;
    plinkoCtx.fillRect(0, 0, geometry.width, geometry.height);

    plinkoCtx.fillStyle = 'rgba(6, 18, 31, 0.42)';
    plinkoCtx.strokeStyle = 'rgba(124, 199, 255, 0.16)';
    plinkoCtx.lineWidth = 3;
    plinkoCtx.beginPath();
    plinkoCtx.moveTo(geometry.centerX, geometry.startY - 4);
    plinkoCtx.lineTo(geometry.laneRight, geometry.bucketDividerTop + 12);
    plinkoCtx.lineTo(geometry.laneRight, geometry.laneBottomY);
    plinkoCtx.lineTo(geometry.laneLeft, geometry.laneBottomY);
    plinkoCtx.lineTo(geometry.laneLeft, geometry.bucketDividerTop + 12);
    plinkoCtx.closePath();
    plinkoCtx.fill();
    plinkoCtx.stroke();

    plinkoCtx.strokeStyle = 'rgba(124, 199, 255, 0.22)';
    plinkoCtx.lineWidth = 4;
    plinkoCtx.beginPath();
    plinkoCtx.moveTo(geometry.centerX, geometry.startY - 4);
    plinkoCtx.lineTo(geometry.laneLeft, geometry.bucketDividerTop + 12);
    plinkoCtx.moveTo(geometry.centerX, geometry.startY - 4);
    plinkoCtx.lineTo(geometry.laneRight, geometry.bucketDividerTop + 12);
    plinkoCtx.stroke();

    const bucketSlotTop = geometry.bucketDividerTop + 8;
    const bucketSlotHeight = geometry.laneBottomY - bucketSlotTop;

    for (let bucket = 0; bucket < profile.multipliers.length; bucket++) {
        const x = getPlinkoBucketX(bucket);
        const isHot = plinkoState.targetBucket === bucket;
        const accent = getPlinkoBucketCanvasColor(profile.multipliers[bucket]);
        const slotWidth = geometry.pegSpacing * 0.84;

        plinkoCtx.fillStyle = isHot ? 'rgba(124, 199, 255, 0.14)' : 'rgba(255, 255, 255, 0.03)';
        plinkoCtx.strokeStyle = isHot ? 'rgba(124, 199, 255, 0.46)' : 'rgba(124, 199, 255, 0.1)';
        plinkoCtx.lineWidth = isHot ? 2.5 : 1.5;
        plinkoCtx.beginPath();
        plinkoCtx.rect(x - slotWidth / 2, bucketSlotTop, slotWidth, bucketSlotHeight);
        plinkoCtx.fill();
        plinkoCtx.stroke();

        if (isHot) {
            plinkoCtx.shadowBlur = 22;
            plinkoCtx.shadowColor = 'rgba(124, 199, 255, 0.45)';
            plinkoCtx.stroke();
            plinkoCtx.shadowBlur = 0;
        }

        plinkoCtx.fillStyle = isHot ? accent : 'rgba(255, 255, 255, 0.68)';
        plinkoCtx.font = `700 ${Math.max(10, Math.min(13, geometry.pegSpacing * 0.24))}px Sora`;
        plinkoCtx.textAlign = 'center';
        plinkoCtx.fillText(formatGameMultiplier(profile.multipliers[bucket]), x, geometry.bucketLabelY);
    }

    plinkoCtx.strokeStyle = 'rgba(124, 199, 255, 0.12)';
    plinkoCtx.lineWidth = 1.5;
    for (let divider = 0; divider <= geometry.slotCount; divider++) {
        const x = geometry.laneLeft + divider * geometry.pegSpacing;
        plinkoCtx.beginPath();
        plinkoCtx.moveTo(x, geometry.bucketDividerTop - 10);
        plinkoCtx.lineTo(x, geometry.laneBottomY);
        plinkoCtx.stroke();
    }

    for (let row = 0; row < plinkoState.rows; row++) {
        const pegCount = row + 1;
        const y = geometry.firstRowY + row * geometry.rowSpacing;

        for (let peg = 0; peg < pegCount; peg++) {
            const x = geometry.centerX + (peg - row / 2) * geometry.pegSpacing;
            const isNearBall = plinkoState.ball && Math.hypot(plinkoState.ball.x - x, plinkoState.ball.y - y) < geometry.ballRadius + 12;

            plinkoCtx.beginPath();
            plinkoCtx.arc(x, y, geometry.pegRadius, 0, Math.PI * 2);
            plinkoCtx.fillStyle = isNearBall
                ? 'rgba(103, 232, 249, 0.95)'
                : 'rgba(205, 229, 255, 0.88)';
            plinkoCtx.shadowBlur = isNearBall ? 18 : 8;
            plinkoCtx.shadowColor = isNearBall ? 'rgba(103, 232, 249, 0.75)' : 'rgba(124, 199, 255, 0.35)';
            plinkoCtx.fill();
        }
    }

    plinkoCtx.shadowBlur = 0;

    if (plinkoState.trail.length > 1) {
        for (let index = 1; index < plinkoState.trail.length; index++) {
            const from = plinkoState.trail[index - 1];
            const to = plinkoState.trail[index];
            const alpha = index / plinkoState.trail.length;

            plinkoCtx.beginPath();
            plinkoCtx.moveTo(from.x, from.y);
            plinkoCtx.lineTo(to.x, to.y);
            plinkoCtx.lineWidth = 2 + alpha * 3;
            plinkoCtx.strokeStyle = `rgba(103, 232, 249, ${alpha * 0.55})`;
            plinkoCtx.stroke();
        }
    }

    if (plinkoState.ball) {
        plinkoCtx.beginPath();
        plinkoCtx.arc(plinkoState.ball.x, plinkoState.ball.y, geometry.ballRadius, 0, Math.PI * 2);
        const ballGlow = plinkoCtx.createRadialGradient(
            plinkoState.ball.x - 4,
            plinkoState.ball.y - 4,
            2,
            plinkoState.ball.x,
            plinkoState.ball.y,
            geometry.ballRadius + 6
        );
        ballGlow.addColorStop(0, '#ffffff');
        ballGlow.addColorStop(0.35, '#7cc7ff');
        ballGlow.addColorStop(1, '#38bdf8');
        plinkoCtx.fillStyle = ballGlow;
        plinkoCtx.shadowBlur = 22;
        plinkoCtx.shadowColor = 'rgba(124, 199, 255, 0.82)';
        plinkoCtx.fill();
        plinkoCtx.shadowBlur = 0;
    }

    plinkoCtx.strokeStyle = 'rgba(124, 199, 255, 0.26)';
    plinkoCtx.lineWidth = 3;
    plinkoCtx.beginPath();
    plinkoCtx.moveTo(geometry.centerX - geometry.pegSpacing * 0.75, geometry.startY + 2);
    plinkoCtx.lineTo(geometry.centerX, geometry.startY - 10);
    plinkoCtx.lineTo(geometry.centerX + geometry.pegSpacing * 0.75, geometry.startY + 2);
    plinkoCtx.stroke();
}

function animatePlinkoPath(path) {
    return new Promise((resolve) => {
        const geometry = getPlinkoGeometry();
        let segmentIndex = 0;
        let segmentStart = performance.now();
        const segmentDuration = Math.max(118, 156 - geometry.rows * 2);
        const bounceHeight = Math.max(6, Math.min(14, geometry.rowSpacing * 0.3 || 10));

        plinkoState.ball = { ...path[0] };
        plinkoState.trail = [{ ...path[0] }];

        function step(now) {
            const from = path[segmentIndex];
            const to = path[segmentIndex + 1];
            const rawProgress = Math.min((now - segmentStart) / segmentDuration, 1);
            const easedProgress = 1 - Math.pow(1 - rawProgress, 3);

            plinkoState.ball = {
                x: from.x + (to.x - from.x) * easedProgress,
                y: from.y + (to.y - from.y) * easedProgress - Math.sin(rawProgress * Math.PI) * bounceHeight
            };
            plinkoState.trail.push({ ...plinkoState.ball });

            if (plinkoState.trail.length > 28) {
                plinkoState.trail.shift();
            }

            drawPlinkoBoard();

            if (rawProgress >= 1) {
                segmentIndex++;
                segmentStart = now;

                if (segmentIndex < path.length - 1) {
                    playGameSound('plinko-hit');
                }

                if (segmentIndex >= path.length - 1) {
                    plinkoState.ball = { ...path[path.length - 1] };
                    drawPlinkoBoard();
                    resolve();
                    return;
                }
            }

            requestAnimationFrame(step);
        }

        requestAnimationFrame(step);
    });
}

async function dropPlinkoBall() {
    const amount = readAmountInput('plinkoBetAmount');
    const riskSelect = document.getElementById('plinkoRisk');
    const rowsInput = document.getElementById('plinkoRows');
    const dropButton = document.getElementById('plinkoDropBtn');
    const result = document.getElementById('plinkoResult');
    const risk = riskSelect ? riskSelect.value : 'medium';
    const rows = rowsInput ? sanitizePlinkoRows(rowsInput.value) : plinkoState.rows;

    if (plinkoAnimating) {
        return;
    }

    if (!amount || amount <= 0) {
        showNotification('Enter a valid bet amount', 'error');
        return;
    }

    if (amount > currentPlayer.balance) {
        showNotification('Insufficient balance', 'error');
        return;
    }

    if (!startGameAction('plinko', LONG_GAME_COOLDOWN_MS)) {
        return;
    }

    plinkoAnimating = true;
    plinkoState.risk = risk;
    plinkoState.rows = rows;
    plinkoState.targetBucket = null;
    updatePlinkoBoardUi();

    if (isBetaMode) {
        reserveDisplayedBalance(amount);
    }

    if (dropButton) {
        dropButton.disabled = true;
        dropButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Dropping...';
    }

    if (riskSelect) {
        riskSelect.disabled = true;
    }

    if (rowsInput) {
        rowsInput.disabled = true;
    }

    if (result) {
        result.textContent = 'Ball is in the air...';
    }

    playGameSound('bet-place');
    playGameSound('plinko-drop');

    let decisions;
    let bucketIndex;
    let multiplier;
    let payout;

    if (isBetaMode) {
        decisions = Array.from({ length: rows }, () => (Math.random() < 0.5 ? 0 : 1));
        bucketIndex = decisions.reduce((total, move) => total + move, 0);
        const profile = getPlinkoProfile(risk, rows);
        multiplier = profile.multipliers[bucketIndex];
        payout = amount * multiplier;
    } else {
        const playResult = await playServerGame({
            gameType: 'plinko',
            amount,
            payload: { risk, rows }
        });

        if (!playResult) {
            plinkoAnimating = false;
            finishGameAction('plinko', LONG_GAME_COOLDOWN_MS);
            if (dropButton) {
                dropButton.disabled = false;
                dropButton.innerHTML = '<i class="fas fa-circle-nodes"></i> Drop Ball';
            }
            if (riskSelect) {
                riskSelect.disabled = false;
            }
            if (rowsInput) {
                rowsInput.disabled = false;
            }
            return;
        }

        decisions = Array.isArray(playResult.decisions) ? playResult.decisions : [];
        plinkoState.rows = sanitizePlinkoRows(playResult.rows || rows);
        bucketIndex = Number(playResult.bucketIndex || 0);
        multiplier = Number(playResult.multiplier || 0);
        payout = Number(playResult.payout || 0);
        updatePlinkoBoardUi();
    }

    const path = buildPlinkoPath(decisions);

    await animatePlinkoPath(path);

    plinkoState.targetBucket = bucketIndex;
    setPlinkoHighlightedBucket(bucketIndex);
    drawPlinkoBoard();

    const profit = payout - amount;
    const notificationType = profit > 0 ? 'success' : profit < 0 ? 'error' : 'info';
    const settlement = isBetaMode
        ? await settleWager({
            amount,
            payout,
            multiplier,
            won: payout >= amount,
            gameType: 'plinko'
        })
        : { success: true };

    if (settlement) {
        if (result) {
            result.innerHTML = `
                <span style="color: ${profit > 0 ? 'var(--accent-success)' : profit < 0 ? 'var(--accent-danger)' : 'var(--accent-primary)'};">
                    ${formatGameMultiplier(multiplier)} - ${profit > 0 ? '+' : profit < 0 ? '-' : ''}$${formatAmount(Math.abs(profit))}
                </span>
            `;
        }

        showNotification(
            profit > 0
                ? `Plinko hit ${formatGameMultiplier(multiplier)} for +$${formatAmount(profit)}`
                : profit < 0
                    ? `Plinko landed ${formatGameMultiplier(multiplier)} for -$${formatAmount(Math.abs(profit))}`
                    : `Plinko landed exactly on ${formatGameMultiplier(multiplier)}`,
            notificationType
        );
        playGameSound(profit > 0 ? 'cashout' : profit < 0 ? 'explode' : 'button');
    }

    plinkoAnimating = false;
    finishGameAction('plinko', LONG_GAME_COOLDOWN_MS);

    if (dropButton) {
        dropButton.disabled = false;
        dropButton.innerHTML = '<i class="fas fa-circle-nodes"></i> Drop Ball';
    }

    if (riskSelect) {
        riskSelect.disabled = false;
    }

    if (rowsInput) {
        rowsInput.disabled = false;
    }

    setTimeout(() => {
        if (!plinkoAnimating) {
            plinkoState.ball = null;
            plinkoState.trail = [];
            plinkoState.targetBucket = null;
            setPlinkoHighlightedBucket(null);
            drawPlinkoBoard();
        }
    }, 3200);
}

// Placeholder loaders for other games
function loadTowersGame(container) {
    container.innerHTML = `
        <div class="game-container">
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px;">
                <div>
                    <div id="towersGrid" style="display: flex; flex-direction: column-reverse; gap: 12px;"></div>
                    <div id="towersResult" style="text-align: center; font-size: 24px; font-weight: 800; margin-top: 20px;"></div>
                </div>
                
                <div class="bet-panel">
                    <div class="bet-input-group">
                        <label class="bet-label">Bet Amount</label>
                        <input type="number" id="towersBetAmount" class="bet-input" placeholder="0.00" min="1">
                    </div>
                    
                    <div class="bet-input-group">
                        <label class="bet-label">Difficulty</label>
                        <select id="towersDifficulty" class="bet-input">
                            <option value="easy">Easy (3 tiles)</option>
                            <option value="medium">Medium (2 tiles)</option>
                            <option value="hard">Hard (1 tile)</option>
                        </select>
                    </div>
                    
                    <div id="towersMultiplier" style="text-align: center; font-size: 32px; font-weight: 900; color: var(--accent-success); margin: 20px 0;">1.00x</div>
                    
                    <button id="towersStartBtn" class="btn-primary" onclick="startTowersGame()">Start Game</button>
                    <button id="towersCashoutBtn" class="btn-danger" onclick="towersCashout()" style="display: none; margin-top: 12px;">Cash Out</button>
                </div>
            </div>
        </div>
    `;
    createTowersGrid();
}

let towersGameActive = false;
let towersBetAmount = 0;
let towersLevel = 0;
let towersMultiplier = 1.00;
let towersSafeTiles = [];

function createTowersGrid() {
    const grid = document.getElementById('towersGrid');
    grid.innerHTML = '';
    
    for (let level = 0; level < 8; level++) {
        const row = document.createElement('div');
        row.style.cssText = 'display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;';
        
        for (let i = 0; i < 4; i++) {
            const tile = document.createElement('div');
            tile.className = 'towers-tile';
            tile.style.cssText = `
                aspect-ratio: 1;
                background: var(--bg-secondary);
                border: 2px solid var(--border-color);
                border-radius: 12px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 24px;
                transition: all 0.3s;
            `;
            tile.dataset.level = level;
            tile.dataset.index = i;
            tile.onclick = () => selectTowersTile(level, i, tile);
            row.appendChild(tile);
        }
        
        grid.appendChild(row);
    }
}

function startTowersGame() {
    const amount = readAmountInput('towersBetAmount');
    const difficulty = document.getElementById('towersDifficulty').value;
    
    if (!amount || amount <= 0) {
        showNotification('Enter a valid bet amount', 'error');
        return;
    }
    
    if (amount > currentPlayer.balance) {
        showNotification('Insufficient balance', 'error');
        return;
    }

    if (towersGameActive || !startGameAction('towers', LONG_GAME_COOLDOWN_MS)) {
        return;
    }
    
    towersBetAmount = amount;
    towersGameActive = true;
    towersLevel = 0;
    towersMultiplier = 1.00;
    reserveDisplayedBalance(amount);
    
    // Generate safe tiles for each level
    const safeTilesCount = difficulty === 'easy' ? 3 : difficulty === 'medium' ? 2 : 1;
    towersSafeTiles = [];
    
    for (let level = 0; level < 8; level++) {
        const safe = [];
        while (safe.length < safeTilesCount) {
            const tile = Math.floor(Math.random() * 4);
            if (!safe.includes(tile)) safe.push(tile);
        }
        towersSafeTiles.push(safe);
    }
    
    createTowersGrid();
    document.getElementById('towersStartBtn').style.display = 'none';
    document.getElementById('towersCashoutBtn').style.display = 'block';
    document.getElementById('towersResult').textContent = '';
}

function selectTowersTile(level, index, tile) {
    if (!towersGameActive || level !== towersLevel || tile.classList.contains('revealed')) return;
    
    tile.classList.add('revealed');
    
    if (towersSafeTiles[level].includes(index)) {
        tile.textContent = '✨';
        tile.style.background = 'var(--accent-success)';
        tile.style.borderColor = 'var(--accent-success)';
        towersLevel++;
        towersMultiplier = 1 + (towersLevel * TOWERS_STEP_MULTIPLIER);
        document.getElementById('towersMultiplier').textContent = towersMultiplier.toFixed(2) + 'x';
        
        if (towersLevel >= 8) {
            towersCashout();
        }
    } else {
        tile.textContent = '💀';
        tile.style.background = 'var(--accent-danger)';
        tile.style.borderColor = 'var(--accent-danger)';
        towersGameEnd(false);
    }
}

function towersCashout() {
    if (!towersGameActive) return;
    towersGameEnd(true);
}

async function towersGameEnd(won) {
    towersGameActive = false;
    finishGameAction('towers', LONG_GAME_COOLDOWN_MS);

    const payout = won ? towersBetAmount * towersMultiplier : 0;
    const settlement = await settleWager({
        amount: towersBetAmount,
        payout,
        multiplier: won ? towersMultiplier : 0,
        won,
        gameType: 'towers'
    });

    if (!settlement) {
        document.getElementById('towersStartBtn').style.display = 'block';
        document.getElementById('towersCashoutBtn').style.display = 'none';
        return;
    }
    
    if (won) {
        showNotification(`Won! +$${formatAmount(payout - towersBetAmount)}`, 'success');
        document.getElementById('towersResult').innerHTML = `
            <span style="color: var(--accent-success);">WON! +$${formatAmount(payout - towersBetAmount)}</span>
        `;
    } else {
        showNotification(`Lost! -$${formatAmount(towersBetAmount)}`, 'error');
        document.getElementById('towersResult').innerHTML = `
            <span style="color: var(--accent-danger);">LOST! -$${formatAmount(towersBetAmount)}</span>
        `;
        
        // Reveal all safe tiles
        const tiles = document.querySelectorAll('.towers-tile');
        tiles.forEach(tile => {
            const level = parseInt(tile.dataset.level);
            const index = parseInt(tile.dataset.index);
            if (towersSafeTiles[level] && towersSafeTiles[level].includes(index)) {
                tile.textContent = '✨';
                tile.style.background = 'rgba(16, 185, 129, 0.2)';
            }
        });
    }
    
    document.getElementById('towersStartBtn').style.display = 'block';
    document.getElementById('towersCashoutBtn').style.display = 'none';
}

function loadRouletteGame(container) {
    container.innerHTML = `
        <div class="game-container">
            <div class="responsive-grid" style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px;">
                <div class="roulette-stage">
                    <div class="roulette-wheel-shell">
                        <canvas id="rouletteCanvas" width="420" height="420"></canvas>
                        <div class="roulette-pointer" aria-hidden="true"></div>
                        <div class="roulette-wheel-core">
                            <span class="roulette-core-label">Result</span>
                            <strong id="rouletteResult">READY</strong>
                        </div>
                    </div>
                    <div id="rouletteStatus" class="roulette-status">Pick a color and let the pointer call the final slot.</div>
                </div>

                <div class="bet-panel">
                    <div class="bet-input-group">
                        <label class="bet-label">Bet Amount</label>
                        <input type="number" id="rouletteBetAmount" class="bet-input" placeholder="0.00" min="1">
                    </div>

                    <div class="bet-input-group">
                        <label class="bet-label">Choose Color</label>
                        <div class="roulette-color-grid">
                            <button class="quick-bet-btn roulette-color-btn is-red" onclick="spinRoulette('red')">
                                <span>Red</span>
                                <strong>1.78x</strong>
                            </button>
                            <button class="quick-bet-btn roulette-color-btn is-black" onclick="spinRoulette('black')">
                                <span>Black</span>
                                <strong>1.78x</strong>
                            </button>
                            <button class="quick-bet-btn roulette-color-btn is-green" onclick="spinRoulette('green')">
                                <span>Green</span>
                                <strong>8x</strong>
                            </button>
                        </div>
                    </div>

                    <div class="stat-list">
                        <div class="stat-row">
                            <span class="stat-row-label">Red / Black</span>
                            <span class="stat-row-value">7 slots each</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-row-label">Green</span>
                            <span class="stat-row-value">1 slot</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-row-label">Pointer</span>
                            <span class="stat-row-value">Top lock</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    initRouletteGame();
}

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

let rouletteCanvas = null;
let rouletteCtx = null;
let rouletteRotation = 0;
let rouletteSpinning = false;

function initRouletteGame() {
    rouletteCanvas = document.getElementById('rouletteCanvas');
    rouletteCtx = rouletteCanvas ? rouletteCanvas.getContext('2d') : null;
    rouletteRotation = 0;
    rouletteSpinning = false;
    drawRouletteWheel();
}

function normalizeRouletteAngle(angle) {
    const fullTurn = Math.PI * 2;
    return ((angle % fullTurn) + fullTurn) % fullTurn;
}

function getRouletteWinningIndex() {
    const segmentAngle = (Math.PI * 2) / ROULETTE_SEGMENTS.length;
    return Math.floor(normalizeRouletteAngle(-rouletteRotation) / segmentAngle) % ROULETTE_SEGMENTS.length;
}

function getRouletteColorAccent(color) {
    if (color === 'red') return '#fb7185';
    if (color === 'green') return '#34d399';
    return '#cbd5f5';
}

function disableRouletteControls(disabled) {
    document.querySelectorAll('.roulette-color-btn').forEach((button) => {
        button.disabled = disabled;
    });

    const amountInput = document.getElementById('rouletteBetAmount');
    if (amountInput) {
        amountInput.disabled = disabled;
    }
}

function drawRouletteWheel() {
    if (!rouletteCtx || !rouletteCanvas) {
        return;
    }

    const width = rouletteCanvas.width;
    const height = rouletteCanvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const outerRadius = 184;
    const innerRadius = 84;
    const segmentAngle = (Math.PI * 2) / ROULETTE_SEGMENTS.length;

    rouletteCtx.clearRect(0, 0, width, height);

    const background = rouletteCtx.createRadialGradient(centerX, centerY, 0, centerX, centerY, outerRadius + 20);
    background.addColorStop(0, '#112033');
    background.addColorStop(1, '#08111c');
    rouletteCtx.fillStyle = background;
    rouletteCtx.fillRect(0, 0, width, height);

    rouletteCtx.save();
    rouletteCtx.translate(centerX, centerY);
    rouletteCtx.rotate(rouletteRotation);

    ROULETTE_SEGMENTS.forEach((segment, index) => {
        const startAngle = -Math.PI / 2 + index * segmentAngle;
        const endAngle = startAngle + segmentAngle;
        const accent = getRouletteColorAccent(segment.color);
        const fill = rouletteCtx.createLinearGradient(0, -outerRadius, 0, outerRadius);

        if (segment.color === 'red') {
            fill.addColorStop(0, '#fb7185');
            fill.addColorStop(1, '#be123c');
        } else if (segment.color === 'green') {
            fill.addColorStop(0, '#34d399');
            fill.addColorStop(1, '#047857');
        } else {
            fill.addColorStop(0, '#1e293b');
            fill.addColorStop(1, '#020617');
        }

        rouletteCtx.beginPath();
        rouletteCtx.moveTo(0, 0);
        rouletteCtx.arc(0, 0, outerRadius, startAngle, endAngle);
        rouletteCtx.closePath();
        rouletteCtx.fillStyle = fill;
        rouletteCtx.fill();

        rouletteCtx.lineWidth = 3;
        rouletteCtx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        rouletteCtx.stroke();

        rouletteCtx.save();
        rouletteCtx.rotate(startAngle + segmentAngle / 2);
        rouletteCtx.fillStyle = '#f8fbff';
        rouletteCtx.font = '700 18px Sora';
        rouletteCtx.textAlign = 'center';
        rouletteCtx.shadowBlur = 14;
        rouletteCtx.shadowColor = accent;
        rouletteCtx.fillText(segment.label, outerRadius - 42, 6);
        rouletteCtx.restore();
    });

    rouletteCtx.restore();

    rouletteCtx.beginPath();
    rouletteCtx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
    rouletteCtx.fillStyle = '#06111d';
    rouletteCtx.fill();
    rouletteCtx.lineWidth = 8;
    rouletteCtx.strokeStyle = 'rgba(124, 199, 255, 0.42)';
    rouletteCtx.stroke();

    rouletteCtx.beginPath();
    rouletteCtx.arc(centerX, centerY, outerRadius + 10, 0, Math.PI * 2);
    rouletteCtx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    rouletteCtx.lineWidth = 12;
    rouletteCtx.stroke();
}

function getRouletteTargetRotation(targetIndex) {
    const fullTurn = Math.PI * 2;
    const segmentAngle = fullTurn / ROULETTE_SEGMENTS.length;
    const desired = normalizeRouletteAngle(-(targetIndex + 0.5) * segmentAngle);
    const current = normalizeRouletteAngle(rouletteRotation);
    let delta = desired - current;

    if (delta <= 0) {
        delta += fullTurn;
    }

    delta += fullTurn * (5 + Math.random() * 2.2);
    return rouletteRotation + delta;
}

function animateRouletteSpin(targetRotation, duration = 4200) {
    return new Promise((resolve) => {
        const startRotation = rouletteRotation;
        const startTime = performance.now();

        function step(now) {
            const progress = Math.min((now - startTime) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 4);
            rouletteRotation = startRotation + (targetRotation - startRotation) * eased;
            drawRouletteWheel();

            if (progress < 1) {
                requestAnimationFrame(step);
            } else {
                resolve();
            }
        }

        requestAnimationFrame(step);
    });
}

async function spinRoulette(color) {
    const amount = readAmountInput('rouletteBetAmount');
    const result = document.getElementById('rouletteResult');
    const status = document.getElementById('rouletteStatus');

    if (rouletteSpinning) {
        return;
    }

    if (!amount || amount <= 0) {
        showNotification('Enter a valid bet amount', 'error');
        return;
    }

    if (amount > currentPlayer.balance) {
        showNotification('Insufficient balance', 'error');
        return;
    }

    if (!startGameAction('roulette', LONG_GAME_COOLDOWN_MS)) {
        return;
    }

    rouletteSpinning = true;
    if (isBetaMode) {
        reserveDisplayedBalance(amount);
    }
    disableRouletteControls(true);

    if (result) {
        result.textContent = 'SPIN';
        result.style.color = 'var(--text-primary)';
    }

    if (status) {
        status.textContent = 'Wheel is moving... pointer decides the final slot.';
    }

    playGameSound('bet-place');
    playGameSound('spin-start');

    let targetIndex;
    let winningSegment;
    let won;
    let payout;
    let multiplier;

    if (isBetaMode) {
        targetIndex = Math.floor(Math.random() * ROULETTE_SEGMENTS.length);
    } else {
        const playResult = await playServerGame({
            gameType: 'roulette',
            amount,
            payload: { color }
        });

        if (!playResult) {
            rouletteSpinning = false;
            finishGameAction('roulette', LONG_GAME_COOLDOWN_MS);
            disableRouletteControls(false);
            return;
        }

        targetIndex = Number(playResult.winningIndex || 0);
        winningSegment = playResult.winningSegment;
        won = !!playResult.won;
        payout = Number(playResult.payout || 0);
        multiplier = won ? Number(playResult.multiplier || 0) : 0;
    }

    const targetRotation = getRouletteTargetRotation(targetIndex);
    await animateRouletteSpin(targetRotation);

    if (isBetaMode) {
        const winningIndex = getRouletteWinningIndex();
        winningSegment = ROULETTE_SEGMENTS[winningIndex];
        multiplier = ROULETTE_PAYOUTS[winningSegment.color] || 0;
        won = winningSegment.color === color;
        payout = won ? amount * multiplier : 0;
    }

    const profit = payout - amount;
    const settlement = isBetaMode
        ? await settleWager({
            amount,
            payout,
            multiplier: won ? multiplier : 0,
            won,
            gameType: 'roulette'
        })
        : { success: true };

    if (result) {
        result.textContent = winningSegment.color.toUpperCase();
        result.style.color = getRouletteColorAccent(winningSegment.color);
    }

    if (settlement) {
        if (status) {
            status.innerHTML = won
                ? `<span style="color: var(--accent-success);">${winningSegment.color.toUpperCase()} hit &middot; +$${formatAmount(profit)}</span>`
                : `<span style="color: var(--accent-danger);">${winningSegment.color.toUpperCase()} hit &middot; -$${formatAmount(amount)}</span>`;
        }

        showNotification(
            won
                ? `Roulette hit ${winningSegment.color} for +$${formatAmount(profit)}`
                : `Roulette hit ${winningSegment.color}. Lost $${formatAmount(amount)}`,
            won ? 'success' : 'error'
        );
    }

    playGameSound('spin-stop');
    rouletteSpinning = false;
    finishGameAction('roulette', LONG_GAME_COOLDOWN_MS);
    disableRouletteControls(false);
}

function loadBlackjackGame(container) {
    blackjackDeck = [];
    blackjackPlayerHand = [];
    blackjackDealerHand = [];
    blackjackBetAmount = 0;
    blackjackGameActive = false;
    blackjackResolving = false;

    container.innerHTML = `
        <div class="game-container">
            <div class="responsive-grid" style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px;">
                <div>
                    <div class="blackjack-table">
                        <div class="blackjack-seat">
                            <div class="bet-label">Dealer</div>
                            <div id="dealerCards" class="blackjack-hand"></div>
                            <div id="dealerScore" class="blackjack-score is-dealer">0</div>
                        </div>

                        <div class="blackjack-seat">
                            <div class="bet-label">Your Hand</div>
                            <div id="playerCards" class="blackjack-hand"></div>
                            <div id="playerScore" class="blackjack-score is-player">0</div>
                        </div>
                    </div>

                    <div id="blackjackResult" class="blackjack-result"></div>

                    <div id="blackjackActions" class="blackjack-actions" style="display: none;">
                        <button id="blackjackHitBtn" class="btn-primary" onclick="blackjackHit()">Hit</button>
                        <button id="blackjackStandBtn" class="btn-danger" onclick="blackjackStand()">Stand</button>
                        <button id="blackjackDoubleBtn" class="btn-primary blackjack-double-btn" onclick="blackjackDouble()">Double</button>
                    </div>
                </div>

                <div class="bet-panel">
                    <div class="bet-input-group">
                        <label class="bet-label">Bet Amount</label>
                        <input type="number" id="blackjackBetAmount" class="bet-input" placeholder="0.00" min="1">
                    </div>

                    <button id="blackjackDealBtn" class="btn-primary" onclick="dealBlackjack()">
                        <i class="fas fa-shuffle"></i> Deal Cards
                    </button>

                    <div class="stat-list">
                        <div class="stat-row">
                            <span class="stat-row-label">Blackjack</span>
                            <span class="stat-row-value">6:5 payout</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-row-label">Dealer Rule</span>
                            <span class="stat-row-value">Stand on 17</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-row-label">Double Down</span>
                            <span class="stat-row-value">One card only</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

const BLACKJACK_SUIT_META = {
    spades: { symbol: '♠', red: false },
    hearts: { symbol: '♥', red: true },
    diamonds: { symbol: '♦', red: true },
    clubs: { symbol: '♣', red: false }
};

let blackjackDeck = [];
let blackjackPlayerHand = [];
let blackjackDealerHand = [];
let blackjackBetAmount = 0;
let blackjackGameActive = false;
let blackjackResolving = false;

function waitForGameDelay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function setBlackjackActionState(disabled) {
    ['blackjackHitBtn', 'blackjackStandBtn', 'blackjackDoubleBtn'].forEach((id) => {
        const button = document.getElementById(id);
        if (button) {
            button.disabled = disabled;
        }
    });
}

function createBlackjackDeck() {
    const suits = ['spades', 'hearts', 'diamonds', 'clubs'];
    const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    blackjackDeck = [];

    for (const suit of suits) {
        for (const value of values) {
            blackjackDeck.push({ suit, value });
        }
    }

    for (let i = blackjackDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [blackjackDeck[i], blackjackDeck[j]] = [blackjackDeck[j], blackjackDeck[i]];
    }

    playGameSound('shuffle');
}

function drawBlackjackCard() {
    return blackjackDeck.pop();
}

function getBlackjackValue(hand) {
    let value = 0;
    let aces = 0;

    for (const card of hand) {
        if (card.value === 'A') {
            aces++;
            value += 11;
        } else if (['J', 'Q', 'K'].includes(card.value)) {
            value += 10;
        } else {
            value += parseInt(card.value, 10);
        }
    }

    while (value > 21 && aces > 0) {
        value -= 10;
        aces--;
    }

    return value;
}

function displayBlackjackCard(card, hidden = false) {
    if (hidden) {
        return `
            <div class="blackjack-card blackjack-card-hidden">
                <div class="blackjack-card-back-pattern"></div>
            </div>
        `;
    }

    const suit = BLACKJACK_SUIT_META[card.suit] || BLACKJACK_SUIT_META.spades;
    const toneClass = suit.red ? 'is-red' : 'is-dark';

    return `
        <div class="blackjack-card ${toneClass}">
            <div class="blackjack-card-corner">
                <span>${card.value}</span>
                <span>${suit.symbol}</span>
            </div>
            <div class="blackjack-card-center">
                <span class="blackjack-card-rank">${card.value}</span>
                <span class="blackjack-card-suit">${suit.symbol}</span>
            </div>
            <div class="blackjack-card-corner blackjack-card-corner-bottom">
                <span>${card.value}</span>
                <span>${suit.symbol}</span>
            </div>
        </div>
    `;
}

function dealBlackjack() {
    const amount = readAmountInput('blackjackBetAmount');

    if (blackjackGameActive || blackjackResolving) {
        return;
    }

    if (!amount || amount <= 0) {
        showNotification('Enter a valid bet amount', 'error');
        return;
    }

    if (amount > currentPlayer.balance) {
        showNotification('Insufficient balance', 'error');
        return;
    }

    if (!startGameAction('blackjack', LONG_GAME_COOLDOWN_MS)) {
        return;
    }

    blackjackBetAmount = amount;
    blackjackGameActive = true;
    blackjackResolving = false;
    reserveDisplayedBalance(amount);
    playGameSound('bet-place');

    createBlackjackDeck();
    blackjackPlayerHand = [drawBlackjackCard(), drawBlackjackCard()];
    blackjackDealerHand = [drawBlackjackCard(), drawBlackjackCard()];

    updateBlackjackDisplay();
    playGameSound('card-flip');

    document.getElementById('blackjackDealBtn').style.display = 'none';
    document.getElementById('blackjackActions').style.display = 'grid';
    document.getElementById('blackjackResult').textContent = '';
    setBlackjackActionState(false);

    if (getBlackjackValue(blackjackPlayerHand) === 21) {
        blackjackStand();
    }
}

function updateBlackjackDisplay(revealDealer = false) {
    const playerCards = document.getElementById('playerCards');
    const dealerCards = document.getElementById('dealerCards');

    if (!playerCards || !dealerCards) {
        return;
    }

    playerCards.innerHTML = blackjackPlayerHand.map((card) => displayBlackjackCard(card)).join('');
    dealerCards.innerHTML = blackjackDealerHand.map((card, index) =>
        displayBlackjackCard(card, !revealDealer && index === 1)
    ).join('');

    document.getElementById('playerScore').textContent = blackjackPlayerHand.length
        ? getBlackjackValue(blackjackPlayerHand)
        : '0';
    document.getElementById('dealerScore').textContent = revealDealer
        ? getBlackjackValue(blackjackDealerHand)
        : (blackjackDealerHand[0] ? getBlackjackValue([blackjackDealerHand[0]]) : '0');
}

function blackjackHit() {
    if (!blackjackGameActive || blackjackResolving) {
        return;
    }

    blackjackPlayerHand.push(drawBlackjackCard());
    playGameSound('card-flip');
    updateBlackjackDisplay();

    if (getBlackjackValue(blackjackPlayerHand) > 21) {
        endBlackjack('bust');
    }
}

async function blackjackStand() {
    if (!blackjackGameActive || blackjackResolving) {
        return;
    }

    blackjackResolving = true;
    setBlackjackActionState(true);
    updateBlackjackDisplay(true);
    await waitForGameDelay(260);

    while (getBlackjackValue(blackjackDealerHand) < 17) {
        blackjackDealerHand.push(drawBlackjackCard());
        playGameSound('card-flip');
        updateBlackjackDisplay(true);
        await waitForGameDelay(420);
    }

    const playerValue = getBlackjackValue(blackjackPlayerHand);
    const dealerValue = getBlackjackValue(blackjackDealerHand);

    if (dealerValue > 21) {
        await endBlackjack('dealer_bust');
    } else if (playerValue > dealerValue) {
        await endBlackjack('win');
    } else if (playerValue < dealerValue) {
        await endBlackjack('lose');
    } else {
        await endBlackjack('push');
    }
}

async function blackjackDouble() {
    if (!blackjackGameActive || blackjackResolving) {
        return;
    }

    if (currentPlayer.balance < blackjackBetAmount) {
        showNotification('Insufficient balance to double', 'error');
        return;
    }

    reserveDisplayedBalance(blackjackBetAmount);
    blackjackBetAmount *= 2;
    playGameSound('bet-place');

    blackjackPlayerHand.push(drawBlackjackCard());
    playGameSound('card-flip');
    updateBlackjackDisplay();

    if (getBlackjackValue(blackjackPlayerHand) > 21) {
        await endBlackjack('bust');
        return;
    }

    await blackjackStand();
}

async function endBlackjack(result) {
    blackjackGameActive = false;
    blackjackResolving = false;
    finishGameAction('blackjack', LONG_GAME_COOLDOWN_MS);
    document.getElementById('blackjackActions').style.display = 'none';
    document.getElementById('blackjackDealBtn').style.display = 'block';

    let winAmount = 0;
    let message = '';
    let notificationType = 'error';

    switch (result) {
        case 'bust':
            message = `<span style="color: var(--accent-danger);">BUST! -$${formatAmount(blackjackBetAmount)}</span>`;
            notificationType = 'error';
            break;
        case 'dealer_bust':
            winAmount = blackjackBetAmount * 2;
            message = `<span style="color: var(--accent-success);">DEALER BUST! +$${formatAmount(winAmount - blackjackBetAmount)}</span>`;
            notificationType = 'success';
            break;
        case 'win': {
            const isBlackjack = getBlackjackValue(blackjackPlayerHand) === 21 && blackjackPlayerHand.length === 2;
            winAmount = isBlackjack ? blackjackBetAmount * BLACKJACK_NATURAL_PAYOUT : blackjackBetAmount * 2;
            message = `<span style="color: var(--accent-success);">${isBlackjack ? 'BLACKJACK!' : 'YOU WIN!'} +$${formatAmount(winAmount - blackjackBetAmount)}</span>`;
            notificationType = 'success';
            break;
        }
        case 'lose':
            message = `<span style="color: var(--accent-danger);">DEALER WINS! -$${formatAmount(blackjackBetAmount)}</span>`;
            notificationType = 'error';
            break;
        case 'push':
            winAmount = blackjackBetAmount;
            message = `<span style="color: var(--accent-warning);">PUSH! $${formatAmount(blackjackBetAmount)} returned</span>`;
            notificationType = 'info';
            break;
    }

    const settlement = await settleWager({
        amount: blackjackBetAmount,
        payout: winAmount,
        multiplier: blackjackBetAmount > 0 ? winAmount / blackjackBetAmount : 0,
        won: winAmount >= blackjackBetAmount,
        gameType: 'blackjack'
    });

    if (!settlement) {
        return;
    }

    document.getElementById('blackjackResult').innerHTML = message;
    showNotification(message.replace(/<[^>]*>/g, ''), notificationType);

    if (notificationType === 'success') {
        playGameSound('cashout');
    } else if (notificationType === 'error') {
        playGameSound('explode');
    }
}

function loadSlotsGame(container) {
    container.innerHTML = `
        <div class="game-container">
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px;">
                <div>
                    <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 16px; padding: 40px; text-align: center;">
                        <div id="slotsReels" style="display: flex; justify-content: center; gap: 20px; margin-bottom: 30px;">
                            <div class="slot-reel" style="width: 120px; height: 150px; background: var(--bg-secondary); border: 3px solid var(--border-color); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 60px;">🍒</div>
                            <div class="slot-reel" style="width: 120px; height: 150px; background: var(--bg-secondary); border: 3px solid var(--border-color); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 60px;">🍒</div>
                            <div class="slot-reel" style="width: 120px; height: 150px; background: var(--bg-secondary); border: 3px solid var(--border-color); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 60px;">🍒</div>
                        </div>
                        <div id="slotsResult" style="font-size: 24px; font-weight: 800;"></div>
                    </div>
                    
                    <div style="margin-top: 20px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 12px; padding: 16px;">
                        <div style="font-size: 14px; font-weight: 700; margin-bottom: 12px; color: var(--text-secondary);">PAYTABLE</div>
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; font-size: 13px;">
                            <div>🍒🍒🍒 = 2x</div>
                            <div>🍋🍋🍋 = 4x</div>
                            <div>🍊🍊🍊 = 6x</div>
                            <div>🍇🍇🍇 = 9x</div>
                            <div>💎💎💎 = 14x</div>
                            <div>7️⃣7️⃣7️⃣ = 24x</div>
                        </div>
                    </div>
                </div>
                
                <div class="bet-panel">
                    <div class="bet-input-group">
                        <label class="bet-label">Bet Amount</label>
                        <input type="number" id="slotsBetAmount" class="bet-input" placeholder="0.00" min="1">
                    </div>
                    
                    <button class="btn-primary" onclick="spinSlots()">
                        <i class="fas fa-sync-alt"></i> Spin
                    </button>
                </div>
            </div>
        </div>
    `;
}

function spinSlots() {
    const amount = readAmountInput('slotsBetAmount');
    
    if (!amount || amount <= 0) {
        showNotification('Enter a valid bet amount', 'error');
        return;
    }
    
    if (amount > currentPlayer.balance) {
        showNotification('Insufficient balance', 'error');
        return;
    }

    if (!startGameAction('slots', LONG_GAME_COOLDOWN_MS)) {
        return;
    }
    
    reserveDisplayedBalance(amount);
    
    const symbols = ['🍒', '🍋', '🍊', '🍇', '💎', '7️⃣'];
    const reels = document.querySelectorAll('.slot-reel');
    const results = [];
    
    // Spin animation
    let spins = 0;
    const spinInterval = setInterval(async () => {
        reels.forEach(reel => {
            reel.textContent = symbols[Math.floor(Math.random() * symbols.length)];
        });
        spins++;
        
        if (spins >= 20) {
            clearInterval(spinInterval);
            
            // Final results
            reels.forEach(reel => {
                const symbol = symbols[Math.floor(Math.random() * symbols.length)];
                reel.textContent = symbol;
                results.push(symbol);
            });
            
            // Check win
            if (results[0] === results[1] && results[1] === results[2]) {
                const multipliers = {
                    '🍒': 5, '🍋': 10, '🍊': 15, '🍇': 20, '💎': 50, '7️⃣': 100
                };
                const multiplier = Math.min(24, multipliers[results[0]] || 0);
                const winAmount = amount * multiplier;
                
                const settlement = await settleWager({
                    amount,
                    payout: winAmount,
                    multiplier,
                    won: true,
                    gameType: 'slots'
                });
                
                if (!settlement) {
                    finishGameAction('slots', LONG_GAME_COOLDOWN_MS);
                    return;
                }
                
                document.getElementById('slotsResult').innerHTML = `
                    <span style="color: var(--accent-success);">JACKPOT! ${multiplier}x - +$${formatAmount(winAmount - amount)}</span>
                `;
                showNotification(`Jackpot! Won $${formatAmount(winAmount - amount)}`, 'success');
                
                reels.forEach(reel => {
                    reel.style.borderColor = 'var(--accent-success)';
                    reel.style.boxShadow = '0 0 30px var(--accent-success)';
                });
            } else {
                const settlement = await settleWager({
                    amount,
                    payout: 0,
                    multiplier: 0,
                    won: false,
                    gameType: 'slots'
                });
                
                if (!settlement) {
                    finishGameAction('slots', LONG_GAME_COOLDOWN_MS);
                    return;
                }

                document.getElementById('slotsResult').innerHTML = `
                    <span style="color: var(--accent-danger);">No match! -$${formatAmount(amount)}</span>
                `;
                showNotification(`Lost $${formatAmount(amount)}`, 'error');
            }
            
            setTimeout(() => {
                document.getElementById('slotsResult').textContent = '';
                reels.forEach(reel => {
                    reel.style.borderColor = 'var(--border-color)';
                    reel.style.boxShadow = 'none';
                });
            }, 3000);
            finishGameAction('slots', LONG_GAME_COOLDOWN_MS);
        }
    }, 100);
}

function loadCoinflipGame(container) {
    container.innerHTML = `
        <div class="game-container">
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px;">
                <div>
                    <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 16px; padding: 60px; text-align: center;">
                        <div id="coinDisplay" style="font-size: 150px; margin-bottom: 20px; transition: transform 0.6s;">🪙</div>
                        <div id="coinResult" style="font-size: 28px; font-weight: 900;"></div>
                    </div>
                </div>
                
                <div class="bet-panel">
                    <div class="bet-input-group">
                        <label class="bet-label">Bet Amount</label>
                        <input type="number" id="coinflipBetAmount" class="bet-input" placeholder="0.00" min="1">
                    </div>
                    
                    <div class="bet-input-group">
                        <label class="bet-label">Choose Side</label>
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
                            <button class="btn-primary" onclick="flipCoin('heads')" style="background: linear-gradient(135deg, #7cc7ff, #38bdf8); color: #04131f;">
                                <div style="font-size: 32px;">👑</div>
                                <div>Heads</div>
                            </button>
                            <button class="btn-primary" onclick="flipCoin('tails')" style="background: linear-gradient(135deg, #2563eb, #0f172a); color: #f8fbff;">
                                <div style="font-size: 32px;">🦅</div>
                                <div>Tails</div>
                            </button>
                        </div>
                    </div>
                    
                    <div style="background: var(--bg-primary); padding: 16px; border-radius: 12px; margin-top: 16px; text-align: center;">
                        <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">WIN MULTIPLIER</div>
                        <div style="font-size: 32px; font-weight: 900; color: var(--accent-success);">1.78x</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

async function flipCoin(choice) {
    const amount = readAmountInput('coinflipBetAmount');
    
    if (!amount || amount <= 0) {
        showNotification('Enter a valid bet amount', 'error');
        return;
    }
    
    if (amount > currentPlayer.balance) {
        showNotification('Insufficient balance', 'error');
        return;
    }

    if (!startGameAction('coinflip', LONG_GAME_COOLDOWN_MS)) {
        return;
    }
    
    let liveResult = null;

    if (isBetaMode) {
        reserveDisplayedBalance(amount);
    } else {
        liveResult = await playServerGame({
            gameType: 'coinflip',
            amount,
            payload: { choice }
        });

        if (!liveResult) {
            finishGameAction('coinflip', LONG_GAME_COOLDOWN_MS);
            return;
        }
    }
    
    const coin = document.getElementById('coinDisplay');
    const result = document.getElementById('coinResult');
    
    result.textContent = 'Flipping...';
    
    // Flip animation
    let flips = 0;
    const flipInterval = setInterval(async () => {
        coin.style.transform = `rotateY(${flips * 180}deg)`;
        coin.textContent = flips % 2 === 0 ? '👑' : '🦅';
        flips++;
        
        if (flips >= 10) {
            clearInterval(flipInterval);
            
            const outcome = isBetaMode ? (Math.random() < 0.5 ? 'heads' : 'tails') : liveResult.resultSide;
            coin.textContent = outcome === 'heads' ? '👑' : '🦅';
            
            if (outcome === choice) {
                const winAmount = isBetaMode ? amount * COINFLIP_PAYOUT : Number(liveResult.payout || 0);
                const settlement = isBetaMode
                    ? await settleWager({
                        amount,
                        payout: winAmount,
                        multiplier: COINFLIP_PAYOUT,
                        won: true,
                        gameType: 'coinflip'
                    })
                    : { success: true };
                
                if (!settlement) {
                    finishGameAction('coinflip', LONG_GAME_COOLDOWN_MS);
                    return;
                }
                result.innerHTML = `<span style="color: var(--accent-success);">YOU WON! +$${formatAmount(winAmount - amount)}</span>`;
                showNotification(`Won! +$${formatAmount(winAmount - amount)}`, 'success');
            } else {
                const settlement = isBetaMode
                    ? await settleWager({
                        amount,
                        payout: 0,
                        multiplier: 0,
                        won: false,
                        gameType: 'coinflip'
                    })
                    : { success: true };
                
                if (!settlement) {
                    finishGameAction('coinflip', LONG_GAME_COOLDOWN_MS);
                    return;
                }
                result.innerHTML = `<span style="color: var(--accent-danger);">YOU LOST! -$${formatAmount(amount)}</span>`;
                showNotification(`Lost! -$${formatAmount(amount)}`, 'error');
            }
            
            setTimeout(() => {
                result.textContent = '';
                coin.style.transform = 'rotateY(0deg)';
            }, 3000);
            finishGameAction('coinflip', LONG_GAME_COOLDOWN_MS);
        }
    }, 200);
}

function loadWheelGame(container) {
    container.innerHTML = `
        <div class="game-container">
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px;">
                <div>
                    <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 16px; padding: 40px; text-align: center; position: relative;">
                        <canvas id="wheelCanvas" width="400" height="400" style="max-width: 100%;"></canvas>
                        <div id="wheelResult" style="font-size: 24px; font-weight: 800; margin-top: 20px;"></div>
                    </div>
                </div>
                
                <div class="bet-panel">
                    <div class="bet-input-group">
                        <label class="bet-label">Bet Amount</label>
                        <input type="number" id="wheelBetAmount" class="bet-input" placeholder="0.00" min="1">
                    </div>
                    
                    <div class="bet-input-group">
                        <label class="bet-label">Risk Level</label>
                        <select id="wheelRisk" class="bet-input">
                            <option value="low">Low Risk (Max 2.45x)</option>
                            <option value="medium">Medium Risk (Max 4.4x)</option>
                            <option value="high">High Risk (Max 16x)</option>
                        </select>
                    </div>
                    
                    <button id="wheelSpinBtn" class="btn-primary" onclick="spinWheel()">
                        <i class="fas fa-sync-alt"></i> Spin Wheel
                    </button>
                    
                    <div class="bet-section" style="margin-top: 16px;">
                        <div class="bet-section-title">Risk Profile</div>
                        <div id="wheelRiskMeta" class="selector-summary"></div>
                        <div id="wheelMultipliers" class="stat-list"></div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    initWheel();
}

let wheelCanvas, wheelCtx;
let wheelSegments = [];
let wheelRotation = 0;
let wheelSpinning = false;
let wheelCurrentRisk = 'low';

const WHEEL_SEGMENT_MAP = {
    low: [0.72, 0.92, 1.08, 1.42, 2.45, 1.42, 1.08, 0.92],
    medium: [0.12, 0.45, 0.92, 1.75, 4.4, 1.75, 0.92, 0.45],
    high: [0.02, 0.12, 0.38, 1.45, 16, 1.45, 0.38, 0.12]
};

const WHEEL_RISK_META = {
    low: {
        label: 'Low Risk',
        copy: 'Smoother spins with a tighter floor and a capped 2.45x peak.',
        palette: ['#67e8f9', '#38bdf8', '#34d399', '#60a5fa']
    },
    medium: {
        label: 'Medium Risk',
        copy: 'Balanced spread with colder misses and a sharper 4.4x target.',
        palette: ['#38bdf8', '#2563eb', '#22c55e', '#0ea5e9']
    },
    high: {
        label: 'High Risk',
        copy: 'Brutal spread, tiny recovery lanes, and one explosive 16x spike.',
        palette: ['#fb7185', '#f97316', '#38bdf8', '#1d4ed8']
    }
};

function initWheel() {
    wheelCanvas = document.getElementById('wheelCanvas');
    wheelCtx = wheelCanvas.getContext('2d');
    const riskSelect = document.getElementById('wheelRisk');
    updateWheelSegments(riskSelect ? riskSelect.value : 'low');
    drawWheel();
    
    riskSelect.addEventListener('change', (e) => {
        if (wheelSpinning) {
            e.target.value = wheelCurrentRisk;
            return;
        }

        updateWheelSegments(e.target.value);
        drawWheel();
    });
}

function updateWheelSegments(risk) {
    wheelCurrentRisk = risk;
    wheelSegments = WHEEL_SEGMENT_MAP[risk] || WHEEL_SEGMENT_MAP.low;
    const meta = WHEEL_RISK_META[risk] || WHEEL_RISK_META.low;
    
    const multipliersDiv = document.getElementById('wheelMultipliers');
    multipliersDiv.innerHTML = wheelSegments.map((multiplier, index) => `
        <div class="stat-row">
            <span class="stat-row-label">Segment ${index + 1}</span>
            <span class="stat-row-value" style="color: ${multiplier >= 5 ? 'var(--accent-success)' : 'var(--text-primary)'};">${multiplier}x</span>
        </div>
    `).join('');

    const riskMeta = document.getElementById('wheelRiskMeta');
    if (riskMeta) {
        riskMeta.innerHTML = `
            <strong>${meta.label}</strong>
            <span>${meta.copy}</span>
        `;
    }

    const wheelResult = document.getElementById('wheelResult');
    if (wheelResult && !wheelSpinning) {
        wheelResult.innerHTML = `<span style="color: var(--text-secondary);">Pointer locks to ${meta.label.toLowerCase()} lanes.</span>`;
    }
}

function drawWheel() {
    const centerX = wheelCanvas.width / 2;
    const centerY = wheelCanvas.height / 2;
    const radius = 180;
    const palette = (WHEEL_RISK_META[wheelCurrentRisk] || WHEEL_RISK_META.low).palette;
    
    wheelCtx.clearRect(0, 0, wheelCanvas.width, wheelCanvas.height);

    const backplate = wheelCtx.createRadialGradient(centerX, centerY, 30, centerX, centerY, radius + 24);
    backplate.addColorStop(0, 'rgba(255, 255, 255, 0.06)');
    backplate.addColorStop(0.45, 'rgba(18, 32, 51, 0.18)');
    backplate.addColorStop(1, 'rgba(8, 18, 32, 0.02)');
    wheelCtx.beginPath();
    wheelCtx.arc(centerX, centerY, radius + 12, 0, Math.PI * 2);
    wheelCtx.fillStyle = backplate;
    wheelCtx.fill();
    
    const segmentAngle = (Math.PI * 2) / wheelSegments.length;
    
    wheelSegments.forEach((multiplier, i) => {
        const startAngle = wheelRotation + i * segmentAngle;
        const endAngle = startAngle + segmentAngle;
        const color = palette[i % palette.length];
        const highlight = multiplier === Math.max(...wheelSegments);
        
        wheelCtx.beginPath();
        wheelCtx.moveTo(centerX, centerY);
        wheelCtx.arc(centerX, centerY, radius, startAngle, endAngle);
        wheelCtx.closePath();
        wheelCtx.fillStyle = color;
        wheelCtx.fill();
        wheelCtx.strokeStyle = highlight ? 'rgba(255, 255, 255, 0.62)' : '#06121f';
        wheelCtx.lineWidth = 3;
        wheelCtx.shadowBlur = highlight ? 18 : 0;
        wheelCtx.shadowColor = highlight ? color : 'transparent';
        wheelCtx.stroke();
        wheelCtx.shadowBlur = 0;
        
        wheelCtx.save();
        wheelCtx.translate(centerX, centerY);
        wheelCtx.rotate(startAngle + segmentAngle / 2);
        wheelCtx.textAlign = 'center';
        wheelCtx.fillStyle = 'white';
        wheelCtx.font = '700 18px Sora';
        wheelCtx.fillText(multiplier + 'x', radius * 0.67, 6);
        wheelCtx.restore();
    });

    wheelCtx.beginPath();
    wheelCtx.moveTo(centerX, 20);
    wheelCtx.lineTo(centerX - 15, 50);
    wheelCtx.lineTo(centerX + 15, 50);
    wheelCtx.closePath();
    wheelCtx.fillStyle = '#f8fbff';
    wheelCtx.fill();
    wheelCtx.strokeStyle = '#082032';
    wheelCtx.lineWidth = 2;
    wheelCtx.stroke();

    wheelCtx.beginPath();
    wheelCtx.arc(centerX, centerY, 28, 0, Math.PI * 2);
    wheelCtx.fillStyle = '#082032';
    wheelCtx.fill();
    wheelCtx.lineWidth = 5;
    wheelCtx.strokeStyle = 'rgba(124, 199, 255, 0.65)';
    wheelCtx.stroke();
}

function normalizeWheelAngle(angle) {
    const fullTurn = Math.PI * 2;
    return ((angle % fullTurn) + fullTurn) % fullTurn;
}

function getWheelWinningIndex() {
    const segmentAngle = (Math.PI * 2) / wheelSegments.length;
    const pointerAngle = normalizeWheelAngle((-Math.PI / 2) - wheelRotation);
    return Math.floor(pointerAngle / segmentAngle) % wheelSegments.length;
}

function getWheelTargetRotation(targetIndex) {
    const fullTurn = Math.PI * 2;
    const segmentAngle = fullTurn / wheelSegments.length;
    const desired = normalizeWheelAngle((-Math.PI / 2) - ((targetIndex + 0.5) * segmentAngle));
    const current = normalizeWheelAngle(wheelRotation);
    let delta = desired - current;

    if (delta <= 0) {
        delta += fullTurn;
    }

    delta += fullTurn * (5 + Math.random() * 2.4);
    return wheelRotation + delta;
}

async function spinWheel() {
    const amount = readAmountInput('wheelBetAmount');
    const spinButton = document.getElementById('wheelSpinBtn');
    const riskSelect = document.getElementById('wheelRisk');
    const risk = riskSelect ? riskSelect.value : wheelCurrentRisk;

    if (wheelSpinning) {
        return;
    }
    
    if (!amount || amount <= 0) {
        showNotification('Enter a valid bet amount', 'error');
        return;
    }
    
    if (amount > currentPlayer.balance) {
        showNotification('Insufficient balance', 'error');
        return;
    }

    if (!startGameAction('wheel', LONG_GAME_COOLDOWN_MS)) {
        return;
    }
    
    wheelSpinning = true;
    spinButton.disabled = true;
    spinButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Spinning...';
    riskSelect.disabled = true;

    if (isBetaMode) {
        reserveDisplayedBalance(amount);
    }

    let forcedSegmentIndex = null;
    let forcedMultiplier = 0;
    let forcedPayout = 0;

    if (!isBetaMode) {
        const playResult = await playServerGame({
            gameType: 'wheel',
            amount,
            payload: { risk }
        });

        if (!playResult) {
            wheelSpinning = false;
            finishGameAction('wheel', LONG_GAME_COOLDOWN_MS);
            spinButton.disabled = false;
            spinButton.innerHTML = '<i class="fas fa-sync-alt"></i> Spin Wheel';
            riskSelect.disabled = false;
            return;
        }

        forcedSegmentIndex = Number(playResult.segmentIndex || 0);
        forcedMultiplier = Number(playResult.multiplier || 0);
        forcedPayout = Number(playResult.payout || 0);
    }

    const targetRotation = getWheelTargetRotation(
        isBetaMode ? Math.floor(Math.random() * wheelSegments.length) : forcedSegmentIndex
    );
    const duration = 3600;
    const startTime = Date.now();
    const startRotation = wheelRotation;
    
    async function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        
        wheelRotation = startRotation + (targetRotation - startRotation) * easeOut;
        drawWheel();
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            const segmentIndex = isBetaMode ? getWheelWinningIndex() : forcedSegmentIndex;
            const multiplier = isBetaMode ? wheelSegments[segmentIndex] : forcedMultiplier;
            const winAmount = isBetaMode ? amount * multiplier : forcedPayout;
            const settlement = isBetaMode
                ? await settleWager({
                    amount,
                    payout: winAmount,
                    multiplier,
                    won: winAmount >= amount,
                    gameType: 'wheel'
                })
                : { success: true };
            
            if (!settlement) {
                wheelSpinning = false;
                finishGameAction('wheel', LONG_GAME_COOLDOWN_MS);
                spinButton.disabled = false;
                spinButton.innerHTML = '<i class="fas fa-sync-alt"></i> Spin Wheel';
                riskSelect.disabled = false;
                return;
            }
            
            const profit = winAmount - amount;
            document.getElementById('wheelResult').innerHTML = `
                <span style="color: ${profit > 0 ? 'var(--accent-success)' : 'var(--accent-danger)'};">
                    ${multiplier}x - ${profit > 0 ? '+' : ''}$${formatAmount(profit)}
                </span>
            `;
            showNotification(`${multiplier}x - ${profit > 0 ? 'Won' : 'Lost'} $${formatAmount(Math.abs(profit))}`, profit > 0 ? 'success' : 'error');
            wheelSpinning = false;
            finishGameAction('wheel', LONG_GAME_COOLDOWN_MS);
            spinButton.disabled = false;
            spinButton.innerHTML = '<i class="fas fa-sync-alt"></i> Spin Wheel';
            riskSelect.disabled = false;
        }
    }
    
    animate();
}

function loadLimboGame(container) {
    container.innerHTML = `
        <div class="game-container">
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px;">
                <div>
                    <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 16px; padding: 80px; text-align: center;">
                        <div id="limboResult" style="font-size: 100px; font-weight: 900; background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 20px;">0.00x</div>
                        <div id="limboStatus" style="font-size: 20px; color: var(--text-secondary);">Set your target and play!</div>
                    </div>
                </div>
                
                <div class="bet-panel">
                    <div class="bet-input-group">
                        <label class="bet-label">Bet Amount</label>
                        <input type="number" id="limboBetAmount" class="bet-input" placeholder="0.00" min="1">
                    </div>
                    
                    <div class="bet-input-group">
                        <label class="bet-label">Target Multiplier</label>
                        <input type="number" id="limboTarget" class="bet-input" placeholder="2.00" min="1.01" max="25" step="0.01" value="2.00" oninput="updateLimboChance()">
                        <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 13px;">
                            <span style="color: var(--text-secondary);">Win Chance</span>
                            <span id="limboChance" style="font-weight: 700; color: var(--accent-success);">48.0%</span>
                        </div>
                    </div>
                    
                    <button class="btn-primary" onclick="playLimbo()">
                        <i class="fas fa-play"></i> Play
                    </button>
                </div>
            </div>
        </div>
    `;
    updateLimboChance();
}

function updateLimboChance() {
    const target = Math.max(1.01, Math.min(LIMBO_MAX_TARGET, parseFloat(document.getElementById('limboTarget').value) || 2));
    const chance = (LIMBO_EDGE / target) * 100;
    document.getElementById('limboChance').textContent = chance.toFixed(2) + '%';
}

async function playLimbo() {
    const amount = readAmountInput('limboBetAmount');
    const target = parseFloat(document.getElementById('limboTarget').value);
    
    if (!amount || amount <= 0) {
        showNotification('Enter a valid bet amount', 'error');
        return;
    }
    
    if (!target || target < 1.01 || target > 25) {
        showNotification('Target must stay between 1.01x and 25x', 'error');
        return;
    }
    
    if (amount > currentPlayer.balance) {
        showNotification('Insufficient balance', 'error');
        return;
    }

    if (!startGameAction('limbo', LONG_GAME_COOLDOWN_MS)) {
        return;
    }
    
    if (isBetaMode) {
        reserveDisplayedBalance(amount);
    }
    
    document.getElementById('limboStatus').textContent = 'Rolling...';
    
    // Animate counting
    let current = 1.00;
    const result = isBetaMode ? rollInverseMultiplier(LIMBO_EDGE, LIMBO_MAX_TARGET) : 0;
    let liveResult = null;
    if (!isBetaMode) {
        liveResult = await playServerGame({
            gameType: 'limbo',
            amount,
            payload: { target }
        });

        if (!liveResult) {
            document.getElementById('limboStatus').textContent = 'Set your target and play!';
            finishGameAction('limbo', LONG_GAME_COOLDOWN_MS);
            return;
        }
    }
    const targetResult = isBetaMode ? result : clampMultiplier(liveResult.resultMultiplier || 1, LIMBO_MAX_TARGET);
    const increment = targetResult / 30;
    
    const countInterval = setInterval(async () => {
        current += increment;
        if (current >= targetResult) {
            current = targetResult;
            clearInterval(countInterval);
            
            const won = targetResult >= target;
            
            if (won) {
                const winAmount = isBetaMode ? amount * target : Number(liveResult.payout || 0);
                const settlement = isBetaMode
                    ? await settleWager({
                        amount,
                        payout: winAmount,
                        multiplier: target,
                        won: true,
                        gameType: 'limbo'
                    })
                    : { success: true };
                
                if (!settlement) {
                    finishGameAction('limbo', LONG_GAME_COOLDOWN_MS);
                    return;
                }
                document.getElementById('limboStatus').innerHTML = `
                    <span style="color: var(--accent-success); font-weight: 800;">YOU WON! +$${formatAmount(winAmount - amount)}</span>
                `;
                showNotification(`Won! +$${formatAmount(winAmount - amount)}`, 'success');
            } else {
                const settlement = isBetaMode
                    ? await settleWager({
                        amount,
                        payout: 0,
                        multiplier: 0,
                        won: false,
                        gameType: 'limbo'
                    })
                    : { success: true };
                
                if (!settlement) {
                    finishGameAction('limbo', LONG_GAME_COOLDOWN_MS);
                    return;
                }
                document.getElementById('limboStatus').innerHTML = `
                    <span style="color: var(--accent-danger); font-weight: 800;">YOU LOST! -$${formatAmount(amount)}</span>
                `;
                showNotification(`Lost! -$${formatAmount(amount)}`, 'error');
            }
            
            setTimeout(() => {
                document.getElementById('limboResult').textContent = '0.00x';
                document.getElementById('limboStatus').textContent = 'Set your target and play!';
            }, 3000);
            finishGameAction('limbo', LONG_GAME_COOLDOWN_MS);
        }
        
        document.getElementById('limboResult').textContent = current.toFixed(2) + 'x';
    }, 50);
}

function loadKenoGame(container) {
    container.innerHTML = `
        <div class="game-container">
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px;">
                <div>
                    <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 16px; padding: 30px;">
                        <div id="kenoGrid" style="display: grid; grid-template-columns: repeat(8, 1fr); gap: 8px;"></div>
                    </div>
                    <div id="kenoResult" style="text-align: center; font-size: 24px; font-weight: 800; margin-top: 20px;"></div>
                </div>
                
                <div class="bet-panel">
                    <div class="bet-input-group">
                        <label class="bet-label">Bet Amount</label>
                        <input type="number" id="kenoBetAmount" class="bet-input" placeholder="0.00" min="1">
                    </div>
                    
                    <div style="background: var(--bg-primary); padding: 16px; border-radius: 12px; margin-bottom: 16px;">
                        <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px;">SELECTED NUMBERS</div>
                        <div id="kenoSelected" style="font-size: 24px; font-weight: 900; color: var(--accent-primary);">0 / 10</div>
                    </div>
                    
                    <button class="btn-primary" onclick="playKeno()">
                        <i class="fas fa-dice"></i> Draw Numbers
                    </button>
                    <button class="btn-danger" onclick="clearKeno()" style="margin-top: 12px;">
                        <i class="fas fa-redo"></i> Clear Selection
                    </button>
                    
                    <div style="background: var(--bg-primary); padding: 16px; border-radius: 12px; margin-top: 16px; font-size: 12px;">
                        <div style="font-weight: 700; margin-bottom: 8px; color: var(--text-secondary);">PAYOUTS</div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                            <span>5 matches</span>
                            <span style="font-weight: 700;">1.15x</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                            <span>6 matches</span>
                            <span style="font-weight: 700;">1.8x</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                            <span>7 matches</span>
                            <span style="font-weight: 700;">3.2x</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                            <span>8 matches</span>
                            <span style="font-weight: 700;">6.4x</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                            <span>9 matches</span>
                            <span style="font-weight: 700;">12x</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span>10 matches</span>
                            <span style="font-weight: 700; color: var(--accent-success);">24x</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    createKenoGrid();
}

let kenoSelected = [];

function createKenoGrid() {
    const grid = document.getElementById('kenoGrid');
    grid.innerHTML = '';
    
    for (let i = 1; i <= 40; i++) {
        const tile = document.createElement('div');
        tile.className = 'keno-tile';
        tile.textContent = i;
        tile.style.cssText = `
            aspect-ratio: 1;
            background: var(--bg-secondary);
            border: 2px solid var(--border-color);
            border-radius: 8px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 800;
            font-size: 16px;
            transition: all 0.3s;
        `;
        tile.onclick = () => toggleKenoNumber(i, tile);
        grid.appendChild(tile);
    }
}

function toggleKenoNumber(number, tile) {
    if (kenoSelected.includes(number)) {
        kenoSelected = kenoSelected.filter(n => n !== number);
        tile.style.background = 'var(--bg-secondary)';
        tile.style.borderColor = 'var(--border-color)';
    } else if (kenoSelected.length < 10) {
        kenoSelected.push(number);
        tile.style.background = 'var(--accent-primary)';
        tile.style.borderColor = 'var(--accent-primary)';
    }
    
    document.getElementById('kenoSelected').textContent = `${kenoSelected.length} / 10`;
}

function clearKeno() {
    kenoSelected = [];
    createKenoGrid();
    document.getElementById('kenoSelected').textContent = '0 / 10';
    document.getElementById('kenoResult').textContent = '';
}

async function playKeno() {
    const amount = readAmountInput('kenoBetAmount');
    
    if (!amount || amount <= 0) {
        showNotification('Enter a valid bet amount', 'error');
        return;
    }
    
    if (kenoSelected.length === 0) {
        showNotification('Select at least 1 number', 'error');
        return;
    }
    
    if (amount > currentPlayer.balance) {
        showNotification('Insufficient balance', 'error');
        return;
    }

    if (!startGameAction('keno', LONG_GAME_COOLDOWN_MS)) {
        return;
    }
    
    if (isBetaMode) {
        reserveDisplayedBalance(amount);
    }
    
    const drawn = [];
    let multiplier = 0;
    let payout = 0;
    let matches = 0;

    if (isBetaMode) {
        while (drawn.length < 20) {
            const num = Math.floor(Math.random() * 40) + 1;
            if (!drawn.includes(num)) drawn.push(num);
        }
        matches = kenoSelected.filter(n => drawn.includes(n)).length;
        multiplier = KENO_PAYOUTS[matches] || 0;
        payout = multiplier > 0 ? amount * multiplier : 0;
    } else {
        const playResult = await playServerGame({
            gameType: 'keno',
            amount,
            payload: { selectedNumbers: kenoSelected }
        });

        if (!playResult) {
            finishGameAction('keno', LONG_GAME_COOLDOWN_MS);
            return;
        }

        drawn.push(...(playResult.drawn || []));
        matches = Number(playResult.matches || 0);
        multiplier = Number(playResult.multiplier || 0);
        payout = Number(playResult.payout || 0);
    }
    
    // Highlight drawn numbers
    const tiles = document.querySelectorAll('.keno-tile');
    tiles.forEach((tile, index) => {
        const number = index + 1;
        if (drawn.includes(number)) {
            tile.style.background = kenoSelected.includes(number) ? 'var(--accent-success)' : 'var(--accent-danger)';
            tile.style.borderColor = kenoSelected.includes(number) ? 'var(--accent-success)' : 'var(--accent-danger)';
        }
    });
    
    const settlement = isBetaMode
        ? await settleWager({
            amount,
            payout,
            multiplier,
            won: multiplier > 0,
            gameType: 'keno'
        })
        : { success: true };
    
    if (!settlement) {
        finishGameAction('keno', LONG_GAME_COOLDOWN_MS);
        return;
    }
    
    if (multiplier > 0) {
        document.getElementById('kenoResult').innerHTML = `
            <span style="color: var(--accent-success);">${matches} MATCHES! ${multiplier}x - +$${formatAmount(payout - amount)}</span>
        `;
        showNotification(`${matches} matches! Won $${formatAmount(payout - amount)}`, 'success');
    } else {
        document.getElementById('kenoResult').innerHTML = `
            <span style="color: var(--accent-danger);">${matches} MATCHES - NO WIN</span>
        `;
        showNotification(`${matches} matches - Lost $${formatAmount(amount)}`, 'error');
    }
    finishGameAction('keno', LONG_GAME_COOLDOWN_MS);
}

window.handleCrashRealtimeState = handleCrashRealtimeState;
window.handleCrashBetSettlement = handleCrashBetSettlement;
