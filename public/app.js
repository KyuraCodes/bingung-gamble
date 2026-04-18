let currentPlayer = null;
let socket = null;
const isBetaMode = false;
let currentGame = 'crash';
let playerStats = null;
let audioContext = null;
let soundEnabled = true;
let clickSoundTimestamp = 0;
let globalRealtimeStats = null;
let provablyFairState = null;
let provablyFairExpanded = false;
let recentBetsExpanded = false;
let pendingTipRecipient = '';

const responsiveGridRegistry = new Set();

const AMOUNT_SUFFIXES = {
    k: 1e3,
    m: 1e6,
    b: 1e9,
    t: 1e12,
    q: 1e15
};

const GAME_META = {
    crash: {
        title: 'Crash',
        eyebrow: 'Burst Room',
        chip: 'High Tempo',
        stage: 'Crash Arena',
        description: 'Ride the multiplier, bank in time, and keep the streak alive.',
        icon: 'fa-rocket'
    },
    mines: {
        title: 'Mines',
        eyebrow: 'Treasure Grid',
        chip: 'Precision',
        stage: 'Gem Field',
        description: 'Open safe tiles, dodge the bombs, and cash out before greed catches up.',
        icon: 'fa-gem'
    },
    towers: {
        title: 'Towers',
        eyebrow: 'Climb Table',
        chip: 'Ladder Risk',
        stage: 'Sky Tower',
        description: 'Pick the safe path up the tower and decide how high you want to push it.',
        icon: 'fa-tower-observation'
    },
    plinko: {
        title: 'Plinko',
        eyebrow: 'Drop Board',
        chip: 'Spread Risk',
        stage: 'Peg Garden',
        description: 'Drop the ball, ride the chaos, and hope it lands in the hot slot.',
        icon: 'fa-circle-nodes'
    },
    dice: {
        title: 'Dice',
        eyebrow: 'Number Lab',
        chip: 'Fast Roll',
        stage: 'Dice Desk',
        description: 'Set your target, roll the board, and squeeze value out of every edge.',
        icon: 'fa-dice'
    },
    roulette: {
        title: 'Roulette',
        eyebrow: 'Color Wheel',
        chip: 'Classic',
        stage: 'Roulette Ring',
        description: 'Pick your lane, let the wheel breathe, and fade or flood with one spin.',
        icon: 'fa-bullseye'
    },
    blackjack: {
        title: 'Blackjack',
        eyebrow: 'Card Room',
        chip: 'Table Play',
        stage: 'Dealer Pit',
        description: 'Play the hand, press the double when it is right, and beat the dealer clean.',
        icon: 'fa-crown'
    },
    coinflip: {
        title: 'Coinflip',
        eyebrow: 'Heads or Tails',
        chip: 'Even Money',
        stage: 'Coin Table',
        description: 'Pick your side and let the cleanest 50-50 in the building decide it.',
        icon: 'fa-coins'
    },
    wheel: {
        title: 'Wheel',
        eyebrow: 'Segment Spin',
        chip: 'Prize Hunt',
        stage: 'Fortune Wheel',
        description: 'Choose the risk tier, spin the board, and chase the high segment finish.',
        icon: 'fa-compact-disc'
    },
    limbo: {
        title: 'Limbo',
        eyebrow: 'Target Table',
        chip: 'Sharp Entry',
        stage: 'Limbo Rail',
        description: 'Name your target, roll for the ceiling, and let the number either clear or miss.',
        icon: 'fa-wave-square'
    },
    cases: {
        title: 'Cases',
        eyebrow: 'Prize Vault',
        chip: 'Loot Pull',
        stage: 'Case Gallery',
        description: 'Open premium cases, roll rarity, and hope the vault lights up for you.',
        icon: 'fa-box-open'
    },
    jackpot: {
        title: 'Jackpot',
        eyebrow: 'Shared Pot',
        chip: '10 Seats',
        stage: 'Jackpot Vault',
        description: 'Join the pool, own your percentage, and let one weighted draw take the pot.',
        icon: 'fa-vault'
    },
    dailyrewards: {
        title: 'Daily Rewards',
        eyebrow: 'Free Crates',
        chip: 'Level Locked',
        stage: 'Reward Claim',
        description: 'Claim one free crate every day. Higher levels unlock better free crates.',
        icon: 'fa-calendar-check'
    },
    profile: {
        title: 'Profile',
        eyebrow: 'Wallet Hub',
        chip: 'Account',
        stage: 'Profile Vault',
        description: 'Deposit Minecraft money into the website wallet, withdraw wins back, and track level progress.',
        icon: 'fa-id-card'
    }
};

const GAME_ORDER = Object.keys(GAME_META);

const EMPTY_GLOBAL_STATS = {
    onlinePlayers: 0,
    totalBets: 0,
    totalWins: 0,
    totalLosses: 0,
    totalWagered: 0,
    netProfit: 0
};

function normalizePlayerState(player = {}) {
    const walletBalance = Number(player.walletBalance ?? player.balance ?? 0);
    const vaultBalance = Number(player.vaultBalance ?? player.minecraftBalance ?? walletBalance);

    return {
        ...player,
        username: player.username || 'Player',
        balance: Number.isFinite(walletBalance) ? walletBalance : 0,
        walletBalance: Number.isFinite(walletBalance) ? walletBalance : 0,
        vaultBalance: Number.isFinite(vaultBalance) ? vaultBalance : 0,
        level: Math.max(1, Number(player.level || 1)),
        maxLevel: Math.max(1, Number(player.maxLevel || 100)),
        xp: Number(player.xp || 0),
        xpToNextLevel: Math.max(0, Number(player.xpToNextLevel || 0)),
        xpIntoLevel: Math.max(0, Number(player.xpIntoLevel || 0)),
        levelProgress: Math.max(0, Math.min(1, Number(player.levelProgress || 0)))
    };
}

function setCurrentPlayerState(player = {}) {
    currentPlayer = normalizePlayerState({
        ...(currentPlayer || {}),
        ...(player || {})
    });
    return currentPlayer;
}

document.addEventListener('DOMContentLoaded', () => {
    initializeSoundPreference();
    setupGlobalClickAudio();
    unlockAudioOnInteraction();
    setupLoginForm();
    setupNavigation();
    setupLogout();
    setupLiveChat();
    setupChatTips();
    setupWalletTransfers();
    setupRecentBetsToggle();
    renderModeStrip();
    renderQuickSwitch();
    setupProvablyFairPanel();
    renderProvablyFairPanel();
    setupImageFallbacks();
    updateGlobalStatsDisplay(EMPTY_GLOBAL_STATS);
    updateGameChrome(currentGame);
    connectSocket();
    checkSession();
    window.addEventListener('resize', syncResponsiveGameLayouts);
});

function formatAmount(num) {
    const value = Number(num || 0);
    const absNum = Math.abs(value);

    if (absNum >= 1e15) return (value / 1e15).toFixed(2) + 'Q';
    if (absNum >= 1e12) return (value / 1e12).toFixed(2) + 'T';
    if (absNum >= 1e9) return (value / 1e9).toFixed(2) + 'B';
    if (absNum >= 1e6) return (value / 1e6).toFixed(2) + 'M';
    if (absNum >= 1e3) return (value / 1e3).toFixed(2) + 'K';

    return value.toFixed(2);
}

function formatCompactAmountInput(num) {
    const value = Number(num || 0);
    const absNum = Math.abs(value);
    const tiers = [
        ['q', 1e15],
        ['t', 1e12],
        ['b', 1e9],
        ['m', 1e6],
        ['k', 1e3]
    ];

    for (const [suffix, threshold] of tiers) {
        if (absNum >= threshold) {
            return `${trimAmountDecimals(value / threshold)}${suffix}`;
        }
    }

    return trimAmountDecimals(value);
}

function trimAmountDecimals(num) {
    return Number(num.toFixed(3)).toString();
}

function formatExpandedAmountInput(num) {
    const value = Number(num || 0);
    const roundedValue = Math.round(value * 100) / 100;
    const formattedValue = new Intl.NumberFormat('en-US', {
        minimumFractionDigits: Number.isInteger(roundedValue) ? 0 : 2,
        maximumFractionDigits: 2
    }).format(roundedValue);

    if (Math.abs(roundedValue) < 1000) {
        return formattedValue;
    }

    return `${formattedValue} (${formatCompactAmountInput(roundedValue)})`;
}

