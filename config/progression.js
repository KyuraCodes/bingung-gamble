const MAX_LEVEL = 100;

function normalizeXp(value) {
    return Math.max(0, Math.floor(Number(value || 0)));
}

function getXpForNextLevel(level) {
    const safeLevel = Math.max(1, Math.min(MAX_LEVEL, Math.floor(Number(level || 1))));
    if (safeLevel >= MAX_LEVEL) {
        return 0;
    }

    return Math.floor(700 + Math.pow(safeLevel, 2.15) * 320 + Math.pow(1.055, safeLevel) * 250);
}

function getTotalXpForLevel(level) {
    const safeLevel = Math.max(1, Math.min(MAX_LEVEL, Math.floor(Number(level || 1))));
    let total = 0;

    for (let currentLevel = 1; currentLevel < safeLevel; currentLevel += 1) {
        total += getXpForNextLevel(currentLevel);
    }

    return total;
}

function getLevelFromXp(xp) {
    const totalXp = normalizeXp(xp);
    let level = 1;
    let threshold = 0;

    while (level < MAX_LEVEL) {
        threshold += getXpForNextLevel(level);
        if (totalXp < threshold) {
            break;
        }
        level += 1;
    }

    return level;
}

function getProgressionSnapshot(xp) {
    const totalXp = normalizeXp(xp);
    const level = getLevelFromXp(totalXp);
    const levelFloorXp = getTotalXpForLevel(level);
    const nextLevelXp = level >= MAX_LEVEL
        ? levelFloorXp
        : levelFloorXp + getXpForNextLevel(level);
    const xpIntoLevel = Math.max(0, totalXp - levelFloorXp);
    const xpToNextLevel = level >= MAX_LEVEL
        ? 0
        : Math.max(0, nextLevelXp - totalXp);
    const levelSpan = Math.max(1, nextLevelXp - levelFloorXp);

    return {
        level,
        xp: totalXp,
        maxLevel: MAX_LEVEL,
        levelFloorXp,
        nextLevelXp,
        xpIntoLevel,
        xpToNextLevel,
        levelProgress: level >= MAX_LEVEL ? 1 : Math.min(1, xpIntoLevel / levelSpan)
    };
}

function getWagerXpGain(amount, won = false) {
    const wager = Math.max(0, Number(amount || 0));
    if (wager <= 0) {
        return 0;
    }

    const logGain = Math.log10(wager + 1) * 12;
    const winBonus = won ? 10 : 0;
    return Math.max(2, Math.min(420, Math.floor(6 + logGain + winBonus)));
}

module.exports = {
    MAX_LEVEL,
    getLevelFromXp,
    getProgressionSnapshot,
    getTotalXpForLevel,
    getWagerXpGain,
    getXpForNextLevel
};
