let caseCatalog = [];
let caseCatalogPromise = null;
let caseOpenBusy = false;
let activeBattles = [];
let selectedBattleCaseId = null;
const battleBots = ['Nova', 'Quartz', 'Miso', 'Rogue', 'Pixel', 'Vanta', 'Hex', 'Blaze'];

const rarityColors = {
    common: '#94a3b8',
    uncommon: '#34d399',
    rare: '#38bdf8',
    epic: '#818cf8',
    legendary: '#f59e0b'
};

function getCaseItemToken(name) {
    return String(name || '')
        .split(/\s+/)
        .slice(0, 3)
        .map((part) => part.charAt(0))
        .join('')
        .toUpperCase();
}

function getCaseById(caseId) {
    return caseCatalog.find((entry) => entry.id === caseId) || null;
}

async function ensureCaseCatalog() {
    if (caseCatalog.length > 0) {
        return caseCatalog;
    }

    if (!caseCatalogPromise) {
        caseCatalogPromise = fetch('/api/game/cases/catalog')
            .then((response) => response.json())
            .then((data) => {
                caseCatalog = Array.isArray(data?.cases) ? data.cases : [];
                if (!selectedBattleCaseId && caseCatalog.length > 0) {
                    selectedBattleCaseId = caseCatalog[0].id;
                }
                return caseCatalog;
            })
            .catch((error) => {
                console.error('Failed to load case catalog:', error);
                caseCatalog = [];
                return caseCatalog;
            });
    }

    return caseCatalogPromise;
}

function pickLocalCaseItem(caseInfo) {
    const roll = Math.random() * 100;
    let cumulative = 0;

    for (const item of caseInfo.items) {
        cumulative += Number(item.chance || 0);
        if (roll < cumulative) {
            return item;
        }
    }

    return caseInfo.items[caseInfo.items.length - 1];
}