function createClientRequestId(prefix = 'bg') {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return `${prefix}-${window.crypto.randomUUID()}`;
    }

    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function readJsonResponse(response, fallbackMessage = 'Request failed') {
    const text = await response.text();
    let data = null;

    try {
        data = text ? JSON.parse(text) : {};
    } catch (error) {
        const cleanText = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        throw new Error(cleanText ? `${fallbackMessage}: ${cleanText.slice(0, 140)}` : fallbackMessage);
    }

    if (!response.ok || data.success === false) {
        throw new Error(data.message || fallbackMessage);
    }

    return data;
}

function parseAmountInput(rawValue) {
    if (typeof rawValue === 'number') {
        return rawValue;
    }

    const normalized = String(rawValue || '')
        .trim()
        .replace(/\(.*?\)/g, '')
        .replace(/[$,\s_]/g, '')
        .toLowerCase();

    if (!normalized) {
        return NaN;
    }

    const match = normalized.match(/^(-?\d+(?:\.\d+)?)([kmbtq])?$/i);
    if (!match) {
        return Number(normalized);
    }

    const baseValue = Number(match[1]);
    const suffix = match[2];
    return baseValue * (suffix ? AMOUNT_SUFFIXES[suffix] : 1);
}

function readAmountInput(inputId) {
    const input = document.getElementById(inputId);
    return input ? parseAmountInput(input.value) : NaN;
}

function setAmountInputValue(inputId, value) {
    const input = document.getElementById(inputId);
    if (!input) return;

    input.dataset.rawAmountValue = formatCompactAmountInput(value);
    input.value = formatExpandedAmountInput(value);
}

function enhanceAmountInputs(scope = document) {
    scope.querySelectorAll("input[id$='BetAmount'], input[data-amount-input='true']").forEach((input) => {
        if (input.dataset.amountEnhanced === 'true') {
            return;
        }

        input.dataset.amountEnhanced = 'true';
        input.dataset.rawAmountValue = input.value || '';
        input.type = 'text';
        input.inputMode = 'decimal';
        input.autocomplete = 'off';
        input.spellcheck = false;

        input.addEventListener('focus', () => {
            input.value = input.dataset.rawAmountValue || input.value;
        });

        input.addEventListener('input', () => {
            input.dataset.rawAmountValue = input.value;
        });

        input.addEventListener('blur', () => {
            const parsed = parseAmountInput(input.value);
            if (Number.isFinite(parsed) && parsed > 0) {
                input.dataset.rawAmountValue = formatCompactAmountInput(parsed);
                input.value = formatExpandedAmountInput(parsed);
            }
        });

        const initialValue = parseAmountInput(input.value);
        if (Number.isFinite(initialValue) && initialValue > 0) {
            input.dataset.rawAmountValue = formatCompactAmountInput(initialValue);
            input.value = formatExpandedAmountInput(initialValue);
        }
    });
}

function initializeSoundPreference() {
    soundEnabled = true;
}

function setupGlobalClickAudio() {
    const playClickTone = (event) => {
        if (!soundEnabled) return;
        if (!event.target.closest('#app, .modal.active, #notificationStack')) return;

        const now = performance.now();
        if (now - clickSoundTimestamp < 55) {
            return;
        }

        clickSoundTimestamp = now;
        playUiSound('button');
    };

    document.addEventListener('pointerdown', (event) => {
        if (event.isPrimary === false) return;
        if (typeof event.button === 'number' && event.button !== 0) return;
        playClickTone(event);
    }, true);

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        if (!event.target.closest('button, a, [role="button"], .selector-pill')) return;
        playClickTone(event);
    }, true);
}

function unlockAudioOnInteraction() {
    const unlock = async () => {
        await ensureAudioContext();
        document.removeEventListener('pointerdown', unlock);
        document.removeEventListener('keydown', unlock);
    };

    document.addEventListener('pointerdown', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });
}

async function ensureAudioContext() {
    if (!soundEnabled) {
        return null;
    }

    if (!audioContext) {
        const Context = window.AudioContext || window.webkitAudioContext;
        if (!Context) {
            return null;
        }
        audioContext = new Context();
    }

    if (audioContext.state === 'suspended') {
        try {
            await audioContext.resume();
        } catch (error) {
            console.warn('Audio context resume failed:', error);
        }
    }

    return audioContext;
}

function scheduleTone(context, {
    startTime,
    frequency,
    duration = 0.18,
    gain = 0.045,
    type = 'triangle',
    detune = 0,
    attack = 0.01,
    release = 0.16,
    destination = null
}) {
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startTime);
    oscillator.detune.setValueAtTime(detune, startTime);

    gainNode.gain.setValueAtTime(0.0001, startTime);
    gainNode.gain.exponentialRampToValueAtTime(gain, startTime + attack);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration + release);

    oscillator.connect(gainNode);
    gainNode.connect(destination || context.destination);

    oscillator.start(startTime);
    oscillator.stop(startTime + duration + release + 0.02);
}

function scheduleNoiseBurst(context, startTime, duration, gain, highpassFrequency) {
    const sampleRate = context.sampleRate;
    const buffer = context.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }

    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gainNode = context.createGain();

    filter.type = 'highpass';
    filter.frequency.setValueAtTime(highpassFrequency, startTime);

    gainNode.gain.setValueAtTime(gain, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(context.destination);

    source.start(startTime);
    source.stop(startTime + duration + 0.02);
}

async function playUiSound(kind = 'info') {
    const context = await ensureAudioContext();
    if (!context) return;

    const startTime = context.currentTime + 0.01;
    const master = context.createGain();
    const filter = context.createBiquadFilter();

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2200, startTime);
    master.gain.setValueAtTime(0.9, startTime);

    filter.connect(master);
    master.connect(context.destination);

    const tone = (config) => scheduleTone(context, { ...config, startTime: startTime + (config.offset || 0), destination: filter });

    switch (kind) {
        case 'success':
            tone({ frequency: 620, gain: 0.05, duration: 0.12, type: 'triangle' });
            tone({ frequency: 930, gain: 0.04, duration: 0.14, type: 'sine', offset: 0.06 });
            tone({ frequency: 1240, gain: 0.03, duration: 0.18, type: 'triangle', offset: 0.12 });
            scheduleNoiseBurst(context, startTime, 0.03, 0.0025, 1600);
            break;
        case 'error':
            tone({ frequency: 260, gain: 0.055, duration: 0.16, type: 'sawtooth' });
            tone({ frequency: 190, gain: 0.04, duration: 0.18, type: 'triangle', offset: 0.05 });
            scheduleNoiseBurst(context, startTime, 0.05, 0.003, 900);
            break;
        case 'modal-open':
            tone({ frequency: 420, gain: 0.038, duration: 0.18, type: 'triangle' });
            tone({ frequency: 760, gain: 0.025, duration: 0.14, type: 'sine', offset: 0.04 });
            break;
        case 'modal-close':
            tone({ frequency: 520, gain: 0.028, duration: 0.09, type: 'triangle' });
            tone({ frequency: 340, gain: 0.02, duration: 0.1, type: 'sine', offset: 0.05 });
            break;
        case 'toggle-on':
            tone({ frequency: 540, gain: 0.03, duration: 0.08, type: 'triangle' });
            tone({ frequency: 820, gain: 0.022, duration: 0.11, type: 'sine', offset: 0.05 });
            break;
        case 'button':
            tone({ frequency: 1380, gain: 0.012, duration: 0.022, type: 'square' });
            tone({ frequency: 980, gain: 0.008, duration: 0.028, type: 'triangle', offset: 0.015 });
            scheduleNoiseBurst(context, startTime, 0.012, 0.0009, 2400);
            break;
        case 'bet-place':
            tone({ frequency: 320, gain: 0.03, duration: 0.04, type: 'triangle' });
            tone({ frequency: 520, gain: 0.018, duration: 0.05, type: 'sine', offset: 0.03 });
            break;
        case 'cashout':
            tone({ frequency: 760, gain: 0.034, duration: 0.08, type: 'triangle' });
            tone({ frequency: 1040, gain: 0.024, duration: 0.1, type: 'sine', offset: 0.05 });
            break;
        case 'card-flip':
            tone({ frequency: 240, gain: 0.015, duration: 0.025, type: 'square' });
            scheduleNoiseBurst(context, startTime, 0.018, 0.0008, 1700);
            break;
        case 'shuffle':
            tone({ frequency: 190, gain: 0.012, duration: 0.028, type: 'sawtooth' });
            tone({ frequency: 240, gain: 0.01, duration: 0.028, type: 'triangle', offset: 0.02 });
            scheduleNoiseBurst(context, startTime, 0.02, 0.0011, 1400);
            break;
        case 'spin-start':
            tone({ frequency: 240, gain: 0.02, duration: 0.05, type: 'sawtooth' });
            tone({ frequency: 420, gain: 0.02, duration: 0.08, type: 'triangle', offset: 0.03 });
            tone({ frequency: 620, gain: 0.016, duration: 0.1, type: 'sine', offset: 0.08 });
            break;
        case 'spin-stop':
            tone({ frequency: 520, gain: 0.02, duration: 0.04, type: 'triangle' });
            tone({ frequency: 360, gain: 0.015, duration: 0.07, type: 'sine', offset: 0.02 });
            break;
        case 'coin-flip':
            tone({ frequency: 980, gain: 0.018, duration: 0.03, type: 'triangle' });
            tone({ frequency: 1180, gain: 0.012, duration: 0.03, type: 'sine', offset: 0.03 });
            break;
        case 'plinko-drop':
            tone({ frequency: 520, gain: 0.02, duration: 0.045, type: 'triangle' });
            tone({ frequency: 720, gain: 0.012, duration: 0.045, type: 'sine', offset: 0.05 });
            break;
        case 'plinko-hit':
            tone({ frequency: 880, gain: 0.011, duration: 0.015, type: 'square' });
            break;
        case 'reveal':
            tone({ frequency: 640, gain: 0.014, duration: 0.03, type: 'triangle' });
            break;
        case 'explode':
            tone({ frequency: 140, gain: 0.038, duration: 0.09, type: 'sawtooth' });
            scheduleNoiseBurst(context, startTime, 0.05, 0.0034, 700);
            break;
        case 'chat':
            tone({ frequency: 840, gain: 0.02, duration: 0.04, type: 'triangle' });
            tone({ frequency: 1160, gain: 0.014, duration: 0.05, type: 'sine', offset: 0.03 });
            break;
        case 'live-bet':
            tone({ frequency: 720, gain: 0.014, duration: 0.05, type: 'triangle' });
            tone({ frequency: 520, gain: 0.01, duration: 0.04, type: 'sine', offset: 0.04 });
            break;
        default:
            tone({ frequency: 430, gain: 0.032, duration: 0.11, type: 'triangle' });
            tone({ frequency: 660, gain: 0.02, duration: 0.12, type: 'sine', offset: 0.04 });
            break;
    }
}

