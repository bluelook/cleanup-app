const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const mysql = require("mysql2");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid"); //  Import UUID generator

// === Logging setup ===
// Set LOG_LEVEL environment variable to control logging:
// - "all" (default): Log everything to files
// - "errors": Only log errors and warnings to files
// Example: LOG_LEVEL=errors node server.js
const LOG_LEVEL = process.env.LOG_LEVEL || "all";

const logDir = path.join(__dirname, "logs");
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

const logFile = path.join(logDir, "server.log");
const errorLogFile = path.join(logDir, "error.log");

function logToFile(message, isError = false) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;

    // In "errors" mode, only write errors to files
    if (LOG_LEVEL === "errors" && !isError) {
        return; // Skip info logs
    }

    // Write to main log
    fs.appendFileSync(logFile, logMessage);

    // Also write errors to error log
    if (isError) {
        fs.appendFileSync(errorLogFile, logMessage);
    }
}

// Override console methods to also log to file
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

console.log = function(...args) {
    const message = args.join(' ');
    originalLog.apply(console, args);
    logToFile(message, false);
};

console.error = function(...args) {
    const message = args.join(' ');
    originalError.apply(console, args);
    logToFile(message, true);
};

console.warn = function(...args) {
    const message = args.join(' ');
    originalWarn.apply(console, args);
    logToFile(message, true);
};

console.log(`[LOGGING] Log level set to: ${LOG_LEVEL}`);
// === End logging setup ===


const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const userRooms = {}; // Tracks which room each user is in
const userNames = {}; // Tracks which room each user is in
const users = {}; //  Stores all user objects by their ID
const stars = {}; //  Stores stars by roomId
const balls = {};  //  Stores balls by roomId
const StartTime = {};// start time for each room
const chatMessages = {}; // ✅ Store messages per room
const roomTimeLeft = {}; //timer for each room
let gameStarted = {}; // バ. Track if game has started for each room


// === Experiment modes and their feature flags ===
const { featureSets, getLocationValue, computeNewCoop, COOP_W } = require('./gameLogic');
// === End of Experiment modes and their feature flags ===

app.use(cors());
app.use(express.json());

function normalizeGroupSize(value) {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < 2 || parsed > 4) return null;
  return parsed;
}

// === Determine mode (from URL query or environment variable) ===
app.use((req, res, next) => {
  const mode = req.query.mode || process.env.MODE || 'none';
  const baseFlags = featureSets[mode] || featureSets.none;
  const requestedGroupSize = normalizeGroupSize(req.query.groupSize);
  const effectiveGroupSize = requestedGroupSize || DEFAULT_GROUP_SIZE;
  req.flags = {
    ...baseFlags,
    groupSize: effectiveGroupSize
  };
  req.mode = mode;
  next();
});

// optional: /config endpoint for frontend to fetch current flags
app.get('/config', (req, res) => {
  res.json({ ...req.flags, mode: req.mode });
});

// shortcut links (e.g. /water → /?mode=water)
const linkMap = {
    none: 'none',
    water: 'water',
    wp: 'waterPunish',
    punish: 'punish',
    praise: 'praise',
    wpr: 'waterPraise',
    stain: 'stain',
    sp: 'stainPunish',
    spr: 'stainPraise',
    ws: 'waterStain',
    wsp: 'waterStainPunish',
    wspr: 'waterStainPraise'
};

app.get('/:link', (req, res, next) => {
  try {
    const key = req.params.link;
    if (linkMap[key]) {
      return res.redirect(`/index.html?mode=${linkMap[key]}`);
    }
    next();
  } catch (e) {
    res.status(400).end();
  }
});

// Catch malformed URI errors from bots/scanners
app.use((err, req, res, next) => {
  if (err instanceof URIError) {
    return res.status(400).end();
  }
  next(err);
});

// Landing page for version selection
app.get("/control.html", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/control.html"));
});