function ensureCaseStyles() {
    if (document.getElementById('caseStyles')) return;

    const style = document.createElement('style');
    style.id = 'caseStyles';
    style.textContent = `
        .cases-shell,
        .case-battles-shell {
            display: grid;
            gap: 20px;
        }

        .cases-grid {
            display: grid;
            gap: 16px;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        }

        .case-card {
            display: grid;
            gap: 14px;
            padding: 18px;
        }

        .case-card-top {
            align-items: center;
            display: flex;
            gap: 12px;
            justify-content: space-between;
        }

        .case-icon {
            align-items: center;
            border-radius: 14px;
            display: inline-flex;
            font-size: 1.35rem;
            height: 52px;
            justify-content: center;
            width: 52px;
        }

        .case-name {
            font-size: 1rem;
            font-weight: 800;
            line-height: 1.3;
            margin: 0;
        }

        .case-price {
            color: var(--accent-success);
            font-size: 0.96rem;
            font-weight: 800;
        }

        .case-range {
            color: var(--text-secondary);
            font-size: 0.78rem;
        }

        .case-item-strip {
            display: grid;
            gap: 8px;
            grid-template-columns: repeat(5, minmax(0, 1fr));
        }

        .case-item-preview {
            align-items: center;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(124, 199, 255, 0.12);
            border-radius: 12px;
            display: grid;
            gap: 6px;
            justify-items: center;
            min-height: 92px;
            padding: 8px 6px;
            text-align: center;
        }

        .case-item-badge {
            align-items: center;
            border-radius: 10px;
            color: #03111d;
            display: inline-flex;
            font-size: 0.72rem;
            font-weight: 900;
            justify-content: center;
            min-width: 40px;
            padding: 8px;
        }

        .case-item-name {
            font-size: 0.64rem;
            line-height: 1.25;
        }

        .case-item-value {
            color: var(--text-secondary);
            font-size: 0.66rem;
            font-weight: 700;
        }

        .case-summary-bar {
            display: grid;
            gap: 12px;
            grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .case-summary-pill {
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid rgba(124, 199, 255, 0.12);
            border-radius: 14px;
            padding: 12px 14px;
        }

        .case-spinner-container {
            background: rgba(8, 18, 32, 0.72);
            border: 1px solid rgba(124, 199, 255, 0.2);
            border-radius: 20px;
            height: 190px;
            margin: 28px 0;
            overflow: hidden;
            position: relative;
        }

        .case-spinner {
            display: flex;
            gap: 20px;
            padding: 16px;
            transition: transform 5s cubic-bezier(0.17, 0.67, 0.12, 0.99);
        }

        .case-spinner-item {
            align-items: center;
            background: linear-gradient(180deg, rgba(14, 27, 44, 0.94), rgba(7, 16, 29, 0.98));
            border: 3px solid;
            border-radius: 16px;
            display: grid;
            gap: 8px;
            height: 150px;
            justify-items: center;
            min-width: 150px;
            padding: 14px;
            text-align: center;
            transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;
        }

        .case-spinner-item.is-winning {
            box-shadow: 0 18px 36px rgba(124, 199, 255, 0.24);
            transform: translateY(-6px) scale(1.02);
        }

        .case-spinner-item-badge {
            align-items: center;
            border-radius: 12px;
            color: #02111b;
            display: inline-flex;
            font-size: 0.76rem;
            font-weight: 900;
            justify-content: center;
            min-width: 54px;
            padding: 9px 10px;
        }

        .case-spinner-item-name {
            font-size: 0.88rem;
            font-weight: 800;
            line-height: 1.3;
        }

        .case-spinner-item-value {
            color: var(--accent-success);
            font-size: 1rem;
            font-weight: 800;
        }

        .case-pointer {
            background: linear-gradient(180deg, transparent, var(--accent-primary), transparent);
            box-shadow: 0 0 24px rgba(124, 199, 255, 0.8);
            height: 172px;
            left: 50%;
            position: absolute;
            top: 50%;
            transform: translate(-50%, -50%);
            width: 4px;
            z-index: 3;
        }

        .case-result {
            background: rgba(8, 18, 32, 0.72);
            border-radius: 18px;
            display: none;
            padding: 24px;
            text-align: center;
        }

        .case-result.active {
            display: block;
        }

        .modal {
            align-items: center;
            background: rgba(0, 0, 0, 0.82);
            display: none;
            inset: 0;
            justify-content: center;
            padding: 20px;
            position: fixed;
            z-index: 10000;
        }

        .modal.active {
            display: flex;
        }

        .case-opening-content {
            max-width: min(860px, 96vw);
            position: relative;
            width: 100%;
        }

        .modal-close {
            align-items: center;
            background: rgba(239, 68, 68, 0.16);
            border: 1px solid rgba(239, 68, 68, 0.28);
            border-radius: 999px;
            color: #f8fbff;
            display: inline-flex;
            font-size: 1.4rem;
            height: 44px;
            justify-content: center;
            position: absolute;
            right: 18px;
            top: 18px;
            width: 44px;
        }

        .case-result-item {
            font-size: 3rem;
            margin-bottom: 12px;
        }

        .case-result-name {
            font-size: 1.4rem;
            font-weight: 900;
            margin-bottom: 10px;
        }

        .case-result-value {
            color: var(--accent-success);
            font-size: 2rem;
            font-weight: 900;
            margin-bottom: 10px;
        }

        .battle-player-slot {
            background: rgba(52, 211, 153, 0.08);
            border: 1px solid rgba(52, 211, 153, 0.22);
            border-radius: 12px;
            padding: 10px 12px;
        }

        @media (max-width: 760px) {
            .case-summary-bar {
                grid-template-columns: 1fr;
            }

            .case-item-strip {
                grid-template-columns: repeat(3, minmax(0, 1fr));
            }

            .case-spinner-container {
                height: 170px;
            }

            .case-spinner-item {
                height: 132px;
                min-width: 126px;
            }
        }
    `;
    document.head.appendChild(style);
}