function getNotificationMeta(type) {
    switch (type) {
        case 'success':
            return { icon: 'fa-circle-check', label: 'Success' };
        case 'error':
            return { icon: 'fa-circle-exclamation', label: 'Alert' };
        default:
            return { icon: 'fa-bell', label: 'Update' };
    }
}

function dispatchSiteNotification(message, type = 'info') {
    const stack = document.getElementById('notificationStack');
    if (!stack) return;

    const duplicate = Array.from(stack.querySelectorAll('.notification-text'))
        .some((item) => item.textContent === message);
    if (duplicate) {
        return;
    }

    const meta = getNotificationMeta(type);
    const note = document.createElement('div');
    note.className = `notification ${type}`;
    note.setAttribute('role', 'status');

    const icon = document.createElement('span');
    icon.className = 'notification-icon';
    icon.innerHTML = `<i class="fas ${meta.icon}" aria-hidden="true"></i>`;

    const copy = document.createElement('span');
    copy.className = 'notification-copy';

    const title = document.createElement('strong');
    title.className = 'notification-title';
    title.textContent = meta.label;

    const text = document.createElement('span');
    text.className = 'notification-text';
    text.textContent = message;

    const progress = document.createElement('span');
    progress.className = 'notification-progress';

    copy.append(title, text);
    note.append(icon, copy, progress);

    stack.prepend(note);

    while (stack.children.length > 3) {
        stack.removeChild(stack.lastChild);
    }

    requestAnimationFrame(() => {
        note.classList.add('visible');
    });

    playUiSound(type);

    setTimeout(() => {
        note.classList.remove('visible');
        setTimeout(() => note.remove(), 260);
    }, 2400);
}

function getFallbackAvatarUrl(username) {
    return buildAvatarFallbackDataUri(username || 'BG', 48);
}

function createChatAvatarUrl(username) {
    return `https://mc-heads.net/avatar/${encodeURIComponent(username || 'Steve')}/48`;
}

function getNormalizedGlobalStats(stats = {}) {
    return {
        onlinePlayers: Number(stats.onlinePlayers || 0),
        totalBets: Number(stats.totalBets || 0),
        totalWins: Number(stats.totalWins || 0),
        totalLosses: Number(stats.totalLosses || 0),
        totalWagered: Number(stats.totalWagered || 0),
        netProfit: Number(stats.netProfit || 0)
    };
}

function updateOnlinePlayerSkins(usernames = []) {
    const container = document.getElementById('onlinePlayerSkins');
    if (!container) return;

    const names = [...new Set((Array.isArray(usernames) ? usernames : [])
        .map((name) => String(name || '').trim())
        .filter(Boolean))]
        .slice(0, 10);

    if (names.length === 0) {
        container.innerHTML = '<span class="story-avatar-empty">No live website players yet</span>';
        return;
    }

    container.innerHTML = '';
    names.forEach((username) => {
        const button = document.createElement('button');
        button.className = 'story-avatar-button';
        button.type = 'button';
        button.title = username;
        button.setAttribute('aria-label', `${username} is online`);

        const image = document.createElement('img');
        image.src = createChatAvatarUrl(username);
        image.alt = `${username} skin`;
        image.dataset.avatarName = username;
        image.dataset.avatarSize = '48';
        image.loading = 'lazy';

        const label = document.createElement('span');
        label.textContent = username;

        button.append(image, label);
        container.appendChild(button);
    });
    setupImageFallbacks(container);
}

function updateOnlinePresenceDisplay(presence = {}) {
    const onlineCount = typeof presence === 'number'
        ? Number(presence || 0)
        : Number(presence.onlinePlayers || 0);
    const usernames = typeof presence === 'number' ? [] : presence.usernames || [];
    const onlineLabel = `${onlineCount}`;
    const onlineSummary = `${onlineCount} online now`;

    ['topbarOnlinePlayers', 'statOnlinePlayers', 'summaryOnlinePlayers'].forEach((id) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = onlineLabel;
        }
    });

    const loginOnlinePlayers = document.getElementById('loginOnlinePlayers');
    if (loginOnlinePlayers) {
        loginOnlinePlayers.textContent = `${onlineCount} Online`;
    }

    const chatPresence = document.getElementById('chatPresenceSummary');
    if (chatPresence) {
        chatPresence.textContent = onlineSummary;
    }

    updateOnlinePlayerSkins(usernames);
}

function updateGlobalStatsDisplay(stats = {}) {
    globalRealtimeStats = getNormalizedGlobalStats(stats);
    updateOnlinePresenceDisplay({
        onlinePlayers: globalRealtimeStats.onlinePlayers,
        usernames: stats.usernames || []
    });

    const liveFeedStatus = document.getElementById('liveFeedStatus');
    if (liveFeedStatus) {
        liveFeedStatus.textContent = socket && socket.connected ? 'synced' : 'standby';
    }

    const betsCount = document.getElementById('summaryGlobalBets');
    if (betsCount) {
        betsCount.textContent = `${globalRealtimeStats.totalBets} bets`;
    }

    const wins = document.getElementById('summaryGlobalWins');
    if (wins) {
        wins.textContent = `${globalRealtimeStats.totalWins}`;
    }

    const losses = document.getElementById('summaryGlobalLosses');
    if (losses) {
        losses.textContent = `${globalRealtimeStats.totalLosses}`;
    }

    const volume = document.getElementById('summaryGlobalVolume');
    if (volume) {
        volume.textContent = `$${formatAmount(globalRealtimeStats.totalWagered)}`;
    }
}

function normalizeProvablyFairState(state = {}) {
    return {
        serverSeedHash: state.serverSeedHash || 'Awaiting hash',
        clientSeed: state.clientSeed || (currentPlayer ? `${currentPlayer.username}-seed` : 'guest-seed'),
        nonce: Number(state.nonce || 0),
        nextNonce: Number(state.nextNonce ?? state.nonce ?? 0),
        previousServerSeed: state.previousServerSeed || null,
        previousServerSeedHash: state.previousServerSeedHash || null,
        supportedGames: Array.isArray(state.supportedGames) ? state.supportedGames : []
    };
}

function setProvablyFairState(state = {}) {
    provablyFairState = normalizeProvablyFairState(state);
    renderProvablyFairPanel();
}

