const crypto = require('crypto');

const CLIENT_SEED_FALLBACK = 'bingung-seed';

function sanitizeClientSeed(value, fallback = CLIENT_SEED_FALLBACK) {
    const safeValue = String(value || fallback)
        .trim()
        .replace(/[^a-zA-Z0-9:_-]/g, '')
        .slice(0, 48);

    return safeValue || fallback;
}

function buildDefaultClientSeed(username) {
    return sanitizeClientSeed(`${username || 'player'}-seed`);
}

function generateServerSeed() {
    return crypto.randomBytes(32).toString('hex');
}

function hashServerSeed(serverSeed) {
    return crypto.createHash('sha256').update(String(serverSeed || '')).digest('hex');
}

function createDigest({ serverSeed, clientSeed, nonce = 0, cursor = 0 }) {
    return crypto
        .createHmac('sha256', String(serverSeed || ''))
        .update(`${sanitizeClientSeed(clientSeed)}:${Number(nonce) || 0}:${Number(cursor) || 0}`)
        .digest();
}

function rollFloat(config) {
    const digest = createDigest(config);
    return digest.readUInt32BE(0) / 0x100000000;
}

function rollInt({ maxExclusive, ...config }) {
    const ceiling = Math.max(1, Math.floor(Number(maxExclusive) || 0));
    return Math.min(ceiling - 1, Math.floor(rollFloat(config) * ceiling));
}

function buildFairnessPayload(profile, nonceUsed, extra = {}) {
    return {
        serverSeedHash: profile.server_seed_hash,
        clientSeed: profile.client_seed,
        nonce: Number(nonceUsed),
        nextNonce: Number(profile.nonce),
        previousServerSeed: profile.previous_server_seed || null,
        previousServerSeedHash: profile.previous_server_seed_hash || null,
        rotatedAt: profile.rotated_at || null,
        ...extra
    };
}

module.exports = {
    buildDefaultClientSeed,
    buildFairnessPayload,
    generateServerSeed,
    hashServerSeed,
    rollFloat,
    rollInt,
    sanitizeClientSeed
};