async function loadCasesGame(container) {
    ensureCaseStyles();
    container.dataset.caseLoader = 'cases';
    container.innerHTML = '<div class="game-container"><div class="feed-empty-state">Loading case vault...</div></div>';
    const catalog = await ensureCaseCatalog();

    if (!container.isConnected || container.dataset.activeGame !== 'cases' || container.dataset.caseLoader !== 'cases') return;

    if (catalog.length === 0) {
        container.innerHTML = '<div class="game-container"><div class="feed-empty-state">Case vault is unavailable right now.</div></div>';
        return;
    }

    const lowestCase = catalog[0];
    const highestCase = catalog[catalog.length - 1];

    container.innerHTML = `
        <div class="cases-shell">
            <div class="case-summary-bar">
                <div class="case-summary-pill">
                    <span class="bet-label">Total Cases</span>
                    <strong>${catalog.length}</strong>
                </div>
                <div class="case-summary-pill">
                    <span class="bet-label">Lowest Entry</span>
                    <strong>$${formatAmount(lowestCase.price)}</strong>
                </div>
                <div class="case-summary-pill">
                    <span class="bet-label">Highest Entry</span>
                    <strong>$${formatAmount(highestCase.price)}</strong>
                </div>
            </div>
            <div class="cases-grid">
                ${catalog.map((caseInfo) => `
                    <article class="case-card">
                        <div class="case-card-top">
                            <div style="display:flex; gap:12px; min-width:0;">
                                <div class="case-icon" style="background: linear-gradient(135deg, ${caseInfo.color}, rgba(15, 23, 42, 0.85)); color: #f8fbff;">
                                    <i class="fas ${caseInfo.icon}"></i>
                                </div>
                                <div style="min-width:0;">
                                    <h3 class="case-name">${caseInfo.name}</h3>
                                    <div class="case-price">$${formatAmount(caseInfo.price)}</div>
                                    <div class="case-range">Up to ${caseInfo.maxMultiplier.toFixed(2)}x</div>
                                </div>
                            </div>
                            <button class="btn-primary" type="button" onclick="showCaseInfo('${caseInfo.id}')">Inspect</button>
                        </div>
                        <div class="case-item-strip">
                            ${caseInfo.items.map((item) => `
                                <div class="case-item-preview">
                                    <span class="case-item-badge" style="background:${rarityColors[item.rarity]};">${getCaseItemToken(item.name)}</span>
                                    <span class="case-item-name">${item.name}</span>
                                    <span class="case-item-value">$${formatAmount(item.value)}</span>
                                </div>
                            `).join('')}
                        </div>
                    </article>
                `).join('')}
            </div>
            <div id="caseOpeningModal" class="modal">
                <div class="modal-content case-opening-content">
                    <button class="modal-close" type="button" onclick="closeCaseModal()">&times;</button>
                    <h2 id="caseOpeningTitle">Case Information</h2>
                    <div id="caseInfoPanel" class="case-info-panel"></div>
                    <div class="case-spinner-container" id="caseSpinnerContainer">
                        <div class="case-spinner" id="caseSpinner"></div>
                        <div class="case-pointer"></div>
                    </div>
                    <div id="caseResult" class="case-result"></div>
                </div>
            </div>
        </div>
    `;
}

function buildSpinnerSequence(caseInfo, winningItem) {
    const filler = Array.from({ length: 42 }, (_, index) => {
        if (index === 24) {
            return winningItem;
        }
        return caseInfo.items[Math.floor(Math.random() * caseInfo.items.length)];
    });

    return filler;
}

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function showCaseInfo(caseId) {
    const caseInfo = getCaseById(caseId);
    if (!caseInfo) {
        showNotification('Case not found.', 'error');
        return;
    }

    const modal = document.getElementById('caseOpeningModal');
    const title = document.getElementById('caseOpeningTitle');
    const infoPanel = document.getElementById('caseInfoPanel');
    const spinnerContainer = document.getElementById('caseSpinnerContainer');
    const result = document.getElementById('caseResult');
    const spinner = document.getElementById('caseSpinner');
    if (!modal || !title || !infoPanel || !spinnerContainer || !result || !spinner) return;

    title.textContent = caseInfo.name;
    spinnerContainer.classList.add('is-hidden');
    result.classList.remove('active');
    result.innerHTML = '';
    spinner.innerHTML = '';
    spinner.style.transform = 'translateX(0)';

    infoPanel.innerHTML = `
        <div class="case-info-head">
            <div class="case-icon case-info-icon" style="background: linear-gradient(135deg, ${caseInfo.color}, rgba(15, 23, 42, 0.86)); color: #f8fbff;">
                <i class="fas ${caseInfo.icon}"></i>
            </div>
            <div>
                <span class="case-range">Entry $${formatAmount(caseInfo.price)} - up to ${caseInfo.maxMultiplier.toFixed(2)}x</span>
                <p>Check the rewards first, then choose how many crates to open.</p>
            </div>
        </div>
        <div class="case-reward-list">
            ${caseInfo.items.map((item) => `
                <div class="case-reward-row">
                    <span class="case-item-badge" style="background:${rarityColors[item.rarity]};">${getCaseItemToken(item.name)}</span>
                    <div>
                        <strong>${item.name}</strong>
                        <span>${item.rarity} - ${Number(item.chance || 0).toFixed(2)}%</span>
                    </div>
                    <em>$${formatAmount(item.value)}</em>
                </div>
            `).join('')}
        </div>
        <div class="case-open-actions">
            <button class="btn-primary" type="button" onclick="openCase('${caseInfo.id}', 1)">Open 1</button>
            <button class="btn-secondary" type="button" onclick="openCase('${caseInfo.id}', 3)">Open 3</button>
            <button class="btn-danger" type="button" onclick="openCase('${caseInfo.id}', 10)">Open 10</button>
        </div>
    `;

    modal.classList.add('active');
    playUiSound('modal-open');
}