function hydratePlayerStateFromResult(result) {
    if (!result || !currentPlayer) return;

    if (Number.isFinite(Number(result.newBalance))) {
        currentPlayer.balance = Number(result.newBalance);
        currentPlayer.walletBalance = Number(result.newBalance);
    } else if (Number.isFinite(Number(result.walletBalance))) {
        currentPlayer.balance = Number(result.walletBalance);
        currentPlayer.walletBalance = Number(result.walletBalance);
    }

    if (Number.isFinite(Number(result.vaultBalance))) {
        currentPlayer.vaultBalance = Number(result.vaultBalance);
    }

    if (Number.isFinite(Number(result.level))) {
        currentPlayer.level = Math.min(Number(result.level), currentPlayer.maxLevel || 100);
    }

    if (Number.isFinite(Number(result.xp))) {
        currentPlayer.xp = Number(result.xp);
    }

    if (Number.isFinite(Number(result.xpToNextLevel))) {
        currentPlayer.xpToNextLevel = Number(result.xpToNextLevel);
    }

    if (Number.isFinite(Number(result.levelProgress))) {
        currentPlayer.levelProgress = Math.max(0, Math.min(1, Number(result.levelProgress)));
    }

    updatePlayerInfo();
    loadDashboardStats();

    if (result.fairness) {
        setProvablyFairState(result.fairness);
    }
}

function setupProvablyFairPanel() {
    document.addEventListener('submit', async (event) => {
        if (event.target.id !== 'provablyFairForm') return;

        event.preventDefault();

        const input = document.getElementById('provablyFairClientSeed');
        const clientSeed = input ? input.value.trim() : '';

        try {
            const response = await fetch('/api/game/fairness/client-seed', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientSeed })
            });
            const data = await readJsonResponse(response, 'Could not update client seed');

            setProvablyFairState(data.fairness);
            showNotification('Provably fair client seed updated.', 'success');
        } catch (error) {
            showNotification(error.message || 'Could not update client seed', 'error');
        }
    });

    document.addEventListener('click', async (event) => {
        const toggleButton = event.target.closest('[data-fairness-action="toggle"]');
        if (toggleButton) {
            provablyFairExpanded = !provablyFairExpanded;
            renderProvablyFairPanel();
            return;
        }

        const rotateButton = event.target.closest('[data-fairness-action="rotate"]');
        if (!rotateButton) return;

        rotateButton.disabled = true;

        try {
            const response = await fetch('/api/game/fairness/rotate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await readJsonResponse(response, 'Could not rotate server seed');

            setProvablyFairState(data.fairness);
            showNotification('Server seed rotated. Previous seed is now revealed.', 'success');
        } catch (error) {
            showNotification(error.message || 'Could not rotate server seed', 'error');
        } finally {
            rotateButton.disabled = false;
        }
    });
}

