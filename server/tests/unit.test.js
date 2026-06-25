/**
 * Unit tests for server/gameLogic.js
 * Run from repo root: npx jest server/tests/unit.test.js
 */

const {
    featureSets,
    COOP_W,
    COOP_DROP_THRESHOLD,
    COOP_STAIN_THRESHOLD,
    getLocationValue,
    computeNewCoop,
    normalizeGroupSize,
} = require("../gameLogic");

// ── featureSets ─────────────────────────────────────────────────────────────

describe("featureSets", () => {
    const ALL_MODES = [
        "none", "punish", "praise", "water",
        "waterPunish", "waterPraise",
        "stain", "stainPunish", "stainPraise",
        "waterStain", "waterStainPunish", "waterStainPraise",
    ];

    test("all 12 modes are defined", () => {
        expect(Object.keys(featureSets).sort()).toEqual(ALL_MODES.slice().sort());
    });

    test.each(ALL_MODES)("%s has all four flag keys", (mode) => {
        const flags = featureSets[mode];
        expect(flags).toHaveProperty("punishments");
        expect(flags).toHaveProperty("praise");
        expect(flags).toHaveProperty("waterCue");
        expect(flags).toHaveProperty("stainCue");
    });

    test("none has all flags false", () => {
        expect(featureSets.none).toEqual({ punishments: false, praise: false, waterCue: false, stainCue: false });
    });

    // Punishment modes: punishments=true, praise=false
    test.each(["punish", "waterPunish", "stainPunish", "waterStainPunish"])(
        "%s has punishments=true and praise=false",
        (mode) => {
            expect(featureSets[mode].punishments).toBe(true);
            expect(featureSets[mode].praise).toBe(false);
        }
    );

    // Praise modes: praise=true, punishments=false
    test.each(["praise", "waterPraise", "stainPraise", "waterStainPraise"])(
        "%s has praise=true and punishments=false",
        (mode) => {
            expect(featureSets[mode].praise).toBe(true);
            expect(featureSets[mode].punishments).toBe(false);
        }
    );

    // Water cue modes
    test.each(["water", "waterPunish", "waterPraise", "waterStain", "waterStainPunish", "waterStainPraise"])(
        "%s has waterCue=true",
        (mode) => expect(featureSets[mode].waterCue).toBe(true)
    );

    test.each(["none", "punish", "praise", "stain", "stainPunish", "stainPraise"])(
        "%s has waterCue=false",
        (mode) => expect(featureSets[mode].waterCue).toBe(false)
    );

    // Stain cue modes
    test.each(["stain", "stainPunish", "stainPraise", "waterStain", "waterStainPunish", "waterStainPraise"])(
        "%s has stainCue=true",
        (mode) => expect(featureSets[mode].stainCue).toBe(true)
    );

    test.each(["none", "punish", "praise", "water", "waterPunish", "waterPraise"])(
        "%s has stainCue=false",
        (mode) => expect(featureSets[mode].stainCue).toBe(false)
    );

    // No mode has both punishments=true AND praise=true
    test.each(ALL_MODES)("%s does not have both punishments and praise", (mode) => {
        const { punishments, praise } = featureSets[mode];
        expect(punishments && praise).toBe(false);
    });
});

// ── getLocationValue ─────────────────────────────────────────────────────────

describe("getLocationValue", () => {
    test("x=0 is apple zone → 0", () => expect(getLocationValue(0)).toBe(0));
    test("x=1 is apple zone → 0", () => expect(getLocationValue(1)).toBe(0));
    test("x=2 is apple zone → 0", () => expect(getLocationValue(2)).toBe(0));
    test("x=3 is middle land → 0.5", () => expect(getLocationValue(3)).toBe(0.5));
    test("x=7 is middle land → 0.5", () => expect(getLocationValue(7)).toBe(0.5));
    test("x=11 is middle land → 0.5", () => expect(getLocationValue(11)).toBe(0.5));
    test("x=12 is river zone → 1", () => expect(getLocationValue(12)).toBe(1));
    test("x=13 is river zone → 1", () => expect(getLocationValue(13)).toBe(1));
    test("x=14 is river zone → 1", () => expect(getLocationValue(14)).toBe(1));
});

