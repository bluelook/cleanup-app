/**
 * Integration tests for server.js HTTP endpoints and Socket.io events.
 * Starts the real server; requires no DB connection (DB writes are fire-and-forget).
 *
 * Run: node node_modules/jest/bin/jest.js server/tests/integration.test.js --no-coverage
 */

jest.setTimeout(15000);

const { spawn } = require("child_process");
const http = require("http");
const path = require("path");

const PORT = 5001; // use a different port so we don't clash with the live server
let serverProcess;

// ── helpers ──────────────────────────────────────────────────────────────────

function get(urlPath) {
    return new Promise((resolve, reject) => {
        http.get(`http://localhost:${PORT}${urlPath}`, (res) => {
            let body = "";
            res.on("data", (chunk) => (body += chunk));
            res.on("end", () => resolve({ status: res.statusCode, body, headers: res.headers }));
        }).on("error", reject);
    });
}

async function getJSON(urlPath) {
    const { status, body } = await get(urlPath);
    return { status, data: JSON.parse(body) };
}

// ── server lifecycle ──────────────────────────────────────────────────────────

beforeAll(() => {
    return new Promise((resolve, reject) => {
        serverProcess = spawn("node", [path.join(__dirname, "../server.js")], {
            env: { ...process.env, PORT: String(PORT) },
            stdio: ["ignore", "pipe", "pipe"],
        });

        serverProcess.stderr.on("data", (d) => {
            // ignore DB connection errors — expected in CI without a DB
        });

        // Wait until server emits "listening" on stdout or stderr
        let started = false;
        const onData = (d) => {
            if (!started && String(d).includes("listening")) {
                started = true;
                resolve();
            }
        };
        serverProcess.stdout.on("data", onData);
        serverProcess.stderr.on("data", onData);

        // Fallback: give the server 3s to start regardless
        setTimeout(() => { if (!started) resolve(); }, 3000);

        serverProcess.on("error", reject);
    });
});

afterAll(() => {
    if (serverProcess) serverProcess.kill();
});

// ── /config endpoint ──────────────────────────────────────────────────────────

describe("GET /config — feature flags per mode", () => {
    const CASES = [
        // [mode, expected flags]
        ["none",             { punishments: false, praise: false, waterCue: false, stainCue: false }],
        ["punish",           { punishments: true,  praise: false, waterCue: false, stainCue: false }],
        ["praise",           { punishments: false, praise: true,  waterCue: false, stainCue: false }],
        ["water",            { punishments: false, praise: false, waterCue: true,  stainCue: false }],
        ["waterPunish",      { punishments: true,  praise: false, waterCue: true,  stainCue: false }],
        ["waterPraise",      { punishments: false, praise: true,  waterCue: true,  stainCue: false }],
        ["stain",            { punishments: false, praise: false, waterCue: false, stainCue: true  }],
        ["stainPunish",      { punishments: true,  praise: false, waterCue: false, stainCue: true  }],
        ["stainPraise",      { punishments: false, praise: true,  waterCue: false, stainCue: true  }],
        ["waterStain",       { punishments: false, praise: false, waterCue: true,  stainCue: true  }],
        ["waterStainPunish", { punishments: true,  praise: false, waterCue: true,  stainCue: true  }],
        ["waterStainPraise", { punishments: false, praise: true,  waterCue: true,  stainCue: true  }],
    ];

    test.each(CASES)("mode=%s returns correct flags", async (mode, expected) => {
        const { status, data } = await getJSON(`/config?mode=${mode}`);
        expect(status).toBe(200);
        expect(data.punishments).toBe(expected.punishments);
        expect(data.praise).toBe(expected.praise);
        expect(data.waterCue).toBe(expected.waterCue);
        expect(data.stainCue).toBe(expected.stainCue);
        expect(data.mode).toBe(mode);
    });

    test("unknown mode falls back to none flags", async () => {
        const { status, data } = await getJSON(`/config?mode=bogus`);
        expect(status).toBe(200);
        expect(data.punishments).toBe(false);
        expect(data.praise).toBe(false);
        expect(data.waterCue).toBe(false);
        expect(data.stainCue).toBe(false);
    });

    test("groupSize=2 is respected", async () => {
        const { data } = await getJSON(`/config?mode=none&groupSize=2`);
        expect(data.groupSize).toBe(2);
    });

    test("groupSize=4 is respected", async () => {
        const { data } = await getJSON(`/config?mode=none&groupSize=4`);
        expect(data.groupSize).toBe(4);
    });

    test("invalid groupSize falls back to default (4)", async () => {
        const { data } = await getJSON(`/config?mode=none&groupSize=99`);
        expect(data.groupSize).toBe(4);
    });
});

// ── root URL blocking ─────────────────────────────────────────────────────────

describe("Root URL access control", () => {
    test("GET / without mode param returns 403", async () => {
        const { status } = await get("/");
        expect(status).toBe(403);
    });

    test("GET / with mode param is allowed (200 or redirect)", async () => {
        const { status } = await get("/?mode=none");
        expect([200, 301, 302]).toContain(status);
    });

    test("GET /control.html is always accessible", async () => {
        const { status } = await get("/control.html");
        expect(status).toBe(200);
    });
});

// ── short-link redirects ──────────────────────────────────────────────────────

describe("Short-link redirects", () => {
    const LINKS = [
        ["none",  "none"],
        ["water", "water"],
        ["wp",    "waterPunish"],
        ["punish","punish"],
        ["praise","praise"],
        ["wpr",   "waterPraise"],
        ["stain", "stain"],
        ["sp",    "stainPunish"],
        ["spr",   "stainPraise"],
        ["ws",    "waterStain"],
        ["wsp",   "waterStainPunish"],
        ["wspr",  "waterStainPraise"],
    ];

    test.each(LINKS)("GET /%s redirects to ?mode=%s", async (link, mode) => {
        const { status, headers } = await get(`/${link}`);
        expect([301, 302]).toContain(status);
        expect(headers.location).toContain(`mode=${mode}`);
    });
});