function renderProvablyFairPanel() {
    const panel = document.getElementById('provablyFairPanel');
    if (!panel) return;

    if (!currentPlayer) {
        panel.innerHTML = '';
        return;
    }

    const state = provablyFairState || normalizeProvablyFairState();
    const supportedGames = state.supportedGames.length > 0
        ? state.supportedGames.filter((game) => game !== 'cases').join(', ')
        : 'cases, dice, plinko, roulette, coinflip, wheel, limbo';
    const shortHash = state.serverSeedHash.length > 20
        ? `${state.serverSeedHash.slice(0, 12)}...${state.serverSeedHash.slice(-6)}`
        : state.serverSeedHash;

    panel.innerHTML = `
        <div class="fairness-shell ${provablyFairExpanded ? 'expanded' : ''}">
            <button class="fairness-toggle" type="button" data-fairness-action="toggle">
                <span class="fairness-toggle-copy">
                    <span class="fairness-toggle-title">Provably Fair</span>
                    <span class="fairness-toggle-subtitle">Hash ${shortHash} • nonce ${state.nextNonce} • protected: cases, ${supportedGames}</span>
                </span>
                <span class="fairness-toggle-badge">${provablyFairExpanded ? 'Hide' : 'Open'}</span>
            </button>
            <div class="fairness-drawer">
                <div class="fairness-card">
                    <div class="fairness-copy">
                        <span class="fairness-kicker">Provably Fair</span>
                        <strong>Server-seeded outcomes with client seed + nonce control.</strong>
                        <p>Protected tables: cases, ${supportedGames}. Interactive tables still run duplicate-locked balance settlements.</p>
                    </div>
                    <div class="fairness-metrics">
                        <div class="fairness-metric">
                            <span>Server Hash</span>
                            <strong>${state.serverSeedHash}</strong>
                        </div>
                        <div class="fairness-metric">
                            <span>Next Nonce</span>
                            <strong>${state.nextNonce}</strong>
                        </div>
                        <div class="fairness-metric">
                            <span>Previous Reveal</span>
                            <strong>${state.previousServerSeed || 'Rotate to reveal'}</strong>
                        </div>
                    </div>
                    <form id="provablyFairForm" class="fairness-controls">
                        <label class="fairness-field">
                            <span>Client Seed</span>
                            <input id="provablyFairClientSeed" type="text" maxlength="48" value="${state.clientSeed}">
                        </label>
                        <div class="fairness-actions">
                            <button class="btn-primary" type="submit">Apply Seed</button>
                            <button class="btn-danger" type="button" data-fairness-action="rotate">Rotate Hash</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
}

async function loadProvablyFairState() {
    if (!currentPlayer) return;

    try {
        const response = await fetch('/api/game/fairness');
        const data = await response.json();

        if (data.success) {
            setProvablyFairState(data.fairness);
        }
    } catch (error) {
        console.error('Failed to load provably fair state:', error);
    }
}

function buildChatMessageElement(entry, animate = true) {
    const item = document.createElement('div');
    item.className = 'chat-message';
    if (!animate) {
        item.style.animation = 'none';
    }

    const avatar = document.createElement('img');
    avatar.className = 'chat-avatar';
    avatar.alt = `${entry.username} skin`;
    avatar.dataset.avatarName = entry.username;
    avatar.dataset.avatarSize = '48';
    avatar.src = entry.avatarUrl || createChatAvatarUrl(entry.username);
    bindImageFallback(avatar);

    const body = document.createElement('div');
    body.className = 'chat-message-body';

    const top = document.createElement('div');
    top.className = 'chat-message-top';

    const user = document.createElement('strong');
    user.className = 'chat-message-user';
    user.textContent = entry.username;

    const time = document.createElement('span');
    time.className = 'chat-message-time';
    time.textContent = formatTimeLabel(entry.timestamp);

    const actions = document.createElement('div');
    actions.className = 'chat-message-actions';

    if (entry.username && currentPlayer?.username && entry.username !== currentPlayer.username && entry.source !== 'tip') {
        const tipButton = document.createElement('button');
        tipButton.className = 'chat-tip-btn';
        tipButton.type = 'button';
        tipButton.dataset.tipRecipient = entry.username;
        tipButton.textContent = 'Tip';
        actions.appendChild(tipButton);
    }

    const text = document.createElement('p');
    text.className = `chat-message-text${entry.source === 'tip' ? ' is-tip' : ''}`;
    text.textContent = entry.message;

    top.append(user, time, actions);
    body.append(top, text);
    item.append(avatar, body);

    return item;
}

function renderChatMessages(messages = []) {
    const container = document.getElementById('liveChatMessages');
    if (!container) return;

    container.innerHTML = '';
    messages
        .slice()
        .reverse()
        .forEach((entry) => {
            container.appendChild(buildChatMessageElement({
                avatarUrl: entry.avatarUrl || createChatAvatarUrl(entry.username),
                ...entry
            }, false));
        });

    container.scrollTop = container.scrollHeight;
}

function addChatMessage(entry, animate = true) {
    const container = document.getElementById('liveChatMessages');
    if (!container) return;

    container.appendChild(buildChatMessageElement({
        avatarUrl: entry.avatarUrl || createChatAvatarUrl(entry.username),
        ...entry
    }, animate));

    while (container.children.length > 30) {
        container.removeChild(container.firstChild);
    }

    container.scrollTop = container.scrollHeight;

    if (animate && entry.username !== currentPlayer?.username) {
        playUiSound('chat');
    }
}

function setupLiveChat() {
    const form = document.getElementById('liveChatForm');
    const input = document.getElementById('liveChatInput');
    if (!form || !input) return;

    input.value = '';
    refreshLiveChatAvailability();

    form.addEventListener('submit', (event) => {
        event.preventDefault();

        if (!currentPlayer) {
            showNotification('Login with a real account to use website chat.', 'info');
            return;
        }

        if (!socket || !socket.connected) {
            showNotification('Chat is reconnecting right now.', 'error');
            return;
        }

        const message = String(input.value || '').trim().slice(0, 220);
        if (!message) {
            return;
        }

        socket.emit('chat:send', { message });
        input.value = '';
    });
}

function openTipModal(username) {
    if (!currentPlayer) {
        showNotification('Login with a real account to tip players.', 'info');
        return;
    }

    if (!username || username === currentPlayer.username) {
        showNotification('Choose another player to tip.', 'info');
        return;
    }

    pendingTipRecipient = username;
    const modal = document.getElementById('chatTipModal');
    const title = document.getElementById('chatTipTitle');
    const input = document.getElementById('chatTipAmount');
    if (!modal || !title || !input) return;

    title.textContent = `Tip ${username}`;
    input.value = '';
    input.dataset.rawAmountValue = '';
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    enhanceAmountInputs(modal);
    input.focus();
    playUiSound('modal-open');
}

function closeTipModal() {
    const modal = document.getElementById('chatTipModal');
    if (!modal) return;

    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    pendingTipRecipient = '';
    playUiSound('modal-close');
}

function sendChatTip() {
    const input = document.getElementById('chatTipAmount');
    const amount = input ? parseAmountInput(input.value) : 0;

    if (!socket || !socket.connected) {
        showNotification('Chat is reconnecting right now.', 'error');
        return;
    }

    if (!pendingTipRecipient) {
        showNotification('Pick a player first.', 'error');
        return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
        showNotification('Enter a valid tip amount.', 'error');
        return;
    }

    const recipient = pendingTipRecipient;
    socket.emit('chat:tip', {
        recipient,
        amount
    });
    closeTipModal();
    showNotification(`Tip sent to ${recipient}.`, 'success');
}

function setupChatTips() {
    document.addEventListener('click', (event) => {
        const tipButton = event.target.closest('[data-tip-recipient]');
        if (tipButton) {
            openTipModal(tipButton.dataset.tipRecipient);
            return;
        }

        if (event.target.id === 'chatTipClose' || event.target.id === 'chatTipModal') {
            closeTipModal();
            return;
        }

        if (event.target.id === 'chatTipSend') {
            sendChatTip();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeTipModal();
        }
    });
}

function refreshLiveChatAvailability() {
    const form = document.getElementById('liveChatForm');
    const input = document.getElementById('liveChatInput');
    if (!form || !input) return;

    const submitButton = form.querySelector("button[type='submit']");
    const enabled = !!currentPlayer;

    input.disabled = !enabled;
    input.readOnly = !enabled;
    input.placeholder = enabled
        ? 'Talk to players on the website'
        : 'Login to join website chat';

    if (submitButton) {
        submitButton.disabled = !enabled;
        submitButton.title = enabled ? 'Send chat message' : 'Website chat requires a real login';
    }
}

function refreshWalletTransferAvailability() {
    const enabled = !!currentPlayer;

    ['deposit', 'withdraw'].forEach((type) => {
        const form = document.getElementById(type === 'deposit' ? 'walletDepositForm' : 'walletWithdrawForm');
        if (!form) return;

        const input = form.querySelector('input[data-amount-input="true"]');
        const button = form.querySelector('button[type="submit"]');
        const busy = form.dataset.busy === 'true';

        if (input) {
            input.disabled = !enabled || busy;
        }

        if (button) {
            button.disabled = !enabled || busy;
        }

        form.classList.toggle('is-disabled', !enabled);
    });
}

function setWalletTransferBusy(type, busy) {
    const form = document.getElementById(type === 'deposit' ? 'walletDepositForm' : 'walletWithdrawForm');
    if (!form) return;

    form.dataset.busy = busy ? 'true' : 'false';
    refreshWalletTransferAvailability();
}

async function submitWalletTransfer(type) {
    if (!currentPlayer) {
        showNotification('Login with a real account to move funds.', 'info');
        return;
    }

    const formId = type === 'deposit' ? 'walletDepositForm' : 'walletWithdrawForm';
    const inputId = type === 'deposit' ? 'walletDepositAmount' : 'walletWithdrawAmount';
    const form = document.getElementById(formId);
    const input = document.getElementById(inputId);
    if (!form || !input) return;

    const amount = parseAmountInput(input.value);
    if (!Number.isFinite(amount) || amount <= 0) {
        showNotification('Enter a valid amount first.', 'error');
        return;
    }

    setWalletTransferBusy(type, true);

    try {
        const response = await fetch('/api/player/transfer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type,
                amount,
                source: 'website',
                requestId: createClientRequestId(`wallet-${type}`)
            })
        });
        const data = await readJsonResponse(response, 'Transfer failed');

        hydratePlayerStateFromResult(data);
        input.value = '';
        input.dataset.rawAmountValue = '';
        showNotification(data.message || 'Wallet updated.', 'success');
    } catch (error) {
        console.error('Wallet transfer failed:', error);
        showNotification(error.message || 'Transfer failed', 'error');
    } finally {
        setWalletTransferBusy(type, false);
    }
}

function setupWalletTransfers() {
    document.addEventListener('submit', (event) => {
        if (event.target.id === 'walletDepositForm') {
            event.preventDefault();
            submitWalletTransfer('deposit');
        }

        if (event.target.id === 'walletWithdrawForm') {
            event.preventDefault();
            submitWalletTransfer('withdraw');
        }
    });

    refreshWalletTransferAvailability();
}

function setupRecentBetsToggle() {
    const toggle = document.getElementById('recentBetsToggle');
    if (!toggle) return;

    toggle.addEventListener('click', () => {
        recentBetsExpanded = !recentBetsExpanded;
        loadRecentBets();
    });
}

function resetSocketConnection() {
    if (!socket) {
        return;
    }

    socket.disconnect();
    socket = null;
}

function buildAvatarFallbackDataUri(name = 'BG', size = 96) {
    const safeName = String(name || 'BG').trim();
    const initials = safeName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase() || 'BG';
    const hueSeed = safeName.split('').reduce((total, char) => total + char.charCodeAt(0), 0);
    const primaryHue = (hueSeed + 198) % 360;
    const secondaryHue = (primaryHue + 24) % 360;
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" fill="none">
            <defs>
                <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="hsl(${primaryHue} 90% 62%)" />
                    <stop offset="100%" stop-color="hsl(${secondaryHue} 86% 54%)" />
                </linearGradient>
            </defs>
            <rect width="${size}" height="${size}" rx="${Math.round(size * 0.18)}" fill="#06121f" />
            <rect x="5" y="5" width="${size - 10}" height="${size - 10}" rx="${Math.round(size * 0.16)}" fill="url(#g)" opacity="0.95" />
            <rect x="${Math.round(size * 0.12)}" y="${Math.round(size * 0.12)}" width="${Math.round(size * 0.18)}" height="${Math.round(size * 0.18)}" fill="#ffffff" opacity="0.16" />
            <rect x="${Math.round(size * 0.7)}" y="${Math.round(size * 0.62)}" width="${Math.round(size * 0.14)}" height="${Math.round(size * 0.14)}" fill="#ffffff" opacity="0.14" />
            <text x="50%" y="55%" text-anchor="middle" font-family="Sora, Arial, sans-serif" font-size="${Math.round(size * 0.34)}" font-weight="800" fill="#f8fbff">${initials}</text>
        </svg>
    `.replace(/\s{2,}/g, ' ').trim();

    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function applyAvatarFallback(img) {
    if (img.dataset.fallbackApplied === 'true') {
        return;
    }

    img.dataset.fallbackApplied = 'true';
    img.src = buildAvatarFallbackDataUri(
        img.dataset.avatarName || img.getAttribute('alt') || 'BG',
        Number(img.dataset.avatarSize || img.width || img.height || 96)
    );
}

function bindImageFallback(img) {
    if (img.dataset.fallbackBound === 'true') {
        return;
    }

    img.dataset.fallbackBound = 'true';
    img.loading = img.loading || 'lazy';
    img.referrerPolicy = 'no-referrer';

    img.addEventListener('error', () => {
        if (img.src.startsWith('data:image/svg+xml')) {
            return;
        }

        applyAvatarFallback(img);
    });

    if (img.complete && img.naturalWidth === 0) {
        applyAvatarFallback(img);
    }
}

function setupImageFallbacks(scope = document) {
    scope.querySelectorAll('img').forEach(bindImageFallback);
}

function parseOptionLabel(label) {
    const normalizedLabel = String(label || '').trim();
    const match = normalizedLabel.match(/^(.*?)\s*\((.*?)\)$/);

    if (!match) {
        return { title: normalizedLabel, hint: '' };
    }

    return {
        title: match[1].trim(),
        hint: match[2].trim()
    };
}

function enhanceOptionSelectors(scope = document) {
    scope.querySelectorAll('select.bet-input').forEach((select) => {
        if (select.dataset.selectorEnhanced === 'true') {
            return;
        }

        select.dataset.selectorEnhanced = 'true';
        select.classList.add('native-select');

        const shell = document.createElement('div');
        shell.className = 'selector-shell';

        const pills = document.createElement('div');
        pills.className = 'selector-pills';
        if ((select.id || '').toLowerCase().includes('risk')) {
            pills.dataset.variant = 'risk';
        }

        const sync = () => {
            pills.querySelectorAll('.selector-pill').forEach((pill) => {
                pill.classList.toggle('active', pill.dataset.value === select.value);
            });
        };

        Array.from(select.options).forEach((option) => {
            const button = document.createElement('button');
            const { title, hint } = parseOptionLabel(option.textContent);

            button.type = 'button';
            button.className = 'selector-pill';
            button.dataset.value = option.value;
            button.innerHTML = `
                <span class="selector-pill-label">${title}</span>
                ${hint ? `<span class="selector-pill-hint">${hint}</span>` : ''}
            `;

            button.addEventListener('click', () => {
                if (select.disabled) return;
                if (select.value === option.value) return;
                select.value = option.value;
                select.dispatchEvent(new Event('change', { bubbles: true }));
                sync();
            });

            pills.appendChild(button);
        });

        select.insertAdjacentElement('afterend', shell);
        shell.appendChild(pills);
        select.addEventListener('change', sync);
        sync();
    });
}

function extractInlineStyleValue(styleText, property) {
    const match = String(styleText || '').match(new RegExp(`${property}\\s*:\\s*([^;]+)`, 'i'));
    return match ? match[1].trim() : '';
}

function getGridColumnCount(columns) {
    const repeatMatch = String(columns || '').match(/repeat\(\s*(\d+)/i);
    if (repeatMatch) {
        return Number(repeatMatch[1]);
    }

    return String(columns || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .length;
}

function registerResponsiveGameLayouts(scope = document) {
    scope.querySelectorAll('[style*="grid-template-columns"]').forEach((element) => {
        const styleText = element.getAttribute('style') || '';
        if (!/display:\s*grid/i.test(styleText)) {
            return;
        }

        const desktopColumns = element.style.gridTemplateColumns || extractInlineStyleValue(styleText, 'grid-template-columns');
        if (!desktopColumns) {
            return;
        }

        if (!element.dataset.desktopColumns) {
            element.dataset.desktopColumns = desktopColumns;
            element.dataset.desktopGap = element.style.gap || extractInlineStyleValue(styleText, 'gap');
        }

        element.classList.add('responsive-grid');
        responsiveGridRegistry.add(element);
    });

    syncResponsiveGameLayouts();
}

function syncResponsiveGameLayouts() {
    responsiveGridRegistry.forEach((element) => {
        if (!element.isConnected) {
            responsiveGridRegistry.delete(element);
            return;
        }

        const desktopColumns = element.dataset.desktopColumns || '1fr';
        const columnCount = getGridColumnCount(desktopColumns);
        const isDenseBoard = columnCount >= 5;

        if (isDenseBoard) {
            if (window.innerWidth <= 560) {
                element.style.gridTemplateColumns = 'repeat(4, minmax(0, 1fr))';
            } else {
                element.style.gridTemplateColumns = desktopColumns;
            }
        } else if (window.innerWidth <= 720 && columnCount >= 2) {
            element.style.gridTemplateColumns = '1fr';
        } else if (window.innerWidth <= 980 && columnCount === 2) {
            element.style.gridTemplateColumns = '1fr';
        } else {
            element.style.gridTemplateColumns = desktopColumns;
        }

        if (element.dataset.desktopGap) {
            element.style.gap = window.innerWidth <= 720 ? '16px' : element.dataset.desktopGap;
        }
    });
}

function enhanceGameUi(scope = document) {
    enhanceAmountInputs(scope);
    enhanceOptionSelectors(scope);
    registerResponsiveGameLayouts(scope);
    setupImageFallbacks(scope);
}

function getGameMeta(game) {
    return GAME_META[game] || {
        title: game.charAt(0).toUpperCase() + game.slice(1),
        eyebrow: 'Casino Floor',
        chip: 'Featured',
        stage: 'Featured Table',
        description: 'This table is available in the shared lobby.',
        icon: 'fa-star'
    };
}

function loaderName(game) {
    return `load${game.charAt(0).toUpperCase() + game.slice(1)}Game`;
}

function formatTimeLabel(timestamp) {
    if (!timestamp) return 'just now';

    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return 'just now';

    const diffMs = Date.now() - date.getTime();
    const diffMinutes = Math.max(0, Math.round(diffMs / 60000));

    if (diffMinutes < 1) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;

    const hours = Math.round(diffMinutes / 60);
    if (hours < 24) return `${hours}h ago`;

    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    }).format(date);
}

async function checkSession() {
    try {
        const response = await fetch('/api/auth/session');
        const data = await response.json();

        if (data.loggedIn) {
            setCurrentPlayerState(data.player);
            showMainScreen();
        }
    } catch (error) {
        console.error('Session check failed:', error);
    }
}

function setupLoginForm() {
    const form = document.getElementById('loginForm');
    const errorDiv = document.getElementById('loginError');

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        errorDiv.textContent = '';

        const username = document.getElementById('username').value.trim();
        const code = document.getElementById('code').value.trim();

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, code })
            });

            const data = await response.json();

            if (!data.success) {
                errorDiv.textContent = data.message || 'Login failed.';
                return;
            }

            setCurrentPlayerState(data.player);
            playerStats = null;
            showMainScreen();
        } catch (error) {
            errorDiv.textContent = 'Connection error. Please try again.';
            console.error('Login error:', error);
        }
    });
}