// ── computeNewCoop ───────────────────────────────────────────────────────────

describe("computeNewCoop", () => {
    test("uses default COOP_W=0.05", () => {
        const result = computeNewCoop(0.5, 1);
        expect(result).toBeCloseTo((1 - COOP_W) * 0.5 + COOP_W * 1);
    });

    test("moving toward water (locVal=1) increases coop", () => {
        const result = computeNewCoop(0.5, 1);
        expect(result).toBeGreaterThan(0.5);
    });

    test("moving to apple zone (locVal=0) decreases coop", () => {
        const result = computeNewCoop(0.5, 0);
        expect(result).toBeLessThan(0.5);
    });

    test("staying in same zone (locVal=0.5) keeps coop at 0.5", () => {
        const result = computeNewCoop(0.5, 0.5);
        expect(result).toBeCloseTo(0.5);
    });

    test("100 steps in water zone pushes coop above threshold (0.7)", () => {
        let coop = 0.5;
        for (let i = 0; i < 100; i++) coop = computeNewCoop(coop, 1);
        expect(coop).toBeGreaterThan(COOP_DROP_THRESHOLD);
    });

    test("100 steps in apple zone pushes coop below stain threshold (0.3)", () => {
        let coop = 0.5;
        for (let i = 0; i < 100; i++) coop = computeNewCoop(coop, 0);
        expect(coop).toBeLessThan(COOP_STAIN_THRESHOLD);
    });

    test("accepts custom weight", () => {
        const result = computeNewCoop(0.5, 1, 0.1);
        expect(result).toBeCloseTo(0.9 * 0.5 + 0.1 * 1);
    });

    test("coop converges toward 1 after many water steps", () => {
        let coop = 0;
        for (let i = 0; i < 1000; i++) coop = computeNewCoop(coop, 1);
        expect(coop).toBeGreaterThan(0.99);
    });

    test("coop converges toward 0 after many apple steps", () => {
        let coop = 1;
        for (let i = 0; i < 1000; i++) coop = computeNewCoop(coop, 0);
        expect(coop).toBeLessThan(0.01);
    });
});

// ── normalizeGroupSize ───────────────────────────────────────────────────────

describe("normalizeGroupSize", () => {
    test("2 is valid", () => expect(normalizeGroupSize("2")).toBe(2));
    test("3 is valid", () => expect(normalizeGroupSize("3")).toBe(3));
    test("4 is valid", () => expect(normalizeGroupSize("4")).toBe(4));
    test("1 is out of range → null", () => expect(normalizeGroupSize("1")).toBeNull());
    test("5 is out of range → null", () => expect(normalizeGroupSize("5")).toBeNull());
    test("'abc' is not a number → null", () => expect(normalizeGroupSize("abc")).toBeNull());
    test("empty string → null", () => expect(normalizeGroupSize("")).toBeNull());
    test("integer 3 (not string) works", () => expect(normalizeGroupSize(3)).toBe(3));
    test("float string '3.9' truncates to 3", () => expect(normalizeGroupSize("3.9")).toBe(3));
});

// ── threshold constants ───────────────────────────────────────────────────────

describe("constants", () => {
    test("COOP_W is 0.05", () => expect(COOP_W).toBe(0.05));
    test("COOP_DROP_THRESHOLD is 0.7", () => expect(COOP_DROP_THRESHOLD).toBe(0.7));
    test("COOP_STAIN_THRESHOLD is 0.3", () => expect(COOP_STAIN_THRESHOLD).toBe(0.3));
    test("drop threshold > stain threshold", () => expect(COOP_DROP_THRESHOLD).toBeGreaterThan(COOP_STAIN_THRESHOLD));
});
