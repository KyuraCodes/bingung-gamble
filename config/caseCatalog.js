const PRICE_START = 100000;
const PRICE_END = 1e15;
const CASE_COUNT = 50;

const ITEM_VALUE_MULTIPLIERS = [0.26, 0.54, 0.92, 2.8, 12];
const ITEM_CHANCES = [48, 28, 15, 7, 2];
const ITEM_RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

const CASE_THEMES = [
    { name: 'Dirt Cache', color: '#3b82f6', icon: 'fa-cube', items: ['Dirt Stack', 'Oak Bundle', 'Stone Brick', 'Copper Kit', 'Diamond Nugget'] },
    { name: 'Coal Crate', color: '#2563eb', icon: 'fa-fire', items: ['Coal Ore', 'Torch Pack', 'Iron Pickaxe', 'Lapis Parcel', 'Enchant Core'] },
    { name: 'Iron Locker', color: '#1d4ed8', icon: 'fa-shield-halved', items: ['Iron Ingot', 'Chain Armor', 'Blast Furnace', 'Emerald Cache', 'Beacon Shard'] },
    { name: 'Redstone Box', color: '#0ea5e9', icon: 'fa-bolt', items: ['Redstone Dust', 'Observer Pair', 'Piston Drive', 'Quartz Relay', 'Nether Star'] },
    { name: 'Lapis Crate', color: '#38bdf8', icon: 'fa-droplet', items: ['Lapis Stack', 'Bookshelf Lot', 'Enchant Tome', 'Potion Rack', 'Ancient Tablet'] },
    { name: 'Gold Cache', color: '#0891b2', icon: 'fa-coins', items: ['Gold Ingot', 'Clockwork Kit', 'Powered Rail', 'Gilded Bundle', 'Piglin Hoard'] },
    { name: 'Emerald Locker', color: '#10b981', icon: 'fa-gem', items: ['Emerald Block', 'Villager Deal', 'Silk Pick', 'Totem Bundle', 'Hero Medal'] },
    { name: 'Diamond Vault', color: '#22c55e', icon: 'fa-diamond', items: ['Diamond Block', 'Aqua Toolset', 'Shulker Pair', 'Ender Chest', 'Dragon Fragment'] },
    { name: 'Nether Supply', color: '#14b8a6', icon: 'fa-volcano', items: ['Blaze Rod', 'Magma Crate', 'Quartz Cache', 'Netherite Trim', 'Wither Skull'] },
    { name: 'Ender Relay', color: '#06b6d4', icon: 'fa-meteor', items: ['Ender Pearl', 'Chorus Stack', 'Purpur Chest', 'Elytra Wing', 'Dragon Egg'] },
    { name: 'Farmers Chest', color: '#3b82f6', icon: 'fa-seedling', items: ['Wheat Bale', 'Honey Barrel', 'Barn Toolkit', 'Golden Carrot', 'Ancient Hive'] },
    { name: 'Creeper Stash', color: '#2563eb', icon: 'fa-bomb', items: ['Gunpowder Bag', 'TNT Block', 'Blast Kit', 'Charge Bundle', 'Ghast Core'] },
    { name: 'Ocean Locker', color: '#1e40af', icon: 'fa-water', items: ['Prismarine', 'Kelp Bundle', 'Trident Shaft', 'Conduit Frame', 'Heart of Sea'] },
    { name: 'Stronghold Cache', color: '#0f766e', icon: 'fa-fort-awesome', items: ['Stone Eye', 'Library Chest', 'Portal Frame', 'Silverfish Relic', 'End Compass'] },
    { name: 'Villager Market', color: '#0ea5e9', icon: 'fa-store', items: ['Bread Crate', 'Trade Paper', 'Bell Tower', 'Mending Book', 'Master Seal'] },
    { name: 'Mob Arena Box', color: '#38bdf8', icon: 'fa-skull', items: ['Bone Stack', 'Spider Silk', 'Hunter Pack', 'Slime Reactor', 'Warden Echo'] },
    { name: 'Beacon Reserve', color: '#22c55e', icon: 'fa-sun', items: ['Glass Pillar', 'Iron Pyramid', 'Haste Node', 'Beacon Core', 'Spectrum Prism'] },
    { name: 'Aether Kit', color: '#10b981', icon: 'fa-cloud', items: ['Feather Stack', 'Cloud Weave', 'Sky Lantern', 'Angel Ring', 'Nimbus Crown'] },
    { name: 'Dungeon Chest', color: '#0284c7', icon: 'fa-dungeon', items: ['String Bundle', 'Moss Stone', 'Spawner Frame', 'Golden Apple', 'Trial Key'] },
    { name: 'Forge Crate', color: '#0369a1', icon: 'fa-hammer', items: ['Copper Coil', 'Forge Plate', 'Smithing Table', 'Trim Cluster', 'Mythic Alloy'] },
    { name: 'Ancient Debris Box', color: '#0c4a6e', icon: 'fa-mountain', items: ['Ancient Debris', 'Lava Shell', 'Netherite Scrap', 'Infernal Plate', 'Molten Crown'] },
    { name: 'Skyblock Supply', color: '#3b82f6', icon: 'fa-island-tropical', items: ['Sapling Pack', 'Cobble Gen', 'Island Chest', 'Mob Grinder', 'Void Totem'] },
    { name: 'Raiders Cache', color: '#2563eb', icon: 'fa-person-rifle', items: ['Crossbow Set', 'Banner Stack', 'Raid Bell', 'Totem Bundle', 'Ominous Crest'] },
    { name: 'Bastion Vault', color: '#1d4ed8', icon: 'fa-helmet-safety', items: ['Gilded Blackstone', 'Pigstep Disc', 'Ancient Banner', 'Lodestone', 'Crown of Bastion'] },
    { name: 'Archaeology Box', color: '#0ea5e9', icon: 'fa-brush', items: ['Pottery Shard', 'Brush Kit', 'Sniffer Egg', 'Relic Vase', 'Lost Tablet'] },
    { name: 'Cave Diver Kit', color: '#38bdf8', icon: 'fa-person-swimming', items: ['Glow Berries', 'Dripstone Pack', 'Axolotl Bucket', 'Sculk Bundle', 'Echo Compass'] },
    { name: 'Snowbound Crate', color: '#93c5fd', icon: 'fa-snowflake', items: ['Powder Snow', 'Goat Horn', 'Ice Shard', 'Packed Ice', 'Frozen Crown'] },
    { name: 'Jungle Vault', color: '#34d399', icon: 'fa-tree', items: ['Cocoa Set', 'Bamboo Chest', 'Temple Gear', 'Parrot Idol', 'Emerald Idol'] },
    { name: 'Mesa Strongbox', color: '#14b8a6', icon: 'fa-landmark', items: ['Terracotta Pack', 'Gold Dust', 'Minecart Bundle', 'Badlands Ore', 'Sunset Relic'] },
    { name: 'Trial Chamber Case', color: '#06b6d4', icon: 'fa-chess-rook', items: ['Trial Key', 'Breeze Rod', 'Vault Plate', 'Heavy Core', 'Ancient Emblem'] },
    { name: 'Deep Dark Vault', color: '#1e3a8a', icon: 'fa-eye', items: ['Sculk Sensor', 'Catalyst Kit', 'Shrieker Core', 'Echo Shard', 'Silence Armor'] },
    { name: 'Warden Lockbox', color: '#312e81', icon: 'fa-mask', items: ['Echo Dust', 'Shadow Plate', 'Dark Catalyst', 'Blindness Charm', 'Warden Heart'] },
    { name: 'Potion Lab Case', color: '#2563eb', icon: 'fa-flask', items: ['Potion Rack', 'Blaze Mix', 'Brewer Stand', 'Phantom Membrane', 'Elixir Crown'] },
    { name: 'End City Crate', color: '#1d4ed8', icon: 'fa-city', items: ['Purpur Beam', 'Shulker Box', 'End Rod Cluster', 'Elytra Wing', 'Dragon Throne'] },
    { name: 'Mega Mine Vault', color: '#0ea5e9', icon: 'fa-industry', items: ['Ore Drill', 'Rail Matrix', 'Diamond Shaft', 'Beacon Array', 'Titan Core'] },
    { name: 'Mythic Library', color: '#38bdf8', icon: 'fa-book', items: ['Ancient Tome', 'Rune Shelf', 'Mending Archive', 'Wisdom Crystal', 'Oracle Codex'] },
    { name: 'Sky Citadel Chest', color: '#7dd3fc', icon: 'fa-castle', items: ['Cloud Brick', 'Wing Crest', 'Aerial Engine', 'Storm Banner', 'Sky Crown'] },
    { name: 'Prismarine Vault', color: '#67e8f9', icon: 'fa-shield-cat', items: ['Sea Lantern', 'Guardian Spine', 'Conduit Ring', 'Ocean Beacon', 'Leviathan Eye'] },
    { name: 'Celestial Cache', color: '#38bdf8', icon: 'fa-star', items: ['Moon Dust', 'Solar Glass', 'Comet Plate', 'Nebula Core', 'Astral Halo'] },
    { name: 'Netherite Arsenal', color: '#2563eb', icon: 'fa-screwdriver-wrench', items: ['Netherite Sword', 'War Axe', 'Plate Rig', 'Inferno Engine', 'Abyss Crown'] },
    { name: 'Dragonfire Crate', color: '#1d4ed8', icon: 'fa-dragon', items: ['Dragon Scale', 'Inferno Gem', 'Wing Harness', 'Void Prism', 'Dragon Soul'] },
    { name: 'Void Market Box', color: '#0f172a', icon: 'fa-store-slash', items: ['Void Shard', 'Ender Relay', 'Null Circuit', 'Rift Engine', 'Singularity Lens'] },
    { name: 'Overclock Chest', color: '#0ea5e9', icon: 'fa-microchip', items: ['Copper Board', 'Redstone CPU', 'Quantum Rail', 'Core Reactor', 'Hyper Node'] },
    { name: 'Cosmic Vault', color: '#38bdf8', icon: 'fa-globe', items: ['Stellar Dust', 'Orbit Plate', 'Nova Shard', 'Galaxy Engine', 'Cosmos Crown'] },
    { name: 'Titan Reserve', color: '#60a5fa', icon: 'fa-monument', items: ['Titan Alloy', 'Atlas Gear', 'Colossus Core', 'World Prism', 'Empire Crest'] },
    { name: 'Relic Treasury', color: '#3b82f6', icon: 'fa-vault', items: ['Relic Coin', 'Ancient Crest', 'King Archive', 'Sovereign Plate', 'Dynasty Sigil'] },
    { name: 'Myth Forge Vault', color: '#2563eb', icon: 'fa-wand-magic-sparkles', items: ['Rune Steel', 'Arcane Hammer', 'Sigil Frame', 'Epoch Prism', 'Forge Spirit'] },
    { name: 'Astral Throne Case', color: '#1d4ed8', icon: 'fa-crown', items: ['Astral Gem', 'Orbit Mantle', 'Starlight Relay', 'Nova Throne', 'Eternal Halo'] },
    { name: 'Quantum Realm Crate', color: '#0ea5e9', icon: 'fa-atom', items: ['Quantum Dust', 'Phase Relay', 'Realm Engine', 'Singularity Prism', 'Paradox Crown'] },
    { name: 'Infinite Dragon Vault', color: '#38bdf8', icon: 'fa-infinity', items: ['Dragon Spark', 'Voidfire Plate', 'Ascendant Wing', 'Omega Core', 'Infinite Egg'] }
];