function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');

    navItems.forEach((item) => {
        item.addEventListener('click', (event) => {
            event.preventDefault();
            setActiveGame(item.dataset.game);
        });
    });
}

function setupLogout() {
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            resetSocketConnection();
            location.reload();
        } catch (error) {
            console.error('Logout error:', error);
        }
    });
}

function showMainScreen() {
    document.getElementById('loginScreen').classList.remove('active');
    document.getElementById('mainScreen').classList.add('active');

    updatePlayerInfo();
    refreshLiveChatAvailability();
    renderProvablyFairPanel();
    updateGameChrome(currentGame);
    loadGame(currentGame);
    loadDashboardStats();
    loadRecentBets();
    loadProvablyFairState();

    resetSocketConnection();
    connectSocket();
}

function updatePlayerInfo() {
    if (!currentPlayer) return;

    document.getElementById('userName').textContent = currentPlayer.username;
    document.getElementById('userLevel').textContent = `Level ${currentPlayer.level}`;
    document.getElementById('userBalance').textContent = '$' + formatAmount(currentPlayer.balance);
    document.getElementById('sidebarBalance').textContent = '$' + formatAmount(currentPlayer.balance);
    const vaultBalance = document.getElementById('vaultBalance');
    if (vaultBalance) {
        vaultBalance.textContent = '$' + formatAmount(currentPlayer.vaultBalance);
    }

    const walletTransferBalance = document.getElementById('walletTransferBalance');
    if (walletTransferBalance) {
        walletTransferBalance.textContent = '$' + formatAmount(currentPlayer.balance);
    }

    const vaultTransferBalance = document.getElementById('vaultTransferBalance');
    if (vaultTransferBalance) {
        vaultTransferBalance.textContent = '$' + formatAmount(currentPlayer.vaultBalance);
    }

    const profileLevel = document.getElementById('profileLevelValue');
    if (profileLevel) {
        profileLevel.textContent = `Level ${currentPlayer.level}/${currentPlayer.maxLevel}`;
    }

    const profileXp = document.getElementById('profileXpValue');
    if (profileXp) {
        profileXp.textContent = currentPlayer.level >= currentPlayer.maxLevel
            ? 'Max level reached'
            : `${formatAmount(currentPlayer.xpIntoLevel)} XP now - ${formatAmount(currentPlayer.xpToNextLevel)} XP left`;
    }

    const profileXpFill = document.getElementById('profileXpFill');
    if (profileXpFill) {
        profileXpFill.style.width = `${Math.round((currentPlayer.levelProgress || 0) * 100)}%`;
    }

    const skinUrl = `https://mc-heads.net/avatar/${currentPlayer.username}/48`;
    const avatar = document.getElementById('userSkin');
    avatar.dataset.avatarName = currentPlayer.username;
    avatar.dataset.fallbackApplied = 'false';
    bindImageFallback(avatar);
    avatar.src = skinUrl;

    const chatAvatar = document.getElementById('chatUserAvatar');
    if (chatAvatar) {
        chatAvatar.dataset.avatarName = currentPlayer.username;
        chatAvatar.dataset.fallbackApplied = 'false';
        bindImageFallback(chatAvatar);
        chatAvatar.src = skinUrl;
    }

    refreshLiveChatAvailability();
    refreshWalletTransferAvailability();
}

