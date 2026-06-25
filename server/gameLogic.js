// Pure game logic — imported by server.js and tests

const GRID_WIDTH = 15;

const featureSets = {
    none:             { punishments: false, praise: false, waterCue: false, stainCue: false },
    punish:           { punishments: true,  praise: false, waterCue: false, stainCue: false },
    praise:           { punishments: false, praise: true,  waterCue: false, stainCue: false },
    water:            { punishments: false, praise: false, waterCue: true,  stainCue: false },
    waterPunish:      { punishments: true,  praise: false, waterCue: true,  stainCue: false },
    waterPraise:      { punishments: false, praise: true,  waterCue: true,  stainCue: false },
    stain:            { punishments: false, praise: false, waterCue: false, stainCue: true  },
    stainPunish:      { punishments: true,  praise: false, waterCue: false, stainCue: true  },
    stainPraise:      { punishments: false, praise: true,  waterCue: false, stainCue: true  },
    waterStain:       { punishments: false, praise: false, waterCue: true,  stainCue: true  },
    waterStainPunish: { punishments: true,  praise: false, waterCue: true,  stainCue: true  },
    waterStainPraise: { punishments: false, praise: true,  waterCue: true,  stainCue: true  },
};

const COOP_W = 0.05;
const COOP_DROP_THRESHOLD  = 0.7;
const COOP_STAIN_THRESHOLD = 0.3;

function getLocationValue(x, y, roomLayout) {
    if (roomLayout === 'corners') {
        if ((x >= 10 && y <= 2) || (x <= 4 && y >= 7)) return 1;  // lake zone — cooperative
        if ((x <= 4  && y <= 2) || (x >= 10 && y >= 7)) return 0; // orchard zone — selfish
        return 0.5;
    }
    if (x <= 2)              return 0;   // orchard zone — selfish
    if (x >= GRID_WIDTH - 3) return 1;   // river zone — cooperative
    return 0.5;
}

function computeNewCoop(prev, locationValue, w = COOP_W) {
    return (1 - w) * prev + w * locationValue;
}

function normalizeGroupSize(value) {
    const parsed = parseInt(value, 10);
    if (!Number.isFinite(parsed)) return null;
    if (parsed < 2 || parsed > 4) return null;
    return parsed;
}

module.exports = {
    featureSets,
    COOP_W,
    COOP_DROP_THRESHOLD,
    COOP_STAIN_THRESHOLD,
    getLocationValue,
    computeNewCoop,
    normalizeGroupSize,
};