let cachedCatalog = null;

function roundValue(value) {
    const numeric = Math.max(1, Number(value) || 0);
    if (numeric >= 1e15) {
        return 1e15;
    }

    const magnitude = Math.pow(10, Math.max(0, Math.floor(Math.log10(numeric)) - 1));
    return Math.max(1, Math.round(numeric / magnitude) * magnitude);
}

function buildPrice(index) {
    const ratio = PRICE_END / PRICE_START;
    const exact = PRICE_START * Math.pow(ratio, index / (CASE_COUNT - 1));
    return index === CASE_COUNT - 1 ? PRICE_END : roundValue(exact);
}

function buildItemValue(price, multiplier) {
    return roundValue(price * multiplier);
}

function buildCatalog() {
    return CASE_THEMES.map((theme, index) => {
        const price = buildPrice(index);
        const id = `case_${String(index + 1).padStart(2, '0')}`;
        const items = theme.items.map((itemName, itemIndex) => ({
            name: itemName,
            value: buildItemValue(price, ITEM_VALUE_MULTIPLIERS[itemIndex]),
            rarity: ITEM_RARITIES[itemIndex],
            chance: ITEM_CHANCES[itemIndex]
        }));

        return {
            id,
            name: theme.name,
            price,
            color: theme.color,
            icon: theme.icon,
            floorMultiplier: ITEM_VALUE_MULTIPLIERS[0],
            maxMultiplier: ITEM_VALUE_MULTIPLIERS[ITEM_VALUE_MULTIPLIERS.length - 1],
            items
        };
    });
}

function getCaseCatalog() {
    if (!cachedCatalog) {
        cachedCatalog = buildCatalog();
    }

    return cachedCatalog;
}

function getCaseById(caseId) {
    return getCaseCatalog().find((entry) => entry.id === String(caseId || '')) || null;
}

function pickCaseItem(caseInfo, roll) {
    const normalizedRoll = Math.max(0, Math.min(0.9999999999, Number(roll) || 0));
    const threshold = normalizedRoll * 100;
    let cumulative = 0;

    for (const item of caseInfo.items) {
        cumulative += Number(item.chance || 0);
        if (threshold < cumulative) {
            return item;
        }
    }

    return caseInfo.items[caseInfo.items.length - 1];
}

module.exports = {
    getCaseById,
    getCaseCatalog,
    pickCaseItem
};