function renderModeStrip() {
    const loginModeStrip = document.getElementById('loginModeStrip');
    const modeShowcase = document.getElementById('modeShowcase');

    if (loginModeStrip) {
        loginModeStrip.innerHTML = GAME_ORDER.map((game) => {
            const meta = getGameMeta(game);
            return `
                <span class="mode-pill">
                    <i class="fas ${meta.icon}"></i>
                    <span>${meta.title}</span>
                </span>
            `;
        }).join('');
    }

    if (modeShowcase) {
        modeShowcase.innerHTML = GAME_ORDER.map((game) => {
            const meta = getGameMeta(game);
            return `
                <button class="showcase-card ${game === currentGame ? 'active' : ''}" data-showcase-game="${game}" type="button">
                    <i class="fas ${meta.icon}"></i>
                    <span>${meta.title}</span>
                </button>
            `;
        }).join('');

        modeShowcase.querySelectorAll('[data-showcase-game]').forEach((button) => {
            button.addEventListener('click', () => setActiveGame(button.dataset.showcaseGame));
        });
    }

    const supportCount = document.getElementById('supportCount');
    if (supportCount) {
        supportCount.textContent = `${GAME_ORDER.length} Modes`;
    }
}

function renderQuickSwitch() {
    const quickSwitch = document.getElementById('gameQuickSwitch');
    if (!quickSwitch) return;

    quickSwitch.innerHTML = GAME_ORDER.slice(0, 6).map((game) => {
        const meta = getGameMeta(game);
        return `
            <button class="switch-chip ${game === currentGame ? 'active' : ''}" data-quick-game="${game}" type="button">
                ${meta.title}
            </button>
        `;
    }).join('');

    quickSwitch.querySelectorAll('[data-quick-game]').forEach((button) => {
        button.addEventListener('click', () => setActiveGame(button.dataset.quickGame));
    });
}

function loadProfileGame(container) {
    if (!currentPlayer) {
        container.innerHTML = '<div class="game-container"><div class="feed-empty-state">Login first to view your profile.</div></div>';
        return;
    }

    container.innerHTML = `
        <div class="profile-shell">
            <section class="profile-hero-panel">
                <div class="profile-avatar-wrap">
                    <img src="${createChatAvatarUrl(currentPlayer.username)}" alt="${currentPlayer.username} skin" data-avatar-name="${currentPlayer.username}" data-avatar-size="96">
                </div>
                <div class="profile-hero-copy">
                    <span class="banner-tag">BingungSMP Gamble</span>
                    <h3>${currentPlayer.username}</h3>
                    <p>Website wallet starts from zero. Deposit pulls money from Minecraft into the website wallet, and withdraw sends website winnings back to Minecraft.</p>
                    <div class="profile-level-row">
                        <strong id="profileLevelValue">Level ${currentPlayer.level}/${currentPlayer.maxLevel}</strong>
                        <span id="profileXpValue">${currentPlayer.level >= currentPlayer.maxLevel ? 'Max level reached' : `${formatAmount(currentPlayer.xpToNextLevel)} XP left`}</span>
                    </div>
                    <div class="profile-xp-track"><span id="profileXpFill"></span></div>
                </div>
            </section>

            <section class="profile-stats-section">
                <div class="dashboard-banner profile-dashboard-banner">
                    <div>
                        <span class="banner-tag">Profile Overview</span>
                        <h3>All your wallet, level, and mode info lives here.</h3>
                        <p>Deposit while offline, withdraw while offline, and let the server apply the Minecraft Vault balance when you join again.</p>
                    </div>
                    <div class="mode-showcase" id="modeShowcase"></div>
                </div>

                <div class="overview-grid">
                    <div class="overview-card"><span class="overview-label">Total Wagered</span><strong id="statWagered">$0.00</strong></div>
                    <div class="overview-card"><span class="overview-label">Winning Bets</span><strong id="statWins">0</strong></div>
                    <div class="overview-card"><span class="overview-label">Biggest Hit</span><strong id="statBiggest">$0.00</strong></div>
                    <div class="overview-card"><span class="overview-label">Players Online</span><strong id="statOnlinePlayers">${globalRealtimeStats?.onlinePlayers || 0}</strong></div>
                </div>
            </section>

            <section class="wallet-transfer-section">
                <div class="wallet-transfer-overview">
                    <div class="wallet-balance-card">
                        <span class="wallet-card-label">Website Wallet</span>
                        <strong id="walletTransferBalance">$${formatAmount(currentPlayer.balance)}</strong>
                        <p>Every website bet uses this balance only.</p>
                    </div>
                    <div class="wallet-balance-card minecraft-balance-card">
                        <span class="wallet-card-label">Minecraft Balance</span>
                        <strong id="vaultTransferBalance">$${formatAmount(currentPlayer.vaultBalance)}</strong>
                        <p>This is your in-game Vault money. Deposit moves it into the website wallet.</p>
                    </div>
                </div>

                <div class="wallet-transfer-grid">
                    <form id="walletDepositForm" class="wallet-transfer-card">
                        <div class="wallet-transfer-copy">
                            <span class="wallet-transfer-kicker">Deposit</span>
                            <strong>Move Minecraft money into the website</strong>
                            <p>Your in-game balance decreases, and your website wallet increases by the same amount.</p>
                        </div>

                        <div class="wallet-transfer-controls">
                            <label class="wallet-transfer-input">
                                <span>Amount</span>
                                <input id="walletDepositAmount" type="text" placeholder="1k, 1m, 1b" data-amount-input="true" autocomplete="off">
                            </label>
                            <button class="btn-primary wallet-transfer-btn" type="submit">Deposit</button>
                        </div>
                    </form>

                    <form id="walletWithdrawForm" class="wallet-transfer-card">
                        <div class="wallet-transfer-copy">
                            <span class="wallet-transfer-kicker">Withdraw</span>
                            <strong>Send website money back to Minecraft</strong>
                            <p>Your website wallet decreases, and your in-game Vault balance receives the money.</p>
                        </div>

                        <div class="wallet-transfer-controls">
                            <label class="wallet-transfer-input">
                                <span>Amount</span>
                                <input id="walletWithdrawAmount" type="text" placeholder="1k, 1m, 1b" data-amount-input="true" autocomplete="off">
                            </label>
                            <button class="btn-secondary wallet-transfer-btn" type="submit">Withdraw</button>
                        </div>
                    </form>
                </div>
            </section>
        </div>
    `;

    container.querySelectorAll('img[data-avatar-name]').forEach(bindImageFallback);
    enhanceAmountInputs(container);
    renderModeStrip();
    updateStatsDisplay(playerStats || {});
    updatePlayerInfo();
}

function setActiveGame(game) {
    currentGame = game;
    updateGameChrome(game);
    loadGame(game);
}

function updateGameChrome(game) {
    const meta = getGameMeta(game);

    document.getElementById('gameTitle').textContent = meta.title;
    document.getElementById('gameEyebrow').textContent = meta.eyebrow;
    document.getElementById('gameModeChip').textContent = meta.chip;
    document.getElementById('gameDescription').textContent = meta.description;
    document.getElementById('stageFocus').textContent = meta.stage;

    document.querySelectorAll('.nav-item').forEach((item) => {
        item.classList.toggle('active', item.dataset.game === game);
    });

    document.querySelectorAll('[data-showcase-game]').forEach((item) => {
        item.classList.toggle('active', item.dataset.showcaseGame === game);
    });

    document.querySelectorAll('[data-quick-game]').forEach((item) => {
        item.classList.toggle('active', item.dataset.quickGame === game);
    });
}

function loadGame(game) {
    const gameContent = document.getElementById('gameContent');
    if (window.cleanupGameRuntime) {
        window.cleanupGameRuntime();
    }
    gameContent.dataset.activeGame = game;
    const loader = window[loaderName(game)];

    if (typeof loader === 'function') {
        loader(gameContent);
        enhanceGameUi(gameContent);
        return;
    }

    const meta = getGameMeta(game);
    gameContent.innerHTML = `
        <div class="game-container fallback-container">
            <h3 class="game-title">${meta.title}</h3>
            <p class="fallback-copy">${meta.description}</p>
            <button class="btn-primary fallback-button" type="button" onclick="setActiveGame('crash')">
                Back To Crash
            </button>
        </div>
    `;
    enhanceGameUi(gameContent);
}