// Block direct access to root and index.html — must go through control.html
app.get(["/", "/index.html"], (req, res) => {
  if (!req.query.mode) {
    return res.status(403).send("Access denied.");
  }
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

// ✅ static middleware
app.use(express.static(path.join(__dirname, "../public")));


// Game stuff

const DEFAULT_TASK_TIME = 600; // time of the experiment in seconds (per-room default)
const DEFAULT_GROUP_SIZE = 4; // number of players in a room
const starPay = 0.02; //Define how much each apple (star) is worth in GBP

const P_star = 0.9; //probability of star to appear every second
const P_ball = 0.6; //probability of star to appear every second

const GRID_WIDTH = 15;
const GRID_HEIGHT = 10;
const startingPositions = [
    { x: 5, y: 4 },
    { x: 7, y: 5 },
    { x: 6, y: 6 },
    { x: 8, y: 8 },
    { x: 8, y: 2 },
    { x: 9, y: 7 }
];



// === Cooperation (Coop) tracking ===
const coopValues = {}; // { [userId]: number } current coop score per player

function updateCoop(userId) {
    const user = users[userId];
    if (!user || !user.position) return;
    const locVal = getLocationValue(user.position.x);
    const prev = (coopValues[userId] !== undefined) ? coopValues[userId] : 0.5;
    coopValues[userId] = computeNewCoop(prev, locVal);
}

// === End Coop tracking ===

// MySQL Database Connection
const dbConfig = require("./dbConfig"); // ✅ Import the config file

// ✅ Create MySQL connection using imported config
/*const db = mysql.createConnection({
    host: dbConfig.host,
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.database
});*/

const db = mysql.createPool({
  host: dbConfig.host,
  user: dbConfig.user,
  password: dbConfig.password,
  database: dbConfig.database,
  waitForConnections: true,
  connectionLimit: 10,  // adjust as needed
  queueLimit: 0
});

db.on('error', (err) => {
    console.error('MySQL Error:', err.code); // e.g., 'PROTOCOL_CONNECTION_LOST'
});

/*db.connect(err => {
    if (err) {
        console.error("Database connection failed: " + err.stack);
        return;
    }
    console.log("Connected to MySQL database.");
});*/

//  Global Storage
const waitingUsersByMode = {}; // { [mode:groupSize]: user[] }

function removeFromWaitingQueues(userId) {
    for (const queue of Object.values(waitingUsersByMode)) {
        const index = queue.findIndex((u) => u.id === userId);
        if (index !== -1) {
            const [removed] = queue.splice(index, 1);
            return removed;
        }
    }
    return null;
}

const connectedUsers = {}; //  Store socket IDs globally

function getUserIdBySocketId(socketId) {
    return Object.keys(connectedUsers).find((userId) => connectedUsers[userId] === socketId);
}

function cleanupRoom(roomId) {
    delete stars[roomId];
    delete balls[roomId];
    delete chatMessages[roomId];
    delete roomTimeLeft[roomId];
    delete StartTime[roomId];
    delete gameStarted[roomId];
}

io.on("connection", (socket) => {
    // 🟢 1.  Identify mode and load its flags first
    const mode = socket.handshake.query.mode || "none";
    const testMode = socket.handshake.query.test === "true"; // ✅ Read test mode flag
    let taskTime = DEFAULT_TASK_TIME;
    const modeKey = mode === "waterPunish" ? "wp" : mode;
    const expName = testMode ? `CleanUP_${modeKey}_test` : `CleanUP_${modeKey}`;
    
    // ✅ Override taskTime for test mode only
    if (testMode) {
        taskTime = parseInt(socket.handshake.query.testDuration, 10) || 10;
        console.log(`Test mode enabled: taskTime set to ${taskTime} seconds`);
    }
    
    const baseFlags = featureSets[mode] || featureSets.none;
    const requestedGroupSize = normalizeGroupSize(socket.handshake.query.groupSize);
    const effectiveGroupSize = requestedGroupSize || DEFAULT_GROUP_SIZE;
    socket.flags = {
        ...baseFlags,
        groupSize: effectiveGroupSize
    };
    const groupSize = socket.flags.groupSize || DEFAULT_GROUP_SIZE;

    console.log(`New client connected: ${socket.id}`);
    console.log(`→ mode = ${mode}`);
    console.log(`→ groupSize = ${groupSize}, punishments = ${socket.flags.punishments}, praise = ${socket.flags.praise}, waterCue = ${socket.flags.waterCue}, stainCue = ${socket.flags.stainCue}`);
    console.log("New client connected:", socket.id);

    socket.on("login", (username) => {
        console.log(`[LOGIN] Login request from socket ${socket.id}, username: ${username}`);

        if (!username) {
            console.error(`[LOGIN] ❌ FAILED: No username provided by socket ${socket.id}`);
            socket.emit("login_error", "Username required");
            return;
        }

        let userId = Math.random().toString(36).substr(2, 9);
        let user = { id: userId, username, roomId: null, avatar: null, position: null };
        users[userId] = user; //  Store full user object

        connectedUsers[userId] = socket.id;
        userNames[userId] = username;
        console.log(`[LOGIN] ✅ User Logged In: ${username} (userId: ${userId}, socket: ${socket.id})`);

        //  Only authenticate user, do NOT add to the waiting list yet
        socket.emit("login_success", user);
    });

    // Test mode helper: assign a room so post-game survey can run without a live match
    socket.on("test_setup", ({ userId, roomId, groupSize }) => {
        const user = users[userId];
        if (!user || !roomId) return;
        const size = normalizeGroupSize(groupSize) || DEFAULT_GROUP_SIZE;
        user.roomId = roomId;
        userRooms[userId] = roomId;
        users[userId] = user;
        StartTime[roomId] = new Date();
        roomTimeLeft[roomId] = 0;
        stars[roomId] = stars[roomId] || [];
        balls[roomId] = balls[roomId] || [];
        console.log(`Test setup: user ${userId} assigned to room ${roomId} (groupSize ${size})`);
    });

    //  New event to add users to the waiting list
    socket.on("join_waiting_list", (user) => {
        console.log(`[WAITING_LIST] Join request from socket ${socket.id}, userId: ${user?.id}`);
        const serverUser = user && users[user.id];
        if (!serverUser || !serverUser.username) {
            console.error(`[WAITING_LIST] ❌ FAILED: Invalid user. userId: ${user?.id}`);
            socket.emit("waiting_list_error", "Invalid user.");
            return;
        }

        console.log(`[WAITING_LIST] User ${serverUser.username} (${serverUser.id}) joined the waiting list for mode:${mode}, groupSize:${groupSize}`);

        const queueKey = `${mode}:${groupSize}`;
        if (!waitingUsersByMode[queueKey]) waitingUsersByMode[queueKey] = [];
        const queue = waitingUsersByMode[queueKey];
        queue.push(serverUser);
        console.log(`[WAITING_LIST] Queue ${queueKey} now has ${queue.length} users`);

        // In test mode, auto-fill the waiting list with dummy users so the room can be created immediately.
        if (testMode) {
            const seatsLeft = Math.max(0, (socket.flags?.groupSize || groupSize) - queue.length);
            for (let i = 0; i < seatsLeft; i++) {
                const dummyId = 'dummy_' + Math.random().toString(36).substr(2, 9);
                const dummyUser = {
                    id: dummyId,
                    username: `DUMMY_${Math.random().toString(36).substr(2,4)}`,
                    roomId: null,
                    avatar: null,
                    position: null
                };
                queue.push(dummyUser);
                users[dummyId] = dummyUser; // store so downstream code can reference
                console.log(`Test mode: added dummy user ${dummyUser.username} to waiting list.`);
            }
        }

        //  Assign a room if groupSize users are ready
        if (queue.length >= groupSize) {
            console.log(`[WAITING_LIST] ✅ Enough users (${queue.length}/${groupSize}) to create room for ${queueKey}`);

            let roomUsers = queue.splice(0, groupSize);
            let roomId = uuidv4().slice(0, 5); //  Unique 5-char room ID
            console.log(`[ROOM_ASSIGNED] Creating room ${roomId} with ${roomUsers.length} users`);

            chatMessages[roomId] = [];
            roomUsers.forEach((user, index) => {
                user.roomId = roomId;
                user.avatar = `images/player_${index + 1}.png`; //  Assign image avatar
                user.position = startingPositions[index % startingPositions.length];
                user.star_score = 0;
                user.ball_score = 0;
                coopValues[user.id] = 0.5; // Start at neutral cooperation
                userRooms[user.id] = roomId;
                users[user.id] = user; //  Store full user object
                console.log(`[ROOM_ASSIGNED] User ${user.username} (${user.id}) assigned to room ${roomId} as player ${index + 1}`);
            });


            roomUsers.forEach(user => {
                let socketId = connectedUsers[user.id];
                if (socketId) {
                    io.to(socketId).emit("room_assigned", { roomId, users: roomUsers });
                    console.log(`[ROOM_ASSIGNED] ✅ Sent room_assigned event to ${user.username} (socket: ${socketId})`);
                } else {
                    // Skip warning for dummy users in test mode
                    if (!user.id.startsWith('dummy_')) {
                        console.error(`[ROOM_ASSIGNED] ❌ No socket found for user ${user.username} (${user.id})`);
                    } else {
                        console.log(`[ROOM_ASSIGNED] Dummy user ${user.username} has no socket (test mode)`);
                    }
                }
            });

            console.log(`[ROOM_ASSIGNED] ✅ Room ${roomId} fully assigned with users: ${roomUsers.map(u => u.username).join(', ')}`);
        }
    });
        
    //  Handle room joining
    socket.on("join_room", (data) => {
        let { userId, roomId } = data;
        console.log(`[JOIN_ROOM] Request from socket ${socket.id}, userId: ${userId}, roomId: ${roomId}`);

        let user = users[userId];

        if (!user) {
            console.error(`[JOIN_ROOM] ❌ FAILED: User ${userId} not found`);
            return;
        }

        if (user.roomId !== roomId) {
            console.error(`[JOIN_ROOM] ❌ FAILED: User ${userId} (${user.username}) roomId mismatch. User room: ${user.roomId}, requested: ${roomId}`);
            return;
        }

        socket.join(`room_${roomId}`); // ✅ User joins the room
        console.log(`[JOIN_ROOM] ✅ ${user.username} joined room ${roomId} (socket: ${socket.id})`);

        // ✅ Notify the user that they have joined
        socket.emit("room_joined", { roomId });

        // ✅ Broadcast to all users in the room
        let roomUsers = Object.values(users).filter(u => u.roomId === roomId);
        console.log(`[JOIN_ROOM] Room ${roomId} now has ${roomUsers.length} users in socket room`);
        io.to(`room_${roomId}`).emit("update_room_users", roomUsers);
    });    

    socket.on("send_chat_message", (data) => {

        let { userId, roomId, message } = data;
        console.log('message recieved from user '+userId + ', room '+roomId+ ', message: '+ message);

        let user = users[userId];
    
        if (!user || user.roomId !== roomId) return;
        
        if (!chatMessages[roomId]) {
            chatMessages[roomId] = [];
        }
    
        // ✅ Store the message
        chatMessages[roomId].push({ userId, username: user.username, avatar: user.avatar, message });
       // console.log('Messages in room:' + JSON.stringify({ chatMessages }))
        // ✅ Send message to all users in the room
        io.to(`room_${roomId}`).emit("receive_chat_message", chatMessages[roomId]);
    
        // ✅ Check if all users in the room sent a message
        /*let roomUsers = Object.values(users).filter(u => u.roomId === roomId);
        if (chatMessages[roomId].length === roomUsers.length) {
            io.to(`room_${roomId}`).emit("all_messages_received");
        }*/
    });

    socket.on("start_grid_game", (data) => {
        let { roomId } = data;

        console.log(`[START_GRID_GAME] Request received from socket ${socket.id}, roomId: ${roomId}`);

        if (!roomId) {
            console.error(`[START_GRID_GAME] ❌ FAILED: No roomId provided by socket ${socket.id}`);
            return;
        }

        const callerId = getUserIdBySocketId(socket.id);
        console.log(`[START_GRID_GAME] Socket ${socket.id} maps to userId: ${callerId}`);

        const caller = callerId ? users[callerId] : null;
        if (!caller) {
            console.error(`[START_GRID_GAME] ❌ FAILED: Caller not found for socket ${socket.id}, userId: ${callerId}`);
            return;
        }

        if (caller.roomId !== roomId) {
            console.error(`[START_GRID_GAME] ❌ FAILED: Caller roomId mismatch. Caller in room ${caller.roomId}, requested room ${roomId}`);
            return;
        }

        console.log(`[START_GRID_GAME] ✅ Starting grid game for room ${roomId}`);

        // ✅ Clear chat messages to free memory
        if (chatMessages[roomId]) {
            delete chatMessages[roomId];
            console.log(`[START_GRID_GAME] Cleared chat messages for room ${roomId}`);
        }

        // ✅ Get all users in the room
        let roomUsers = Object.values(users).filter(u => u.roomId === roomId);
        console.log(`[START_GRID_GAME] Room ${roomId} has ${roomUsers.length} users: ${roomUsers.map(u => u.username).join(', ')}`);

        // ✅ Start the game timer (spawning stars & balls, countdown)
        startRoomTimer(roomId);

        // ✅ Emit game start event with room ID and users
        io.to(`room_${roomId}`).emit("start_grid_game", { roomId, users: roomUsers });
        console.log(`[START_GRID_GAME] ✅ Emitted start_grid_game event to room_${roomId}`);
    });   

    socket.on("disconnect", () => {
        console.log(`[DISCONNECT] Client disconnected: ${socket.id}`);
        let disconnectedUserId = Object.keys(connectedUsers).find(userId => connectedUsers[userId] === socket.id);

        if (disconnectedUserId) {
            const username = userNames[disconnectedUserId];
            const isDummy = disconnectedUserId.startsWith('dummy_');

            if (isDummy) {
                console.log(`[DISCONNECT] Dummy user ${username} (${disconnectedUserId}) disconnected (test mode)`);
            } else {
                console.log(`[DISCONNECT] Identified user: ${username} (${disconnectedUserId})`);
            }

            delete connectedUsers[disconnectedUserId];

            //  Remove from waitingUsers if they haven't been assigned a room
            const removed = removeFromWaitingQueues(disconnectedUserId);
            if (removed) {
                console.log(`[DISCONNECT] User ${removed.username} removed from waiting list.`);
                return; //  Exit if user was still in queue
            }

            //  Find the user's room from `userRooms`
            let roomId = userRooms[disconnectedUserId];
            let userNameLeft = userNames[disconnectedUserId];

            if (roomId) {
                console.log(`[DISCONNECT] User ${userNameLeft} (${disconnectedUserId}) left room ${roomId}`);
                io.to(`room_${roomId}`).emit("user_left", { roomId, username: userNameLeft });

                const remainingUsers = Object.values(users).filter(u => u.roomId === roomId);
                console.log(`[DISCONNECT] Room ${roomId} has ${remainingUsers.length} users remaining: ${remainingUsers.map(u => u.username).join(', ')}`);

                if (remainingUsers.length === 0) {
                    console.log(`[DISCONNECT] Room ${roomId} is empty, cleaning up...`);
                    cleanupRoom(roomId);
                }
            }

            delete users[disconnectedUserId];
            delete userRooms[disconnectedUserId];
            delete userNames[disconnectedUserId];
        } else {
            // Socket disconnected before login - this is normal (page refresh, closed tab, etc.)
            console.log(`[DISCONNECT] Socket ${socket.id} disconnected before login`);
        }
    });


    /* ------ Game stuff!!! ----*/

    //  Handle movement requests
    socket.on("move", (data) => {

        let { userId, direction } = data;
        console.log(userId+' moved to '+ direction);
        let user = users[userId]; //  Get full user object from `users`
       // console.log('Found user -  '+ user.position);

        if (!user || !user.position || !user.roomId) {
            console.log('leave because no user')
            return;
        };
    
        let { x, y } = user.position;
        let newX = x, newY = y;
    
        if (direction === "ArrowLeft") newX--;
        if (direction === "ArrowRight") newX++;
        if (direction === "ArrowUp") newY--;
        if (direction === "ArrowDown") newY++;
    
        //  Check if move is valid
        if (newX < 0 || newX >= GRID_WIDTH || newY < 0 || newY >= GRID_HEIGHT) {
            console.log('leave because bounds')
            return;
        };

        // ✅ Get only users in the same room
       // let roomUsers = Object.values(users).filter(u => u.roomId === roomId);
        //  Get all users in the same room
        let roomId = user.roomId;
        if (!stars[roomId]) stars[roomId] = [];
        if (!balls[roomId]) balls[roomId] = [];
        let roomUsers = Object.values(users).filter(u => u.roomId === roomId);

        if (roomUsers.some(u => u.position.x === newX && u.position.y === newY)) {
            console.log('leave because collide')
            return;
        };

          
        //  Update user position
        user.position = { x: newX, y: newY };
        users[userId]= user ; 

        
        //  Check if user collected a star
        let collectedStarIndex = stars[roomId].findIndex(s => s.x === newX && s.y === newY);
        let pickedStar = false;
        console.log(`Plan to remove star at (${newX}, ${newY}): Index ${collectedStarIndex}`);

        if (collectedStarIndex !== -1) {
            let removedStar = stars[roomId][collectedStarIndex];
            stars[roomId].splice(collectedStarIndex, 1); //  Remove star
            
            user.star_score = user.star_score + 1; //  Increase score
            users[userId] = user;
            pickedStar = true;

            //  Send updated stars list after collecting
            io.to(`room_${roomId}`).emit("update_stars", stars[roomId]);
            io.to(`room_${roomId}`).emit("update_scores", getRoomScores(roomId));
        }

        //  Check if user collected a ball
        let collectedBallIndex = balls[roomId].findIndex(b => b.x === newX && b.y === newY);
        let pickedBall = false;
        if (collectedBallIndex !== -1) {
            let removedBall = balls[roomId][collectedBallIndex];
            balls[roomId].splice(collectedBallIndex, 1); //  Remove ball
            
            user.ball_score = user.ball_score  + 1; //  Increase ball score
            
            pickedBall = true;
            users[userId] = user;

            console.log(`Removed ball at (${removedBall.x}, ${removedBall.y})`);
            console.log(`User ${user.username} new ball score: ${user.ball_score}`);

            //  Send updated balls list
            io.to(`room_${roomId}`).emit("update_balls", balls[roomId]);

            //  Send updated scores
            io.to(`room_${roomId}`).emit("update_scores", getRoomScores(roomId));
        }
        //  Send updated positions of all room users
        io.to(`room_${roomId}`).emit("update_positions", roomUsers );

        // === Update and broadcast Coop ===
        updateCoop(userId);
        io.to(`room_${roomId}`).emit("coop_update", { userId, coopValue: coopValues[userId] });
        // === End Coop update ===

        //  Save movement data to MySQL (coop_value included)
        let created_at = new Date().toISOString().slice(0, 19).replace("T", " ");
        let timestamp = new Date()-StartTime[roomId];

        const sql = `
        INSERT INTO movements (room_id, exp_name, group_size, player_id, time_stamp, x, y, stars_in_room, balls_in_room, star_score, ball_score, picked_star, picked_ball, coop_value, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        const values = [
            roomId,
            expName,
            groupSize,
            userId,
            timestamp,
            newX,
            newY,
            stars[roomId].length,
            balls[roomId].length,
            user.star_score,
            user.ball_score,
            pickedStar,
            pickedBall,
            coopValues[userId],
            created_at
        ];

        db.query(sql, values, (err, result) => {
            if (err) {
                console.error("Failed to save movement:", err);
            } else {
                console.log(`Movement saved for ${user.username} at (${newX}, ${newY})`);
            }
        });             
    }); 

    // יhandle punishment mode
    if (socket.flags.punishments) {
        // === punishments event listener ===
        socket.on("punish_player", ({ punisherId, punishedId, roomId, punishMessage, messageId }) => {
            const punisher = users[punisherId];
            if (!punisher || punisher.roomId !== roomId) return;
            const timestamp = new Date()-StartTime[roomId];
            const created_at = new Date().toISOString().slice(0, 19).replace("T", " ");
                // Save to DB
                db.query(
                    "INSERT INTO punishments (punisher_id, punished_id, room_id, punishment_message, message_id, timestamp, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    [punisherId, punishedId, roomId, punishMessage, messageId, timestamp, created_at], (err) => {
                        if (err) console.error("❌ DB Error:", err);
                        else console.log(`✅ Punishment saved: ${punisherId} ➡️ ${punishedId} [${messageId}] ("${punishMessage}")`);
                    }
                );

                const roomUsers = Object.values(users).filter(u => u.roomId === roomId);

                // Broadcast to all players in the room
                io.to(`room_${roomId}`).emit("punishment_notice", { punisherId, punishedId, punishMessage, messageId, roomUsers });
        });
    }
    
    // handle praise mode
    if (socket.flags.praise) {
        socket.on("praise_player", ({ praiserId, praisedId, roomId, praiseMessage, messageId }) => {
            const praiser = users[praiserId];
            if (!praiser || praiser.roomId !== roomId) return;
            const timestamp = new Date() - StartTime[roomId];
            const created_at = new Date().toISOString().slice(0, 19).replace("T", " ");
            db.query(
                "INSERT INTO praises (praiser_id, praised_id, room_id, praise_message, message_id, timestamp, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                [praiserId, praisedId, roomId, praiseMessage, messageId, timestamp, created_at], (err) => {
                    if (err) console.error("DB Error:", err);
                    else console.log(`Praise saved: ${praiserId} -> ${praisedId} [${messageId}] ("${praiseMessage}")`);
                }
            );

            const roomUsers = Object.values(users).filter(u => u.roomId === roomId);
            io.to(`room_${roomId}`).emit("praise_notice", { praiserId, praisedId, praiseMessage, messageId, roomUsers });
        });
    }

    // יhandle water mode
    if (socket.flags.waterCue) {
        // === Water event listener ===
        socket.on("water_event", (data) => {
            const { userId, roomId, timeInWater, dropDuration } = data;
            const user = users[userId];
            if (!user || user.roomId !== roomId) return;
            const created_at = new Date().toISOString().slice(0, 19).replace("T", " ");
            const timestamp = new Date()-StartTime[roomId];

              //Save to DB
              const sql = `INSERT INTO water_events (user_id, room_id, time_in_water, drop_duration, timestamp, created_at) VALUES (?, ?, ?, ?, ?, ?)`;
              db.query(sql, [userId, roomId, timeInWater, dropDuration, timestamp, created_at], (err) => {
                if (err) {
                  console.error("❌ DB Error saving water_event:", err);
                } else {
                    io.emit("water_saved", { userId }); // ✅ broadcast instead of socket.emit
                    console.log(`💧 Water event saved for ${userId} at ${timestamp}`);
                }
              });
        });
    }

    function getRoomScores(roomId) {
        console.log('update scores')
        return Object.values(users)
            .filter(u => u.roomId === roomId)
            .map(u => ({ username: u.username, star_score: u.star_score , ball_score: u.ball_score  }));
    }

    function startRoomTimer(roomId) {
        console.log(`[TIMER] startRoomTimer called for room ${roomId}`);

        if (!roomId) {
            console.error(`[TIMER] ❌ FAILED: No roomId provided to startRoomTimer`);
            return;
        }

        if (gameStarted[roomId]) {
            console.warn(`[TIMER] ⚠️ Game already started for room ${roomId}, skipping timer start`);
            return;
        }

        gameStarted[roomId] = true; // ✅ Mark the game as started
        console.log(`[TIMER] ✅ Game marked as started for room ${roomId}`);

        roomTimeLeft[roomId] = taskTime;

        StartTime[roomId] = new Date();
        console.log(`[TIMER] Start time for room ${roomId} is ${StartTime[roomId]}, taskTime: ${taskTime}s`);
        stars[roomId] = []; //  Initialize stars array for this room
        balls[roomId] = []; //  Initialize balls array for this room
        console.log(`[TIMER] Initialized stars and balls arrays for room ${roomId}`);

        const interval = setInterval(() => {
            io.to(`room_${roomId}`).emit("update_timer", roomTimeLeft[roomId]);
            

            roomTimeLeft[roomId]--;
            //  Try to generate a new star (90% probability)
           // console.log('new p star ='+ P_star/(1+balls[roomId].length))
            if (Math.random() < P_star/(1+balls[roomId].length)) {
                generateNewStar(roomId);
            }
             //  Try to generate a new ball
            if (Math.random() < P_ball) {
                generateNewBall(roomId);
            }
            if (roomTimeLeft[roomId] < 0) {
                clearInterval(interval);
                io.to(`room_${roomId}`).emit("time_up");
            }
        }, 1000);
    }

    function generateNewStar(roomId) {
        if (!stars[roomId]) return;
    
        let x, y;
        let attempts = 0;
        do {
            x = Math.floor(Math.random() * 3); //  Only in first 3 columns
            y = Math.floor(Math.random() * GRID_HEIGHT);
            attempts++;
        } while (
            attempts < 10 &&
            (stars[roomId].some(s => s.x === x && s.y === y) || // Avoid overlapping stars
            Object.values(users).some(u => u.roomId === roomId && u.position.x === x && u.position.y === y)) // Avoid players
        );
    
        if (attempts < 10) {
            let star = { x, y };

            stars[roomId].push(star);

            console.log(`New star generated in room ${roomId} at (${x}, ${y})`);

            io.to(`room_${roomId}`).emit("update_stars", stars[roomId]);
        }
    }
    
    function generateNewBall(roomId) {
        if (!balls[roomId]) {
            balls[roomId] = [];
        }
    
        let x, y;
        let attempts = 0;
        do {
            x = Math.floor(Math.random() * 3) + (GRID_WIDTH - 3); //  Rightmost 3 columns (12, 13, 14)
            y = Math.floor(Math.random() * GRID_HEIGHT);
            attempts++;
        } while (
            attempts < 10 &&
            (balls[roomId].some(b => b.x === x && b.y === y) ||  // Avoid overlapping balls
            Object.values(users).some(u => u.roomId === roomId && u.position.x === x && u.position.y === y)) // Avoid players
        );
    
        if (attempts < 10) {
            let newBall = { x, y };
            balls[roomId].push(newBall);
    
            console.log(`New ball generated in room ${roomId} at (${x}, ${y})`);
            
            //  Send full balls list
            io.to(`room_${roomId}`).emit("update_balls", balls[roomId]);
        }
    }
    
    socket.on("submit_demographics", (data) => {
        const { userId, age, gender, education, comments } = data;
    
        let user = users[userId];
        if (!user) {
            console.error("User not found:", userId);
            socket.emit("demographics_error", "User not found.");
            return;
        }
    
        let roomId = user.roomId;
        let userName = user.username;
        let timestamp = new Date().toISOString().slice(0, 19).replace("T", " ");
        let starScore = user.star_score || 0;
        let ballScore = user.ball_score || 0;
    
        const sql = `
            INSERT INTO demographics (player_id, player_name,room_id, group_size, exp_name, timestamp, age, gender, education, comments, star_score, ball_score)
            VALUES (?, ?,?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
        const values = [userId, userName,roomId, groupSize, expName, timestamp, age, gender, education, comments, starScore, ballScore];
    
        db.query(sql, values, (err, result) => {
            if (err) {
                console.error("Failed to save demographics:", err);
                socket.emit("demographics_error", "There was an issue saving your data.");
            } else {
                console.log(`Demographics saved for user ${userId}`);
    
                // ✅ Show thank-you screen
                socket.emit("experiment_ended", { userId, starScore:starScore, ballScore ,starPay});
            }
        });
    });

    socket.on("end_experiment", (data) => {
        console.log("End "+data)
        let user = users[data.userId];
        if (!user) return;
    
        let roomId = user.roomId;    

    
        // ✅ Remove user from tracking objects
        delete users[data.userId];
        delete userRooms[data.userId];
        delete connectedUsers[data.userId];
        delete coopValues[data.userId];
        delete roomTimeLeft[roomId];
        console.log(`User ${data.userId} left. Checking if room ${roomId} is empty...`);
    
        // ✅ If no users are left in the room, remove it
        let remainingUsers = Object.values(users).filter(u => u.roomId === roomId);
        if (remainingUsers.length === 0) {
            console.log(`Room ${roomId} is now closed.`);
            cleanupRoom(roomId);
        }
    
        // ✅ Send "experiment_ended" only to room members
       // io.to(`room_${roomId}`).emit("experiment_ended", { userId, starScore:starScore, ballScore ,starPay:starPay});
    
        console.log(`Experiment ended for user ${data.userId}. Scores sent to room ${roomId}.`);
    });
    
    socket.on("user_timeout", (data) => {
        console.log("time out  "+data.userId)
        console.log("time out  "+ JSON.stringify( data )
        )

        let user = users[data.userId];
        if (!user) return;
    

        
            //  Remove from waitingUsers if they haven't been assigned a room
            const removed = removeFromWaitingQueues(data.userId);
            if (removed) {
                console.log(`User ${removed.username} removed from waiting list.`);
                return; //  Exit if user was still in queue
            }
    
        // ✅ Remove user from tracking objects
        delete users[data.userId];
        delete userRooms[data.userId];
        delete connectedUsers[data.userId];
        delete coopValues[data.userId];
        console.log(`User ${data.userId} left.`);
    });

    // === SIAS (Social Interaction Anxiety Scale) submission ===
    socket.on("submit_sias", (data) => {
        const { userId, roomId, responses } = data;
        // responses: array of 20 integers [score_item1, ..., score_item20] (raw, 0–4)

        const user = users[userId];
        if (!user) {
            socket.emit("survey_saved_success", { metric: "sias" });
            return;
        }

        const totalScore = responses.reduce((sum, v) => sum + v, 0);

        const cols = Array.from({ length: 19 }, (_, i) => `sias_${i + 1}`).join(", ");
        const placeholders = responses.map(() => "?").join(", ");
        const sql = `INSERT INTO sias (player_id, room_id, ${cols}, total_score) VALUES (?, ?, ${placeholders}, ?)`;
        const values = [userId, roomId, ...responses, totalScore];

        db.query(sql, values, (err) => {
            if (err) {
                console.error("Failed to save SIAS:", err);
            } else {
                console.log(`SIAS saved for user ${userId}, total=${totalScore}`);
            }
            socket.emit("survey_saved_success", { metric: "sias" });
        });
    });
    // === End SIAS handler ===

    // ✅ Handle BATCH survey submission (Renamed from 'belief')
    socket.on("submit_survey_batch", (data) => {
        const { userId, roomId, responses, metric } = data; 
        // responses is an array: [{ targetId: 'abc', value: 10 }, ...]

        const user = users[userId];
        if (!user || user.roomId !== roomId) {
            socket.emit("survey_saved_success", { metric });
            return;
        }

        if (!responses || responses.length === 0) {
            socket.emit("survey_saved_success", { metric }); // Skip if empty
            return;
        }

        // Prepare data for Bulk Insert
        const timestamp = new Date() - StartTime[roomId];
        const sql = `INSERT INTO post_game_survey (judge_id, target_id, room_id, metric, survey_value, timestamp, created_at) VALUES ?`;
        
        const values = responses.map(r => [
            userId, 
            r.targetId, 
            roomId, 
            metric, 
            r.value, 
            timestamp,
            new Date()
        ]);

        db.query(sql, [values], (err, result) => {
            if (err) {
                console.error("❌ Failed to save survey batch:", err);
            } else {
                console.log(`✅ Survey batch saved for ${userId} (${metric}, ${result.affectedRows} rows)`);
                // Tell client to move to the next step
                socket.emit("survey_saved_success", { metric });
            }
        });
    });
  
    
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
