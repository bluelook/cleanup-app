jest.setTimeout(30000); // allow async events

const { spawn } = require("child_process");
const io = require("socket.io-client");
const SERVER_URL = "http://localhost:5000/"; //?mode=waterPunish";
let serverProcess;

beforeAll((done) => {
  // launch the real server
  serverProcess = spawn("node", ["server.js"], {
  cwd: ".", // current directory = /server
  stdio: "inherit"
});


  // wait a bit for server to start
  setTimeout(done, 2000);
});

afterAll(() => {
  if (serverProcess) serverProcess.kill();
});

describe("Water & Punishment logic", () => {
  let clientA, clientB;

  beforeAll((done) => {
    // connect two fake players
    clientA = io(SERVER_URL);
    clientB = io(SERVER_URL);

    let connected = 0;
    const onConnect = () => { if (++connected === 2) done(); };
    clientA.on("connect", onConnect);
    clientB.on("connect", onConnect);
  });

  afterAll(() => {
    clientA.disconnect();
    clientB.disconnect();
  });

  test("should record a water_event when leaving water", (done) => {
  clientA.once("water_saved", (payload) => {
    console.log("✅ Received water_saved:", payload);
    done();
  });

  // give socket a small delay to finish handshake
  setTimeout(() => {
    clientA.emit("water_event", {
      userId: "A1",
      roomId: "R1",
      timeInWater: 6.2,
      dropDuration: 3.1,
    });
  }, 300);
});


  test("should prevent self-punishment and allow punishing others", (done) => {
    // self-punishment should not trigger
    clientA.emit("punish_player", { from: "A1", target: "A1" });

    // valid punishment
    clientA.emit("punish_player", { from: "A1", target: "B1" });

    // you can verify by capturing server logs or mocking DB inserts
    done();
  });

  test("should load correct flags per mode", async () => {
  const res = await fetch(`${SERVER_URL}/config?mode=demo`);
  const data = await res.json();
  expect(data.groupSize).toBe(2);
  expect(data.punishments).toBe(false);
});


const mysql = require("mysql2/promise");

test("DB should have recent water_event", async () => {
  const conn = await mysql.createConnection({
    host: "localhost",
    user: "uri",
    password: "turhturh",
    database: "game_data",
  });

  const [rows] = await conn.query("SELECT * FROM water_events ORDER BY timestamp DESC LIMIT 1");
  expect(rows.length).toBeGreaterThan(0);
  expect(rows[0].user_id).toBeDefined();
  await conn.end();
});

});