async function connectSocket() {
    if (socket) {
        return;
    }

    socket = io();

    socket.on('connect', () => {
        const liveFeedStatus = document.getElementById('liveFeedStatus');
        if (liveFeedStatus) {
            liveFeedStatus.textContent = 'synced';
        }
    });

    socket.on('disconnect', () => {
        const liveFeedStatus = document.getElementById('liveFeedStatus');
        if (liveFeedStatus) {
            liveFeedStatus.textContent = 'reconnecting';
        }
    });

    socket.on('casino:snapshot', (payload) => {
        if (payload?.globalStats) {
            updateGlobalStatsDisplay(payload.globalStats);
        }

        if (Array.isArray(payload?.chatMessages)) {
            renderChatMessages(payload.chatMessages);
        }

        if (payload?.crashState && window.handleCrashRealtimeState) {
            window.handleCrashRealtimeState(payload.crashState);
        }
    });

    socket.on('presence:update', (presence) => {
        updateOnlinePresenceDisplay(presence || {});
    });

    socket.on('global:stats', (stats) => {
        updateGlobalStatsDisplay(stats);
    });

    socket.on('chat:new', (entry) => {
        addChatMessage(entry);
    });

    socket.on('chat:error', (payload) => {
        showNotification(payload?.message || 'Chat could not send.', 'error');
    });

    socket.on('newBet', (bet) => {
        addLiveBet(bet);
    });

    socket.on('crash:state', (payload) => {
        if (window.handleCrashRealtimeState) {
            window.handleCrashRealtimeState(payload);
        }
    });

    socket.on('crash:bet-settled', (payload) => {
        hydratePlayerStateFromResult(payload);
        if (window.handleCrashBetSettlement) {
            window.handleCrashBetSettlement(payload);
        }
    });

    socket.on('jackpot:state', (payload) => {
        if (window.handleJackpotState) {
            window.handleJackpotState(payload);
        }
    });

    socket.on('wallet:updated', (payload) => {
        hydratePlayerStateFromResult({
            newBalance: payload?.walletBalance,
            walletBalance: payload?.walletBalance,
            vaultBalance: payload?.vaultBalance
        });
    });
}

async function loadDashboardStats() {
    if (!currentPlayer) return;

    try {
        const response = await fetch('/api/player/stats');
        const data = await response.json();

        if (data.success) {
            setCurrentPlayerState(data.player);
            playerStats = data.player;
            updatePlayerInfo();
            updateStatsDisplay(playerStats);
        }
    } catch (error) {
        console.error('Failed to load stats:', error);
    }
}

function updateStatsDisplay(stats) {
    const statWagered = document.getElementById('statWagered');
    const statWins = document.getElementById('statWins');
    const statBiggest = document.getElementById('statBiggest');

    if (statWagered) statWagered.textContent = '$' + formatAmount(stats.totalWagered || 0);
    if (statWins) statWins.textContent = `${stats.wins || 0}`;
    if (statBiggest) statBiggest.textContent = '$' + formatAmount(stats.biggestWin || 0);
}

async function loadRecentBets() {
    const container = document.getElementById('liveBets');
    if (!container) return;

    container.innerHTML = '';
    const toggle = document.getElementById('recentBetsToggle');
    if (toggle) {
        toggle.textContent = recentBetsExpanded ? 'Last 5' : 'More';
        toggle.title = recentBetsExpanded ? 'Show the newest 5 global bets' : 'Show all global bets from the past hour';
    }

    try {
        const query = recentBetsExpanded ? '?scope=hour&limit=100' : '';
        const response = await fetch(`/api/game/recent-bets${query}`);
        const data = await response.json();

        if (data.success && data.bets.length > 0) {
            data.bets.forEach((bet) => addLiveBet(bet, false));
        } else {
            container.innerHTML = '<div class="feed-empty-state">Waiting for real wagers...</div>';
        }
    } catch (error) {
        console.error('Failed to load recent bets:', error);
        container.innerHTML = '<div class="feed-empty-state">Realtime bets are reconnecting...</div>';
    }
}

function addLiveBet(bet, animate = true) {
    const container = document.getElementById('liveBets');
    if (!container) return;

    if (container.querySelector('.feed-empty-state')) {
        container.innerHTML = '';
    }

    const meta = getGameMeta(bet.gameType || 'crash');
    const betItem = document.createElement('div');
    betItem.className = `live-bet ${bet.won ? 'win' : 'loss'}`;

    if (!animate) {
        betItem.style.animation = 'none';
    }

    const profit = Number(bet.profit || 0);
    const multiplierLabel = Number.isFinite(Number(bet.multiplier)) && Number(bet.multiplier) > 0
        ? `${Number(bet.multiplier).toFixed(2)}x`
        : '0.00x';
    const avatar = document.createElement('img');
    avatar.className = 'live-bet-avatar';
    avatar.alt = `${bet.username} skin`;
    avatar.dataset.avatarName = bet.username;
    avatar.dataset.avatarSize = '48';
    avatar.src = createChatAvatarUrl(bet.username);
    bindImageFallback(avatar);

    const content = document.createElement('div');
    content.className = 'live-bet-content';
    content.innerHTML = `
        <div class="live-bet-top">
            <div>
                <span class="live-bet-user">${bet.username}</span>
                <span class="live-bet-type">${meta.title}</span>
            </div>
            <span class="live-bet-time">${formatTimeLabel(bet.timestamp)}</span>
        </div>
        <div class="live-bet-middle">
            <span class="live-bet-amount">$${formatAmount(bet.amount)}</span>
            <span class="live-bet-multiplier">${multiplierLabel}</span>
        </div>
        <div class="live-bet-result ${profit >= 0 ? 'positive' : 'negative'}">
            ${profit >= 0 ? '+' : ''}$${formatAmount(profit)}
        </div>
    `;

    betItem.append(avatar, content);

    container.insertBefore(betItem, container.firstChild);

    const maxVisibleBets = recentBetsExpanded ? 100 : 5;
    while (container.children.length > maxVisibleBets) {
        container.removeChild(container.lastChild);
    }

    if (animate && bet.username !== currentPlayer?.username) {
        playUiSound('live-bet');
    }
}

function reserveDisplayedBalance(amount) {
    currentPlayer.balance -= amount;
    currentPlayer.walletBalance = currentPlayer.balance;
    updatePlayerInfo();
}

async function playServerGame({ gameType = currentGame, amount, payload = {} }) {
    const wager = Number(amount || 0);

    try {
        const response = await fetch('/api/game/play', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                gameType,
                amount: wager,
                requestId: createClientRequestId(gameType),
                ...payload
            })
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || 'Failed to resolve wager');
        }

        hydratePlayerStateFromResult(data);
        return data;
    } catch (error) {
        console.error('Server play failed:', error);
        showNotification(error.message || 'Failed to resolve wager', 'error');
        return null;
    }
}

async function settleWager({ amount, payout, multiplier, won, gameType = currentGame }) {
    const wager = Number(amount || 0);
    const finalPayout = Math.max(0, Number(payout || 0));
    const finalMultiplier = Number.isFinite(Number(multiplier)) ? Number(multiplier) : (wager > 0 ? finalPayout / wager : 0);
    const didWin = typeof won === 'boolean' ? won : finalPayout > wager;
    const profit = finalPayout - wager;


    try {
        const response = await fetch('/api/game/settle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount: wager,
                payout: finalPayout,
                multiplier: finalMultiplier,
                won: didWin,
                gameType,
                requestId: createClientRequestId(gameType)
            })
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || 'Failed to sync wager');
        }

        hydratePlayerStateFromResult(data);
        return data;
    } catch (error) {
        currentPlayer.balance += wager;
        currentPlayer.walletBalance = currentPlayer.balance;
        updatePlayerInfo();
        console.error('Wager settlement failed:', error);
        showNotification(error.message || 'Failed to sync wager', 'error');
        return null;
    }
}

function showNotification(message, type = 'info') {
    dispatchSiteNotification(message, type);
}

window.parseAmountInput = parseAmountInput;
window.readAmountInput = readAmountInput;
window.setAmountInputValue = setAmountInputValue;
window.enhanceAmountInputs = enhanceAmountInputs;
window.dispatchSiteNotification = dispatchSiteNotification;
window.playUiSound = playUiSound;
window.playServerGame = playServerGame;