function runCaseSpin({ caseInfo, winningItem, spinIndex, openCount, spinner, title }) {
    return new Promise((resolve) => {
        const spinDuration = 4300;

        title.textContent = openCount > 1
            ? `Opening crate ${spinIndex + 1} of ${openCount}...`
            : `Opening ${caseInfo.name}...`;
        spinner.innerHTML = '';
        spinner.style.transition = 'none';
        spinner.style.transform = 'translateX(0)';
        spinner.offsetHeight;
        spinner.style.transition = `transform ${spinDuration}ms cubic-bezier(0.17, 0.67, 0.12, 0.99)`;

        buildSpinnerSequence(caseInfo, winningItem).forEach((item) => {
            const itemEl = document.createElement('div');
            itemEl.className = `case-spinner-item${item === winningItem ? ' is-winning' : ''}`;
            itemEl.style.borderColor = rarityColors[item.rarity];
            itemEl.innerHTML = `
                <div class="case-spinner-item-badge" style="background:${rarityColors[item.rarity]};">${getCaseItemToken(item.name)}</div>
                <div class="case-spinner-item-name">${item.name}</div>
                <div class="case-spinner-item-value">$${formatAmount(item.value)}</div>
            `;
            spinner.appendChild(itemEl);
        });

        let spinSoundLoop = null;
        if (window.playUiSound) {
            spinSoundLoop = setInterval(() => {
                window.playUiSound('shuffle');
            }, 360);
        }

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                spinner.style.transform = `translateX(${-(24 * 170) + 400}px)`;
            });
        });

        setTimeout(() => {
            if (spinSoundLoop) {
                clearInterval(spinSoundLoop);
            }
            playUiSound('reveal');
            resolve();
        }, spinDuration + 80);
    });
}

async function runCaseBatchReveal({ caseInfo, winningItems, spinnerContainer, spinner, title }) {
    spinnerContainer.classList.add('case-batch-mode');
    spinner.style.transition = 'none';
    spinner.style.transform = 'none';
    spinner.innerHTML = `
        <div class="case-batch-board">
            <div class="case-batch-meter">
                <span id="caseBatchMeterFill"></span>
            </div>
            <div class="case-batch-grid" id="caseBatchGrid"></div>
        </div>
    `;

    const grid = document.getElementById('caseBatchGrid');
    const meter = document.getElementById('caseBatchMeterFill');
    const revealDelay = 260;

    for (let index = 0; index < winningItems.length; index += 1) {
        const item = winningItems[index];
        title.textContent = `Opening crate ${index + 1} of ${winningItems.length}...`;

        const card = document.createElement('div');
        card.className = 'case-batch-card';
        card.style.setProperty('--rarity-color', rarityColors[item.rarity] || rarityColors.common);
        card.innerHTML = `
            <span class="case-batch-number">#${index + 1}</span>
            <span class="case-item-badge" style="background:${rarityColors[item.rarity]};">${getCaseItemToken(item.name)}</span>
            <strong>${item.name}</strong>
            <em>$${formatAmount(item.value)}</em>
        `;

        grid.appendChild(card);
        requestAnimationFrame(() => card.classList.add('revealed'));

        if (meter) {
            meter.style.width = `${Math.round(((index + 1) / winningItems.length) * 100)}%`;
        }

        playUiSound(index === winningItems.length - 1 ? 'reveal' : 'shuffle');
        await wait(revealDelay);
    }

    await wait(240);
}

async function openCase(caseId, count = 1) {
    if (caseOpenBusy) return;

    const caseInfo = getCaseById(caseId);
    if (!caseInfo) {
        showNotification('Case not found.', 'error');
        return;
    }

    const openCount = [1, 3, 10].includes(Number(count)) ? Number(count) : 1;
    const totalCost = caseInfo.price * openCount;

    if (currentPlayer.balance < totalCost) {
        showNotification('Insufficient balance!', 'error');
        return;
    }

    caseOpenBusy = true;

    let winningItem;
    let winningItems = [];
    let liveResult = null;

    if (isBetaMode) {
        reserveDisplayedBalance(totalCost);
        winningItems = Array.from({ length: openCount }, () => pickLocalCaseItem(caseInfo));
        winningItem = winningItems[winningItems.length - 1];
    } else {
        try {
            const response = await fetch('/api/game/cases/open', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    caseId,
                    count: openCount,
                    requestId: createClientRequestId('case')
                })
            });
            liveResult = await readJsonResponse(response, 'Case opening failed');

            winningItem = liveResult.winningItem;
            winningItems = Array.isArray(liveResult.winningItems) && liveResult.winningItems.length > 0
                ? liveResult.winningItems
                : [winningItem];
            hydratePlayerStateFromResult(liveResult);
        } catch (error) {
            caseOpenBusy = false;
            showNotification(error.message || 'Case opening failed', 'error');
            return;
        }
    }

    const modal = document.getElementById('caseOpeningModal');
    const spinner = document.getElementById('caseSpinner');
    const result = document.getElementById('caseResult');
    const infoPanel = document.getElementById('caseInfoPanel');
    const spinnerContainer = document.getElementById('caseSpinnerContainer');
    if (!modal || !spinner || !result || !infoPanel || !spinnerContainer) {
        caseOpenBusy = false;
        return;
    }

    modal.classList.add('active');
    const title = document.getElementById('caseOpeningTitle');
    title.textContent = `Opening ${openCount} ${caseInfo.name}${openCount > 1 ? 's' : ''}...`;
    infoPanel.innerHTML = '';
    spinnerContainer.classList.remove('is-hidden');
    spinnerContainer.classList.remove('case-batch-mode');
    result.classList.remove('active');
    result.innerHTML = '';
    spinner.innerHTML = '';
    spinner.style.transform = 'translateX(0)';
    playUiSound('modal-open');

    if (openCount === 1) {
        await runCaseSpin({
            caseInfo,
            winningItem: winningItems[0],
            spinIndex: 0,
            openCount,
            spinner,
            title
        });
    } else {
        await runCaseBatchReveal({
            caseInfo,
            winningItems,
            spinnerContainer,
            spinner,
            title
        });
    }

    title.textContent = `${openCount} ${caseInfo.name}${openCount > 1 ? 's' : ''} complete`;

    setTimeout(async () => {
        if (isBetaMode) {
            const payout = winningItems.reduce((total, item) => total + Number(item.value || 0), 0);
            const settlement = await settleWager({
                amount: totalCost,
                payout,
                multiplier: payout / totalCost,
                won: payout >= totalCost,
                gameType: 'cases'
            });

            if (!settlement) {
                closeCaseModal();
                caseOpenBusy = false;
                return;
            }
        }

        const totalPayout = winningItems.reduce((total, item) => total + Number(item.value || 0), 0);
        const profit = totalPayout - totalCost;
        result.innerHTML = `
            <div class="case-result-item"><i class="fas ${caseInfo.icon}"></i></div>
            <div class="case-result-name" style="color:${rarityColors[winningItem.rarity]};">${openCount === 1 ? winningItem.name : `${openCount} crates opened`}</div>
            <div class="case-result-value">${profit >= 0 ? '+' : '-'}$${formatAmount(Math.abs(profit))}</div>
            <div class="case-result-grid">
                ${winningItems.map((item) => `
                    <div class="case-result-mini">
                        <span class="case-item-badge" style="background:${rarityColors[item.rarity]};">${getCaseItemToken(item.name)}</span>
                        <strong>${item.name}</strong>
                        <em>$${formatAmount(item.value)}</em>
                    </div>
                `).join('')}
            </div>
            <div class="case-range">Pulled from ${caseInfo.name}${liveResult?.fairness?.serverSeedHash ? ` - hash ${liveResult.fairness.serverSeedHash.slice(0, 14)}...` : ''}</div>
            <button class="btn-primary" type="button" onclick="closeCaseModal()" style="margin-top:20px;max-width:260px;">Claim Reward</button>
        `;
        result.classList.add('active');
        playUiSound(profit >= 0 ? 'success' : 'error');
        showNotification(`${winningItem.name} ${profit >= 0 ? 'hit' : 'dropped'} ${profit >= 0 ? '+' : '-'}$${formatAmount(Math.abs(profit))}`, profit >= 0 ? 'success' : 'error');
        caseOpenBusy = false;
    }, 120);
}

function closeCaseModal() {
    const modal = document.getElementById('caseOpeningModal');
    if (modal) {
        modal.classList.remove('active');
    }
    playUiSound('modal-close');
    caseOpenBusy = false;
}

async function loadDailyrewardsGame(container) {
    ensureCaseStyles();
    container.dataset.caseLoader = 'dailyrewards';
    container.innerHTML = '<div class="game-container"><div class="feed-empty-state">Loading your daily crate...</div></div>';

    if (!currentPlayer) {
        container.innerHTML = '<div class="game-container"><div class="feed-empty-state">Login first to claim daily rewards.</div></div>';
        return;
    }

    if (isBetaMode) {
        const catalog = await ensureCaseCatalog();
        const previewCase = catalog[Math.min(catalog.length - 1, 35)] || catalog[0];
        renderDailyRewardPanel(container, {
            level: currentPlayer.level,
            maxLevel: currentPlayer.maxLevel || 100,
            xpToNextLevel: currentPlayer.xpToNextLevel || 0,
            levelProgress: currentPlayer.levelProgress || 0,
            claimedToday: false,
            rewardCase: previewCase
        }, []);
        return;
    }

    try {
        const response = await fetch('/api/player/daily-rewards');
        const data = await readJsonResponse(response, 'Daily rewards unavailable');

        renderDailyRewardPanel(container, data.dailyReward, data.recentClaims || []);
    } catch (error) {
        console.error('Daily rewards load failed:', error);
        container.innerHTML = `<div class="game-container"><div class="feed-empty-state">${error.message || 'Daily rewards are reconnecting...'}</div></div>`;
    }
}

function renderDailyRewardPanel(container, reward, recentClaims = []) {
    const rewardCase = reward?.rewardCase;
    if (!rewardCase) {
        container.innerHTML = '<div class="game-container"><div class="feed-empty-state">No daily crate is available right now.</div></div>';
        return;
    }

    container.innerHTML = `
        <div class="daily-reward-shell">
            <section class="daily-crate-stage">
                <div class="daily-crate-orbit" style="--crate-color:${rewardCase.color};">
                    <i class="fas ${rewardCase.icon}"></i>
                </div>
                <div class="daily-crate-copy">
                    <span class="banner-tag">Level ${reward.level}/${reward.maxLevel} Daily Crate</span>
                    <h3>${rewardCase.name}</h3>
                    <p>Your level decides the free crate tier. Level 100 unlocks the strongest daily crate, but the grind gets brutal on purpose.</p>
                    <div class="profile-xp-track daily-xp-track"><span style="width:${Math.round((reward.levelProgress || 0) * 100)}%;"></span></div>
                    <span class="case-range">${reward.xpToNextLevel > 0 ? `${formatAmount(reward.xpToNextLevel)} XP until the next crate tier push` : 'Max level crate tier unlocked'}</span>
                </div>
                <button id="dailyRewardClaimBtn" class="btn-primary daily-claim-btn" type="button" ${reward.claimedToday ? 'disabled' : ''}>
                    ${reward.claimedToday ? 'Claimed Today' : 'Claim Daily Crate'}
                </button>
            </section>

            <section class="daily-reward-grid">
                <div class="game-container">
                    <h3 class="game-title">Possible Rewards</h3>
                    <div class="case-reward-list compact">
                        ${rewardCase.items.map((item) => `
                            <div class="case-reward-row">
                                <span class="case-item-badge" style="background:${rarityColors[item.rarity]};">${getCaseItemToken(item.name)}</span>
                                <div>
                                    <strong>${item.name}</strong>
                                    <span>${item.rarity} - ${Number(item.chance || 0).toFixed(2)}%</span>
                                </div>
                                <em>$${formatAmount(item.value)}</em>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="game-container">
                    <h3 class="game-title">Recent Claims</h3>
                    <div class="daily-claim-list">
                        ${recentClaims.length > 0 ? recentClaims.map((claim) => `
                            <div class="daily-claim-row">
                                <span>${claim.itemName}</span>
                                <strong>$${formatAmount(claim.itemValue)}</strong>
                            </div>
                        `).join('') : '<div class="feed-empty-state">Your claim history starts with today.</div>'}
                    </div>
                </div>
            </section>
        </div>
    `;

    const claimButton = document.getElementById('dailyRewardClaimBtn');
    if (claimButton) {
        claimButton.addEventListener('click', claimDailyReward);
    }
}

async function claimDailyReward() {
    const button = document.getElementById('dailyRewardClaimBtn');
    if (!button || button.disabled) return;

    if (isBetaMode) {
        showNotification('Daily rewards need a real account session.', 'info');
        return;
    }

    button.disabled = true;
    button.textContent = 'Opening...';
    playUiSound('modal-open');

    try {
        const response = await fetch('/api/player/daily-rewards/claim', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await readJsonResponse(response, 'Daily claim failed');

        hydratePlayerStateFromResult(data);
        showNotification(`${data.winningItem.name} added $${formatAmount(data.payout)} to your website wallet.`, 'success');
        playUiSound('success');
        loadDailyrewardsGame(document.getElementById('gameContent'));
    } catch (error) {
        button.disabled = false;
        button.textContent = 'Claim Daily Crate';
        showNotification(error.message || 'Daily claim failed', 'error');
    }
}

async function loadCasebattlesGame(container) {
    ensureCaseStyles();
    container.dataset.caseLoader = 'casebattles';
    container.innerHTML = '<div class="game-container"><div class="feed-empty-state">Loading battle lobby...</div></div>';
    const catalog = await ensureCaseCatalog();

    if (!container.isConnected || container.dataset.activeGame !== 'casebattles' || container.dataset.caseLoader !== 'casebattles') return;

    if (catalog.length === 0) {
        container.innerHTML = '<div class="game-container"><div class="feed-empty-state">Battle lobby is unavailable right now.</div></div>';
        return;
    }

    if (!selectedBattleCaseId) {
        selectedBattleCaseId = catalog[0].id;
    }

    container.innerHTML = `
        <div class="case-battles-shell">
            <div class="responsive-grid" style="display:grid;grid-template-columns:minmax(0,1.2fr) minmax(320px,0.8fr);gap:20px;">
                <div class="game-container">
                    <h3 class="game-title">Create Battle</h3>
                    <div class="bet-input-group">
                        <label class="bet-label">Case</label>
                        <select id="battleCaseSelect" class="bet-input" onchange="selectBattleCase(this.value)">
                            ${catalog.map((caseInfo) => `
                                <option value="${caseInfo.id}" ${caseInfo.id === selectedBattleCaseId ? 'selected' : ''}>
                                    ${caseInfo.name} · $${formatAmount(caseInfo.price)}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    <div id="battleCasePreview"></div>
                    <div class="responsive-grid" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:18px;">
                        <div>
                            <label class="bet-label">Players</label>
                            <input type="number" id="battlePlayers" class="bet-input" value="2" min="2" max="4">
                        </div>
                        <div>
                            <label class="bet-label">Rounds</label>
                            <input type="number" id="battleRounds" class="bet-input" value="1" min="1" max="5">
                        </div>
                    </div>
                    <button class="btn-primary" type="button" onclick="createBattle()" style="margin-top:18px;">Create Battle</button>
                </div>
                <div class="game-container">
                    <h3 class="game-title">Active Battles</h3>
                    <div id="battlesList"></div>
                </div>
            </div>
        </div>
    `;

    updateBattleCasePreview();
    updateBattlesList();
}

function updateBattleCasePreview() {
    const preview = document.getElementById('battleCasePreview');
    const caseInfo = getCaseById(selectedBattleCaseId);
    if (!preview || !caseInfo) return;

    preview.innerHTML = `
        <div class="case-card">
            <div class="case-card-top">
                <div style="display:flex;gap:12px;min-width:0;">
                    <div class="case-icon" style="background: linear-gradient(135deg, ${caseInfo.color}, rgba(15, 23, 42, 0.85)); color:#f8fbff;">
                        <i class="fas ${caseInfo.icon}"></i>
                    </div>
                    <div>
                        <h3 class="case-name">${caseInfo.name}</h3>
                        <div class="case-price">$${formatAmount(caseInfo.price)}</div>
                        <div class="case-range">Battle winner can spike up to ${caseInfo.maxMultiplier.toFixed(2)}x on the roll.</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function selectBattleCase(caseId) {
    selectedBattleCaseId = caseId;
    updateBattleCasePreview();
}

function createBattle() {
    const caseInfo = getCaseById(selectedBattleCaseId);
    const players = parseInt(document.getElementById('battlePlayers').value, 10);
    const rounds = parseInt(document.getElementById('battleRounds').value, 10);

    if (!caseInfo) {
        showNotification('Select a case first!', 'error');
        return;
    }

    const totalCost = caseInfo.price * rounds;
    if (currentPlayer.balance < totalCost) {
        showNotification('Insufficient balance!', 'error');
        return;
    }

    reserveDisplayedBalance(totalCost);

    const battle = {
        id: Date.now(),
        caseId: caseInfo.id,
        maxPlayers: Math.max(2, Math.min(4, players)),
        rounds: Math.max(1, Math.min(5, rounds)),
        stake: totalCost,
        players: [{ name: currentPlayer.username, score: 0 }],
        status: 'matching'
    };

    activeBattles.push(battle);
    updateBattlesList();
    showNotification('Battle created. Filling the table...', 'success');
    setTimeout(() => fillBattleWithBots(battle), 1000);
}

function fillBattleWithBots(battle) {
    const takenNames = new Set(battle.players.map((player) => player.name));

    for (const botName of battleBots) {
        if (battle.players.length >= battle.maxPlayers) break;
        if (takenNames.has(botName)) continue;
        battle.players.push({ name: botName, score: 0 });
        takenNames.add(botName);
    }

    battle.status = 'ready';
    updateBattlesList();
    startBattle(battle);
}

function updateBattlesList() {
    const list = document.getElementById('battlesList');
    if (!list) return;

    if (activeBattles.length === 0) {
        list.innerHTML = '<div class="feed-empty-state">No active battles yet.</div>';
        return;
    }

    list.innerHTML = activeBattles.map((battle) => {
        const caseInfo = getCaseById(battle.caseId);
        return `
            <div class="battle-item">
                <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:10px;">
                    <strong>${caseInfo ? caseInfo.name : 'Case Battle'}</strong>
                    <span class="case-price">$${formatAmount(battle.stake)}</span>
                </div>
                <div class="case-range">${battle.players.length}/${battle.maxPlayers} players · ${battle.rounds} rounds</div>
                <div class="battle-players" style="display:grid;gap:8px;margin-top:12px;">
                    ${battle.players.map((player) => `<div class="battle-player-slot filled">${player.name}</div>`).join('')}
                </div>
            </div>
        `;
    }).join('');
}

async function startBattle(battle) {
    const caseInfo = getCaseById(battle.caseId);
    if (!caseInfo) return;

    setTimeout(async () => {
        battle.players.forEach((player) => {
            for (let round = 0; round < battle.rounds; round += 1) {
                player.score += pickLocalCaseItem(caseInfo).value;
            }
        });

        battle.players.sort((left, right) => right.score - left.score);
        const winner = battle.players[0];
        const totalPot = caseInfo.price * battle.rounds * battle.maxPlayers;
        const didWin = winner.name === currentPlayer.username;
        const settlement = await settleWager({
            amount: battle.stake,
            payout: didWin ? totalPot : 0,
            multiplier: didWin ? totalPot / battle.stake : 0,
            won: didWin,
            gameType: 'casebattles'
        });

        activeBattles = activeBattles.filter((entry) => entry.id !== battle.id);
        updateBattlesList();

        if (!settlement) {
            return;
        }

        showNotification(
            didWin ? `Battle won for +$${formatAmount(totalPot - battle.stake)}` : `${winner.name} won the battle.`,
            didWin ? 'success' : 'error'
        );
    }, 2200);
}
