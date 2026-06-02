//const socket = io("http://localhost:5000");
//const socket = io();
// === read window.flags ===
const params = new URLSearchParams(window.location.search);
const mode = params.get('mode') || 'full';
const groupSize = params.get('groupSize') || '';
const tutorialStartParam = parseInt(params.get('tutorialStart'), 10);
const skipTutorial = params.get('skipTutorial') === 'true';
const skipConsent = params.get('skipConsent') === 'true';
const jumpSurvey = params.get('jumpSurvey') === 'true';
const jumpSias = params.get('jumpSias') === 'true';
const testMode = params.get('test') === 'true';  // ✅ Testing mode flag
const testDuration = params.get('testDuration') || '';
// === end of read window.flags ===

const socket = io({ query: { mode, groupSize, test: testMode, testDuration } });


let user = null;
let roomId = null;
let users = {};
let waitingTimeout;
const timeOut = testMode ? 5 : 10; // minutes
const payApple = 0.02;//
const chatCountdownSeconds = testMode ? 5 : 60;
let instructionPage = 1; // ✅ Track the instruction page number
let gameFrozen = false;
let inTutorial = false; // ✅ Track if we're in tutorial mode
// === Water tracking ===
const playerStates = {}; // Track in-water state per player

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}


function isWaterTile(x, y) {
    // Adjust this condition to match your grid layout:
    // here, x >= 12 means right side of the board is water
    return x >= 12;
}

function getTutorialModeFlags() {
    return {
        water:  (mode === "water"  || mode === "waterPunish"      || mode === "waterPraise"      || mode === "waterStain" || mode === "waterStainPunish" || mode === "waterStainPraise"),
        stain:  (mode === "stain"  || mode === "stainPunish"      || mode === "stainPraise"      || mode === "waterStain" || mode === "waterStainPunish" || mode === "waterStainPraise"),
        punish: (mode === "punish" || mode === "waterPunish"      || mode === "stainPunish"      || mode === "waterStainPunish"),
        praise: (mode === "praise" || mode === "waterPraise"      || mode === "stainPraise"      || mode === "waterStainPraise")
    };
}

function getTutorialStartStage() {
    const flags = getTutorialModeFlags();
    const maxStages = 5 + (flags.water ? 1 : 0) + (flags.stain ? 1 : 0) + (flags.punish ? 1 : 0) + (flags.praise ? 1 : 0);
    if (!testMode) return 1;
    if (!Number.isFinite(tutorialStartParam)) return 1;
    return Math.min(Math.max(tutorialStartParam, 1), maxStages);
}


// === Water drop display - main experiment ===
   function showWaterDrop(playerId, durationSec) {
  const avatar = document.querySelector(`img.player-avatar[data-user-id="${playerId}"]`);
      if (!avatar) return;

      document.querySelectorAll(`.water-drop[data-user-id="${playerId}"]`).forEach(el => el.remove());

      const drop = document.createElement("div");
      drop.className = "water-drop";
      drop.dataset.userId = playerId;
      drop.textContent = "💧";
      drop.style.position = "absolute";
      drop.style.top = "-20px";
      drop.style.left = "50%";
      drop.style.transform = "translateX(-50%)";
      avatar.parentElement.style.position = "relative";
      avatar.parentElement.appendChild(drop);

      playerStates[playerId] = playerStates[playerId] || {};
      playerStates[playerId].dropActive = true;
      playerStates[playerId].dropExpiresAt = Date.now() + durationSec * 1000;

      setTimeout(() => {
        drop.remove();
        if (playerStates[playerId]) playerStates[playerId].dropActive = false;
      }, durationSec * 1000);
}

// === Coop-driven persistent water drop ===
function showCoopDrop(playerId) {
    if (document.querySelector(`.coop-drop[data-user-id="${playerId}"]`)) return; // already showing
    const avatar = document.querySelector(`img.player-avatar[data-user-id="${playerId}"]`);
    if (!avatar) return;
    const drop = document.createElement("div");
    drop.className = "coop-drop";
    drop.dataset.userId = playerId;
    drop.textContent = "💧";
    drop.style.position = "absolute";
    drop.style.top = "-20px";
    drop.style.left = "50%";
    drop.style.transform = "translateX(-50%)";
    avatar.parentElement.style.position = "relative";
    avatar.parentElement.appendChild(drop);
}

function hideCoopDrop(playerId) {
    document.querySelectorAll(`.coop-drop[data-user-id="${playerId}"]`).forEach(el => el.remove());
}

// === Coop-driven stain (low cooperation) ===
function showStain(playerId, coopValue) {
    if (document.querySelector(`.coop-stain[data-user-id="${playerId}"]`)) return; // already showing
    const avatar = document.querySelector(`img.player-avatar[data-user-id="${playerId}"]`);
    if (!avatar) return;
    const stain = document.createElement("div");
    stain.className = "coop-stain";
    stain.dataset.userId = playerId;
    stain.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="32" height="32">
      <path fill="#7a3b10" d="M50,10 C62,5 80,18 85,32 C92,40 90,55 82,62 C90,70 85,85 72,88 C60,95 45,90 38,82 C28,88 12,80 10,68 C5,55 14,42 24,38 C18,26 28,10 40,8 C43,7 47,8 50,10 Z"/>
    </svg>`;
    avatar.parentElement.style.position = "relative";
    avatar.parentElement.appendChild(stain);
    console.log(`[Coop] Stain appeared for player ${playerId} — coop = ${coopValue.toFixed(3)}`);
}

function hideStain(playerId) {
    document.querySelectorAll(`.coop-stain[data-user-id="${playerId}"]`).forEach(el => el.remove());
}

// === Tutorial-only water drop (stage 6) ===
function showTutorialWaterDrop(durationSec) {
  const playerId = "TUTORIAL_PLAYER";
  const avatar = document.querySelector(`img.player-avatar[data-user-id="${playerId}"]`);
  if (!avatar) return;

  // Remove existing tutorial drops for this player
  document
    .querySelectorAll(`.water-drop[data-user-id="${playerId}"]`)
    .forEach(el => el.remove());

  const drop = document.createElement("div");
  drop.className = "water-drop";
  drop.dataset.userId = playerId;
  drop.textContent = "💧";

  // Position the drop *above* the avatar's head
  drop.style.position = "absolute";
  drop.style.bottom = "100%";         // place above the avatar box
  drop.style.left = "50%";
  drop.style.transform = "translateX(-50%) translateY(-4px)";

  avatar.parentElement.style.position = "relative";
  avatar.parentElement.appendChild(drop);

  // Drop lifetime
  setTimeout(() => {
    drop.remove();

    // Notify tutorial that drop ended
    if (typeof window.onTutorialDropEnd === "function") {
      window.onTutorialDropEnd();
    }
  }, durationSec * 1000);
}

function tutorialPunish(sourceId, targetId, callback) {
    const realTarget = (targetId === "PLAYER" ? "TUTORIAL_PLAYER" : "TUTORIAL_DUMMY");

    // Avatar visuals for messages
    const avatarPlayerHTML = `<img src="images/player_demo.png" width="25" style="vertical-align:middle;">`;
    const avatarDummyHTML  = `<img src="images/player_demo.png" width="25" style="vertical-align:middle; filter: grayscale(100%) brightness(70%);">`;

    const sourceAvatarHTML = (sourceId === "PLAYER" ? avatarPlayerHTML : avatarDummyHTML);
    const targetAvatarHTML = (targetId === "PLAYER" ? avatarPlayerHTML : avatarDummyHTML);

    const targetElem = document.querySelector(`img.player-avatar[data-user-id="${realTarget}"]`);
    if (!targetElem) {
        console.error("tutorialPunish: could not find target avatar:", realTarget);
        return;
    }

    const wrapper = targetElem.parentElement;
    wrapper.style.position = "relative";

    const explosion = document.createElement("div");
    explosion.className = "punishment-effect";
    explosion.textContent = "💥";
    explosion.style.position = "absolute";
    explosion.style.top = "-20px";
    explosion.style.left = "50%";
    explosion.style.transform = "translateX(-50%)";
    explosion.style.fontSize = "28px";
    wrapper.appendChild(explosion);

    const tutorialPunishEntry = punishmentMessages[Math.floor(Math.random() * punishmentMessages.length)];

    $("#centered-message")
        .html(`${sourceAvatarHTML} is asking ${targetAvatarHTML} to help clean: '${tutorialPunishEntry.text}'`)
        .fadeIn();

    if (targetId === "PLAYER") {
        $("#punishment-popup")
            .html(`${sourceAvatarHTML} is asking you to help clean: '${tutorialPunishEntry.text}'`)
            .fadeIn();
    }

    setTimeout(() => {
        explosion.remove();
        $("#centered-message").stop(true, true).hide().empty();
        $("#punishment-popup").stop(true, true).hide().empty();
        if (callback) callback();
    }, 3000);
}

function initGame(flags) {
    console.log("Initializing game with flags:", flags);

    // adjust group size display
    const groupInfo = document.getElementById("group-info");
    if (groupInfo) {
        groupInfo.textContent = `Group size: ${flags.groupSize}`;
    }

    // handle water cue visuals
    const waterOverlay = document.getElementById("water-overlay");
    if (waterOverlay) {
        if (flags.waterCue) {
            waterOverlay.style.display = "block";
        } else {
            waterOverlay.style.display = "none";
        }
    }

    // custom messages
    const modeBanner = document.getElementById("mode-banner");
    if (modeBanner) {
        modeBanner.textContent = `Mode: ${flags.mode || "default"}`;
    }

}

fetch(`/config?mode=${mode}&groupSize=${groupSize}`)
    .then(r => r.json())
    .then(flags => {
        window.flags = flags;
        initGame(flags);
    });

function showScreen(screenType) {
    let html = "";
    console.log('login data' + JSON.stringify(user))

    switch (screenType) {
        case "welcome":
            html = `
                <div class="container text-center">
                    <h2>Welcome to the Apple Harvest Study</h2>
                    <p>Thank you for participating! Click below to continue.</p>
                    <button class="btn btn-primary mt-3" onclick="showScreen('info')">Continue</button>
                </div>
            `;
            break;

        case "info":
            html = `
                <div class="container text-center">
                    <h2>Study Information</h2>
                    <div  class="container text-start ">
                    <h3>Welcome to our experiment, it’s nice to meet you!</h3>
                    
                    <p><strong>First, some information about the experiment:</strong></p>                 
                    <p>This study has been approved by the University of Haifa, Faculty of Social Sciences Research Ethics Committee.</p>
                    <p><strong>Name, address, and contact details of investigators:</strong><br>
                    Uri Hertz, Department of Cognitive Sciences, University of Haifa, Haifa, Israel, 31905.<br>
                    <a href="mailto:uhertz@cog.haifa.ac.il">uhertz@cog.haifa.ac.il</a></p>

                    <p>We would like to invite you to participate in this research project titled ‘The cognitive basis of social behavior’, aimed at understanding the way people learn and make decisions in social contexts. You should only participate if you want to; choosing not to take part will not disadvantage you in any way.</p>
                    <p>Before you decide whether you want to take part, please read the following information carefully and discuss it with others if you wish. Ask us if there is anything that is not clear or you would like more information.</p>
                    <p>In this experiment, you will be asked to use your mouse while playing a multiplayer task. The task involves moving around a grid and collecting items, and interacting with other players. You will also be asked to answer some simple questions about yourself. Full instructions will be provided before the experiment begins.</p>
                    <p>There are no anticipated risks or benefits associated with participation in this study. Data collected in this experiment may be used for scientific publication and presentations, after anonymization and removal of all identifiable details.</p>
                    <p>It is up to you to decide whether or not to take part. If you choose not to participate, you will not incur any penalties or lose any benefits to which you might have been entitled. However, if you do decide to take part, you can print out this information sheet and you will be asked to fill out a consent form on the next page. Even after agreeing to take part, you can still withdraw at any time and without giving a reason.</p>
                    <p>In case you would like additional information about the experiment, you may contact us at any time, including after you have participated.</p>
                    <p>Participants in our experiment must be over 18 years of age, with no substantial neurological or psychiatric disease.</p>
                    </div>
                    <button class="btn btn-primary mt-3" onclick="showScreen('consent')">Next</button>
                </div>

                  
            `;
            break;

        case "consent":
            html = `
            <div class="container text-center">
                <h2>Consent Form</h2>

                <p>Thank you for your interest in taking part in this research.</p>
                <p><strong>Please confirm the following:</strong></p>

                <div class="text-start mx-auto" style="max-width: 600px;">
                    <div class="form-check mb-2">
                        <input class="form-check-input" type="checkbox" id="consent1" style="transform: scale(1.15); accent-color: #000; border: 1px solid #000; box-shadow: 0 0 0 1px #000 inset;">
                        <label class="form-check-label" for="consent1">
                            I have read the information page and I consent to take part in this study.
                        </label>
                    </div>

                    <div class="form-check mb-2">
                        <input class="form-check-input" type="checkbox" id="consent2" style="transform: scale(1.15); accent-color: #000; border: 1px solid #000; box-shadow: 0 0 0 1px #000 inset;">
                        <label class="form-check-label" for="consent2">
                            I understand that anonymous data that cannot be traced back to me individually may be used in academic publications and shared in accordance with open science guidelines and I consent to this.
                        </label>
                    </div>

                    <div class="form-check mb-2">
                        <input class="form-check-input" type="checkbox" id="consent3" style="transform: scale(1.15); accent-color: #000; border: 1px solid #000; box-shadow: 0 0 0 1px #000 inset;">
                        <label class="form-check-label" for="consent3">
                            I understand that the legal basis for processing any personal information about me is my consent.
                        </label>
                    </div>

                    <div class="form-check mb-2">
                        <input class="form-check-input" type="checkbox" id="consent4" style="transform: scale(1.15); accent-color: #000; border: 1px solid #000; box-shadow: 0 0 0 1px #000 inset;">
                        <label class="form-check-label" for="consent4">
                            I understand that I can withdraw at any time from the study by closing my browser window but that it will be difficult or impossible to withdraw my data once the task has been submitted.
                        </label>
                    </div>

                    <div class="form-check mb-2">
                        <input class="form-check-input" type="checkbox" id="consent5" style="transform: scale(1.15); accent-color: #000; border: 1px solid #000; box-shadow: 0 0 0 1px #000 inset;">
                        <label class="form-check-label" for="consent5">
                            I confirm that I am over 18 years of age.
                        </label>
                    </div>
                </div>

                <!-- Prolific ID Input -->
                <div class="mt-4">
                    <label for="prolificId" class="form-label"><strong>Please enter your Prolific ID:</strong><br>We will not be able to pay your bonus if this field is inaccurate.</label>
                    <input type="text" id="prolificId" class="form-control mt-2" placeholder="Enter your Prolific ID" required>
                </div>

                <button class="btn btn-success mt-3" onclick="submitConsent()">I Consent</button>
            </div>

            `;
            break;

        case "instructions":
            showInstructions(instructionPage); // ✅ Show instruction pages
            return;

        case "tutorial":
            startTutorial(getTutorialStartStage());
            return;

        case "quiz":
            showQuiz(); // ✅ Show quiz after instructions
            return;
    }

    $("#mainContent").html(html);
}

// ✅ Handle consent submission

function submitConsent() {
    // Ensure all checkboxes are checked (skip in test mode)
    if (!testMode &&
        (!$("#consent1").is(":checked") || 
        !$("#consent2").is(":checked") || 
        !$("#consent3").is(":checked") || 
        !$("#consent4").is(":checked") || 
        !$("#consent5").is(":checked"))) {
        alert("Please check all the boxes before continuing.");
        return;
    }else{
    // Ensure Prolific ID is entered
    let prolificId = $("#prolificId").val().trim();
    if (!prolificId) {
        alert("Please enter your Prolific ID.");
        return;
    } else {
        // Emit login event with Prolific ID
        socket.emit("login", prolificId);
    }
    }

}

//  user.username = prolificId; 
//socket.emit("login",prolificId);



// ✅ Display task instructions (multiple screens)
function showInstructions(page) {
    let instructionScreens = [
        { text: "You are not the only farmer collecting apples and cleaning the river, other farmers are playing the game with you. <br>In the next step we will connect you to other players, and you will be able to send them a message before playing the apple harvest game together.<br>The number of apples each player collected will determine their individual bonus.", img: '' }
    ];

    let totalPages = instructionScreens.length;
    let { text, img } = instructionScreens[page - 1];

    let html = `
        <div class="container text-center">
            <h2>Task Instructions</h2>
            <p>${text}</p>
            <img src="${img}" class="img-fluid mb-3" width="300">
            <div class="d-flex justify-content-between">
                <button class="btn btn-secondary" onclick="changeInstruction(-1)" ${page === 1 ? "disabled" : ""}>Back</button>
                <button class="btn btn-primary" onclick="changeInstruction(1)">${page === totalPages ? "Start" : "Next"}</button>
            </div>
        </div>
    `;

    $("#mainContent").html(html);
}

// ✅ Handle Next/Back buttons in instructions
function changeInstruction(direction) {
    instructionPage += direction;
    if (instructionPage > 1) {
        console.log('User' + JSON.stringify(user))

        socket.emit("join_waiting_list", user); // ✅ Join waiting list
        showWaitingScreen(); // ✅ Correct answers → move to waiting room


    } else {
        showInstructions(instructionPage);
    }
}

function startTutorial(stage) {
    inTutorial = true; // ✅ Set tutorial flag
    let position = { x: 3, y: 1 }; // Player starts in the center
    let moves = 0;
    let maxMoves = 3;
    let gridObjects = {}; // Store objects (apple, dirt, etc.)

    // Global flags for tutorial
    window.tutWaterState = { inWater: false, enterTime: null };

    const flags = getTutorialModeFlags();

    // Define tutorial instructions for each stage
    let tutorialStages = [
        {
            text: "In this multiplayer apple harvest game, you play a farmer harvesting apples. <br>You move around a D map using your keyboard arrow keys.<br>Let’s try it – Use the arrow keys to move around the grid.",
            objective: "Move 3 steps."
        },
        {
            text: "Apples grow in the orchard, the green squares on the left of the map. <br>You collect them by moving over them. <br>Let’s try it – move to collect the apple. ",
            objective: "Collect the apple."
        },
        {
            text: "Apples don’t grow if there is too much dirt in the river, the blue squares on the right of the map.<br>To clean the river from dirt, you move over it.<br>Let’s try it – move to clean the dirt from the river.",
            objective: "Clean the dirt."
        },
        {
            text: "Your goal is to collect as many apples as possible, each apple will earn you <b>£" + payApple + "</b> bonus.<br>To get more apples, you need to clean the river first.<br>Let’s try it – move to clean the river, and then collect the apple.",
            objective: "Clean the dirt."
        },
        {
            text: "Your goal is to collect as many apples as possible, each apple will earn you <b>£" + payApple + "</b> bonus.<br>To get more apples, you need to clean the river first.<br>Let’s try it – move to clean the river, and then collect the apple.",
            objective: "Collect the new apple."
        },
    ];

    // ⭐ Insert WATER stage only if mode supports water
    if (flags.water) {
        tutorialStages.push({
            text: "In this game, players who spend time cleaning the river are rewarded with a water drop 💧 above their head.<br>The drop appears when a player has been spending enough time in the river area, and disappears when they stop.<br>You can keep moving while the drop is present.",
            objective: "Enter the river → Exit the river → See the drop"
        });
    }

    // ⭐ Insert STAIN stage only if mode supports stain
    if (flags.stain) {
        tutorialStages.push({
            text: "Players who spend most of their time collecting apples without helping clean will have a stain 🟤 appear above their head.<br>Collect all the apples in the orchard.",
            objective: "Collect all apples → See the stain appear"
        });
    }

    // ⭐ Insert REQUEST HELP stage only if mode supports it
    if (flags.punish) {
        tutorialStages.push({
            text: "In this game, you can communicate with other players.<br> If someone is not cooperative, you can send a request to change their behavior.<br>To experience how this works, click on the dummy player with your mouse.<br>This will send them a message (💥) asking them to contribute more to the cleaning.<br>Afterwards, you will see how it looks when someone sends <b>you</b> a request.<br>",
            objective: "Click dummy to send a request."
        });
    }

    // ⭐ Insert PRAISE stage only if mode supports praise
    if (flags.praise) {
        tutorialStages.push({
            text: "In this game, players can appreciate others by sending them a positive message.<br>To experience how this works, click on the dummy player with your mouse.<br>This will trigger a praise animation (👍) and a message.<br>Afterwards, you will see how it looks when someone praises <b>you</b>.<br>",
            objective: "Click dummy to praise them."
        });
    }

    // ✅ Bounds check: ensure stage is valid
    if (stage < 1 || stage > tutorialStages.length) {
        console.error(`Invalid tutorial stage: ${stage}. Valid range: 1-${tutorialStages.length}`);
        inTutorial = false; // ✅ Clear tutorial flag before leaving
        showScreen('quiz'); // Skip to quiz if invalid stage
        return;
    }

    // Calculate stage indices based on actual array length
    let waterStage = null;
    let stainStage = null;
    let punishStage = null;
    let praiseStage = null;
    if (flags.water) waterStage = tutorialStages.length - (flags.stain ? 1 : 0) - (flags.punish ? 1 : 0) - (flags.praise ? 1 : 0);
    if (flags.stain) stainStage = tutorialStages.length - (flags.punish ? 1 : 0) - (flags.praise ? 1 : 0);
    if (flags.punish) punishStage = tutorialStages.length - (flags.praise ? 1 : 0);
    if (flags.praise) praiseStage = tutorialStages.length;

    // Place objects based on the tutorial stage
    if (stage === 2) gridObjects.apple = { x: 0, y: 2 };
    if (stage === 3) gridObjects.dirt = { x: 6, y: 1 };
    if (stage === 4) gridObjects.dirt = { x: 6, y: 0 }; // Collecting dirt instead of cleaning
    if (stage === 5) {
        position = { x: 6, y: 0 };
        gridObjects.apple = { x: 0, y: 1 }; // Apple appears after cleaning dirt
    }
    if (stage === waterStage) {
        position = { x: 3, y: 1 }; // Start on land for the water test
    }
    if (stage === stainStage) {
        position = { x: 3, y: 1 };
        gridObjects.apples = [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }];
    }
    if (stage === punishStage) {
        position = { x: 2, y: 1 };              // player
        gridObjects.dummy = { x: 4, y: 1 };     // dummy
    }
    if (stage === praiseStage) {
        position = { x: 2, y: 1 };              // player
        gridObjects.dummy = { x: 4, y: 1 };     // dummy
    }

    let html = `
                <div class="tutorial-mode container text-center">
                    <div class="container text-center">
                      <h2>Tutorial - Step ${stage}</h2>
                      <p>${tutorialStages[stage - 1].text}</p>
                      <p><strong>Objective:</strong> ${tutorialStages[stage - 1].objective}</p>

                      <div id="tutorial-area" style="position:relative; display:inline-block;">
                          <div id="tutorialGrid" class="d-inline-block"></div>
                          <div id="centered-message" class="centered-message" style="display:none;"></div>
                          <div id="punishment-popup" class="private-message" style="display:none;"></div>
                      </div>

                      <div id="tutorialMessage" class="mt-3" style="display: none;">
                      <h3>Great job!</h3>
                      <button class="btn btn-success"
                              onclick="${stage < tutorialStages.length ? ("startTutorial(" + (stage + 1) + ")") : "showScreen('quiz')"}">
                          ${stage < tutorialStages.length ? "Next" : "Proceed to Questionnaire"}
                      </button>
                  </div>
              </div>
            </div>
                `;


    $("#mainContent").html(html);

    // Initial grid draw
    drawTutorialGrid(position, gridObjects);

    $(document).off("keydown").on("keydown", (event) => {
        let allowedKeys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
        if (!allowedKeys.includes(event.key)) return;

        // ❗ After drop ended, lock movement
        if (window.tutorialMovementLocked) return;

        let newPosition = { ...position };

        // Boundaries: 7 columns (0..6), 3 rows (0..2)
        if (event.key === "ArrowLeft" && position.x > 0) newPosition.x--;
        if (event.key === "ArrowRight" && position.x < 6) newPosition.x++;
        if (event.key === "ArrowUp" && position.y > 0) newPosition.y--;
        if (event.key === "ArrowDown" && position.y < 2) newPosition.y++;

        if (newPosition.x !== position.x || newPosition.y !== position.y) {
            moves++;
            position = newPosition;
            drawTutorialGrid(position, gridObjects);

            if (stage === 1 && moves >= maxMoves) {
                $("#tutorialMessage").show();
                $(document).off("keydown");

            }

            if (stage === 2 && gridObjects.apple && position.x === gridObjects.apple.x && position.y === gridObjects.apple.y) {
                $("#tutorialMessage").show();
                $(document).off("keydown");

            }

            if (stage === 3 && gridObjects.dirt && position.x === gridObjects.dirt.x && position.y === gridObjects.dirt.y) {
                $("#tutorialMessage").show();
                $(document).off("keydown");

            }

            if (stage === 4 && gridObjects.dirt && position.x === gridObjects.dirt.x && position.y === gridObjects.dirt.y) {
                startTutorial(5);
                //$(document).off("keydown");
                return;
            }

            if (stage === 5 && position.x === gridObjects.apple.x && position.y === gridObjects.apple.y) {
                $("#tutorialMessage").show();
                $(document).off("keydown");

            }

            // === ⭐ STAIN LOGIC ⭐ ===
            let allApplesCollected = false;
            if (flags.stain && stage === stainStage && gridObjects.apples) {
                gridObjects.apples = gridObjects.apples.filter(a => !(a.x === position.x && a.y === position.y));
                if (gridObjects.apples.length === 0) {
                    $(document).off("keydown");
                    allApplesCollected = true;
                }
            }

            // === ⭐ WATER LOGIC ⭐ ===
            if (flags.water && stage === waterStage) {
                const insideRiver = (position.x === 6);        // tutorial river at x=6
                const wasInside = window.tutWaterState.inWater;

                // Enter river
                if (!wasInside && insideRiver) {
                    window.tutWaterState.inWater = true;
                    window.tutWaterState.enterTime = Date.now();
                }

                // Exit river
                if (wasInside && !insideRiver) {
                    const timeInWater = (Date.now() - window.tutWaterState.enterTime) / 1000;
                    const duration = timeInWater * 1.5;

                    // Show tutorial-only drop
                    showTutorialWaterDrop(duration);

                    window.tutWaterState.inWater = false;

                    // Show "Great job!" 2 seconds after the drop appears
                    $(document).off("keydown");
                    setTimeout(() => {
                        $("#tutorialMessage").show();
                    }, 2000);
                }
            }
            if (flags.punish && stage === punishStage) {
                position = { x: 3, y: 1 }; // player start
                gridObjects.dummy = { x: 4, y: 1 }; // NPC next to you
            }
            if (flags.praise && stage === praiseStage) {
                position = { x: 3, y: 1 }; // player start
                gridObjects.dummy = { x: 4, y: 1 }; // NPC next to you
            }

            // Redraw grid after movement (drop will be reattached below)
            drawTutorialGrid(position, gridObjects);

            // Show stain after final grid redraw so it isn't wiped
            if (allApplesCollected) {
                showStain("TUTORIAL_PLAYER", 0.2);
                setTimeout(() => {
                    $("#tutorialMessage").show();
                }, 3000);
            }
        }
    });

    // === Click dummy to punish or praise ===
    $(document).off("click.tut").on("click.tut", "img.player-avatar", function () {

        const isPunishStage = flags.punish && stage === punishStage;
        const isPraiseStage = flags.praise && stage === praiseStage;
        if (!isPunishStage && !isPraiseStage) return;

        let targetId = $(this).data("user-id");
        if (targetId === "TUTORIAL_PLAYER") return;
        if (targetId !== "TUTORIAL_DUMMY") return;

        $(document).off("click.tut");

        if (isPunishStage) {
            // PHASE 1: player punishes dummy
            tutorialPunish("PLAYER", "DUMMY", () => {
                $("#tutorialMessage").html(`
                    <h3>Good job!</h3>
                    <p>Now see what happens when someone sends <b>you</b> a request.</p>
                    <button class="btn btn-warning" id="btnPunishPlayer">Show me</button>
                `).show();

                $("#btnPunishPlayer").on("click", () => {
                    $("#tutorialMessage").hide();
                    // PHASE 2: dummy punishes player
                    tutorialPunish("DUMMY", "PLAYER", () => {
                        $("#tutorialMessage").html(`
                            <h3>Great job!</h3>
                            <button class="btn btn-success" onclick="inTutorial = false; showScreen('quiz')">
                                Proceed to Questionnaire
                            </button>
                        `).show();
                        window.tutorialMovementLocked = true;
                    });
                });
            });
        }

        if (isPraiseStage) {
            // PHASE 1: player praises dummy
            tutorialPraise("PLAYER", "DUMMY", () => {
                $("#tutorialMessage").html(`
                    <h3>Good job!</h3>
                    <p>Now see what happens when someone praises <b>YOU</b>.</p>
                    <button class="btn btn-warning" id="btnPraisePlayer">Show me</button>
                `).show();

                $("#btnPraisePlayer").on("click", () => {
                    $("#tutorialMessage").hide();
                    // PHASE 2: dummy praises player
                    tutorialPraise("DUMMY", "PLAYER", () => {
                        $("#tutorialMessage").html(`
                            <h3>Great job!</h3>
                            <button class="btn btn-success" onclick="inTutorial = false; showScreen('quiz')">
                                Proceed to Questionnaire
                            </button>
                        `).show();
                        window.tutorialMovementLocked = true;
                    });
                });
            });
        }
    });


}


function drawTutorialGrid(playerPos, objects) {
    // Preserve existing drop node (if any) before rebuilding grid
    const existingDrop = document.querySelector('.water-drop[data-user-id="TUTORIAL_PLAYER"]');

    let gridHtml = "<table class='table-bordered mx-auto'>";

    for (let y = 0; y < 3; y++) {
        gridHtml += "<tr>";

        for (let x = 0; x < 7; x++) {
            let cellId = `cell-${x}-${y}`;
            let cellClass = (x <= 1) ? "orchard" : (x === 6) ? "river" : "land"; // Assign class based on column
            let cellContent = "";

            // Player avatar
            if (x === playerPos.x && y === playerPos.y) {
                cellContent = `
                    <div style="position:relative;">
                        <img src="images/player_demo.png"
                             class="img-fluid player-avatar"
                             width="30"
                             data-user-id="TUTORIAL_PLAYER">
                    </div>`;
            }
            // Dummy avatar
            else if (objects.dummy && objects.dummy.x === x && objects.dummy.y === y) {
                cellContent = `
                    <div style="position:relative;">
                        <img src="images/player_demo.png"
                             class="img-fluid player-avatar"
                             width="30"
                             data-user-id="TUTORIAL_DUMMY">
                    </div>`;
            }

            // Apple (single)
            else if (objects.apple && objects.apple.x === x && objects.apple.y === y) {
                cellContent = `<img src="images/star.png" class="img-fluid" width="30">`;
            }
            // Apples (array)
            else if (objects.apples && objects.apples.some(a => a.x === x && a.y === y)) {
                cellContent = `<img src="images/star.png" class="img-fluid" width="30">`;
            }
            // Dirt
            else if (objects.dirt && objects.dirt.x === x && objects.dirt.y === y) {
                cellContent = `<img src="images/ball.png" class="img-fluid" width="30">`;
            }
            // punishment
            else if (objects.dummy && objects.dummy.x === x && objects.dummy.y === y) {
                cellContent = `
                    <div style="position:relative;">
                        <img src="images/player_demo.png"
                             class="img-fluid player-avatar"
                             width="30"
                             data-user-id="TUTORIAL_DUMMY">
                    </div>
                `;
            }


            gridHtml += `<td id="${cellId}" class="${cellClass}">${cellContent}</td>`;
        }

        gridHtml += "</tr>";
    }

    gridHtml += "</table>";

    $("#tutorialGrid").html(gridHtml);

    // Re-attach drop (if exists) to the new avatar DOM node
    if (existingDrop) {
        const avatar = document.querySelector('img.player-avatar[data-user-id="TUTORIAL_PLAYER"]');
        if (avatar) {
            avatar.parentElement.style.position = "relative";
            avatar.parentElement.appendChild(existingDrop);
        }
    }
}


// ✅ Display comprehension quiz
function showQuiz() {
    let html = `
        <div class="container text-center">
            <h2>Comprehension Check</h2>
            <p>Answer the following questions correctly to proceed.</p>

            <div class="mb-3">
                <label>1. What happens if there is too much dirt in the river?</label>
                <select id="q1" class="form-select">
                    <option value="">Select an answer</option>
                    <option value="nothing">Nothing happens</option>
                    <option value="move">Players can't move</option>
                    <option value="apples">Apples growth slows down</option>
                    <option value="score">Your score and bonus increase</option>
                </select>
            </div>

            <div class="mb-3">
                <label>2. What happens when you collect an apple?</label>
                <select id="q2" class="form-select">
                    <option value="">Select an answer</option>
                    <option value="nothing">Nothing happens</option>
                    <option value="score">Your score and bonus increase</option>
                    <option value="lose">You lose points</option>
                    <option value="clean">You clean the river</option>
                </select>
            </div>

            <div class="mb-3">
                <label>3. How will your bonus be determined?</label>
                <select id="q3" class="form-select">
                    <option value="">Select an answer</option>
                    <option value="group_dirt">How much dirt the entire group collected</option>
                    <option value="group_apples">How many apples the entire group collected</option>
                    <option value="own_dirt">How much dirt only you collected</option>
                    <option value="own_apples">How many apples only you collected</option>
                </select>
            </div>

            <button class="btn btn-primary mt-3" onclick="checkQuiz()">Submit Answers</button>
        </div>
    `;

    $("#mainContent").html(html);
}

// ✅ Validate quiz answers
function checkQuiz() {
    let q1 = $("#q1").val();
    let q2 = $("#q2").val();
    let q3 = $("#q3").val();

    if (q1 === "apples" && q2 === "score" && q3 === "own_apples") {
        showScreen("instructions");
    } else {
        alert("Incorrect answers! Review the instructions and try again.");
        showScreen("tutorial");
    }
}



    // ✅ Show waiting screen
    function showWaitingScreen() {
        console.log('step 3 success')

        let timeLeft = timeOut*60;
        $("#mainContent").html(`
            <h2>Waiting for players...</h2>
            <p class="text-muted">You will be assigned to a room once enough players join.<br>If not enough players are available within `+timeOut+` minutes, you will be redirected to the end screen with a link back to prolific to submit your task.</p>
        <h3>Time left: <span id="waitingTimer">${formatTime(timeLeft)}</span></h3>
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
        `);

    // Start countdown timer
    waitingTimeout = setInterval(() => {
        timeLeft--;
        $("#waitingTimer").text(formatTime(timeLeft));

        if (timeLeft <= 0) {
            clearInterval(waitingTimeout);
            alert("No players joined within the allocated time. Redirecting...");
            console.log('user time out :' + user.id)
            socket.emit("user_timeout", { userId: user.id });
            timeOutScreen();
        }
    }, 1000);


    // Store countdown ID so we can stop it if needed
    //waitingTimeout = countdown;
}

function formatTime(seconds) {
    let minutes = Math.floor(seconds / 60);
    let secs = seconds % 60;
    return `${minutes}:${secs < 10 ? "0" : ""}${secs}`;
}

// Final screen
function timeOutScreen() {
    clearTimeout(waitingTimeout); // ✅ Cancel timeout if room is assigned

    console.log('time out!')

    const prolificLink = "https://app.prolific.com/submissions/complete?cc=C1MSGBYV"; // ✅ Replace with your Prolific link

    $("#mainContent").html(`
            <div class="container text-center">
                <h2>We are sorry, but  not enough users joined the task on time.</h2>
                <h2>Please return to Prolific to submit the study. We will approve your submission.</h2>
                <a href="${prolificLink}" class="btn btn-primary mt-3">Return to Prolific</a>
            </div>
        `);
}

const punishmentMessages = [
    { id: "PUN-01", text: "Step up your game" },
    { id: "PUN-02", text: "Your effort is needed" },
    { id: "PUN-03", text: "Need your help here" }
];

function punishPlayer(targetId) {
    const punishEntry = punishmentMessages[Math.floor(Math.random() * punishmentMessages.length)];
    console.log("👊 Punishing player:", targetId, "message:", punishEntry.id, punishEntry.text);
    socket.emit("punish_player", {
        punisherId: user.id,
        punishedId: targetId,
        roomId: roomId,
        punishMessage: punishEntry.text,
        messageId: punishEntry.id
    });
}

const praiseMessages = [
    { id: "PRA-01", text: "You are doing a great job" },
    { id: "PRA-02", text: "Great work" },
    { id: "PRA-03", text: "Appreciate your effort" }
];

function praisePlayer(targetId) {
    const praiseEntry = praiseMessages[Math.floor(Math.random() * praiseMessages.length)];
    console.log("Praising player:", targetId, "message:", praiseEntry.id, praiseEntry.text);
    socket.emit("praise_player", {
        praiserId: user.id,
        praisedId: targetId,
        roomId: roomId,
        praiseMessage: praiseEntry.text,
        messageId: praiseEntry.id
    });
}

function tutorialPraise(sourceId, targetId, callback) {
    const realTarget = (targetId === "PLAYER" ? "TUTORIAL_PLAYER" : "TUTORIAL_DUMMY");

    const avatarPlayerHTML = `<img src="images/player_demo.png" width="25" style="vertical-align:middle;">`;
    const avatarDummyHTML  = `<img src="images/player_demo.png" width="25" style="vertical-align:middle; filter: grayscale(100%) brightness(70%);">`;

    const sourceAvatarHTML = (sourceId === "PLAYER" ? avatarPlayerHTML : avatarDummyHTML);
    const targetAvatarHTML = (targetId === "PLAYER" ? avatarPlayerHTML : avatarDummyHTML);

    const targetElem = document.querySelector(`img.player-avatar[data-user-id="${realTarget}"]`);
    if (!targetElem) {
        console.error("tutorialPraise: could not find target avatar:", realTarget);
        return;
    }

    const wrapper = targetElem.parentElement;
    wrapper.style.position = "relative";

    const praiseEffect = document.createElement("div");
    praiseEffect.className = "praise-effect";
    praiseEffect.textContent = "👍";
    praiseEffect.style.position = "absolute";
    praiseEffect.style.top = "-20px";
    praiseEffect.style.left = "50%";
    praiseEffect.style.transform = "translateX(-50%)";
    praiseEffect.style.fontSize = "28px";
    wrapper.appendChild(praiseEffect);

    const tutorialPraiseEntry = praiseMessages[Math.floor(Math.random() * praiseMessages.length)];

    $("#centered-message")
        .html(`${sourceAvatarHTML} is praising ${targetAvatarHTML}: '${tutorialPraiseEntry.text}'`)
        .fadeIn();

    if (targetId === "PLAYER") {
        $("#punishment-popup")
            .addClass("praise-popup")
            .html(`${sourceAvatarHTML} is praising you: '${tutorialPraiseEntry.text}'`)
            .fadeIn();
    }

    setTimeout(() => {
        praiseEffect.remove();
        $("#centered-message").stop(true, true).hide().empty();
        $("#punishment-popup").stop(true, true).hide().empty().removeClass("praise-popup");
        if (callback) callback();
    }, 3000);
}

$(document).ready(() => {
    
    if ($("#global-block-message").length === 0) {
        $("body").append(`
            <div id="global-block-message" style="display: none;"></div>
        `);
    }
    if ($("#room-message").length === 0) {
        $("body").prepend(`
            <div id="room-message" style="
                display: none;
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: #fff8dc;
                border: 2px solid orange;
                border-radius: 8px;
                padding: 10px 20px;
                font-size: 18px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                z-index: 9999;
            "></div>
        `);
    }
    if (testMode && skipConsent) {
        socket.emit("login", "TEST_" + Math.random().toString(36).substr(2, 9));
    } else {
        showScreen(testMode ? "consent" : "welcome"); // Show consent directly in test mode
    }

    socket.on("login_success", (data) => {
        console.log('step 1 successful')
        user = data;
        console.log('login data' + JSON.stringify(user))

        if (testMode && (jumpSurvey || jumpSias)) {
            const targetSize = Math.max(2, parseInt(groupSize, 10) || 2);
            const testRoomId = `t_${Math.random().toString(36).substr(2, 4)}`;
            const tempUsers = { [user.id]: user };
            for (let i = 0; i < targetSize - 1; i++) {
                const dummyId = `dummy_${i}_${Math.random().toString(36).substr(2, 6)}`;
                tempUsers[dummyId] = {
                    id: dummyId,
                    username: `DUMMY_${i + 1}`,
                    avatar: `images/player_${(i % 6) + 1}.png`,
                    position: { x: 0, y: 0 }
                };
            }
            users = tempUsers;
            roomId = testRoomId;
            user.roomId = testRoomId;
            socket.emit("test_setup", { userId: user.id, roomId: testRoomId, groupSize: targetSize });
            gameFrozen = true;
            currentPostGameStep = jumpSias ? postGameSteps.indexOf("sias") : 0;
            processPostGameStep();
            return;
        }

        if (testMode && skipTutorial) {
            console.log('🧪 Test mode: skipping tutorial, going to waiting room...');
            socket.emit("join_waiting_list", user);
            showWaitingScreen();
        } else {
            showScreen("tutorial"); // ✅ Move to instructions
        }
    });



    socket.on("room_assigned", (roomData) => {
        clearTimeout(waitingTimeout); // ✅ Cancel timeout if room is assigned

        roomId = roomData.roomId;
        users = {}; // ✅ Store user data

        roomData.users.forEach(user => {
            users[user.id] = user; // ✅ Store user info (id, avatar, etc.)
        });

        // ✅ Emit join_room to the server
        socket.emit("join_room", { userId: user.id, roomId });

        // ✅ Show the chat screen before starting the game
        showChatScreen(roomData);
    });

    socket.on("room_joined", (data) => {
        console.log(`You have joined room ${data.roomId}`);

    });


    socket.on("update_room_users", (roomUsers) => {
        $("#chatWindow").append(`<p class="text-muted">Users in the room:</p>`);
        roomUsers.forEach(user => {
            $("#chatWindow").append(`
                <div class="d-flex align-items-center mb-2">
                    <img src="${user.avatar}" width="40" class="rounded me-2">
                    
                </div>
            `);
        });
    });

    function showChatScreen(roomData) {
        alert("All players joined the room - you can start the task!");

        let currentUser = roomData.users.find(u => u.id === user.id);
        if (currentUser) user.avatar = currentUser.avatar;

        let userHtml = `
            <div class="text-center mb-3">
                <h2>All players are ready!</h2>
                <p>You play the apple harvest game with other players, who can also clean the river and collect apples.<br>Each player is represented by an avatar with different color.</p>
                <p>This is your avatar:</p>
                <img src="${user.avatar}" class="img-fluid" width="50">
                <p>You can chat freely. The game starts in <span id="countdown">${chatCountdownSeconds}</span> seconds.</p>
            </div>
        `;

        let chatHtml = `
            <div id="chatWindow" class="border p-3 mb-3" style="height: 200px; overflow-y: auto;">
                <p><i>Waiting for messages...</i></p>
            </div>
    
            <div class="input-group">
                <input type="text" id="chatMessage" class="form-control" placeholder="Type your message..." required>
                <button id="sendMessage" class="btn btn-primary">Send</button>
            </div>
        `;

        $("#mainContent").html(`
            <div class="container">
                ${userHtml}
                ${chatHtml}
            </div>
        `);


        $("#sendMessage").click(() => {
            let message = $("#chatMessage").val().trim();
            if (message) {
                socket.emit("send_chat_message", { userId: user.id, roomId, message });
                //$("#sendMessage").prop("disabled", true);
                $("#chatMessage").val(""); // clear input after send //prop("disabled", true);
            } else {
                alert("Please enter a message before sending.");
            }
        });

        // === Allow sending chat message by pressing Enter ===
        $("#chatMessage").on("keypress", function (e) {
            if (e.which === 13) { // Enter key
                e.preventDefault(); // prevent line break
                $("#sendMessage").click(); // reuse the same click logic
            }
        });

        let count = chatCountdownSeconds;
        let countdown = setInterval(() => {
            count--;
            $("#countdown").text(count);
            if (count <= 0) {
                clearInterval(countdown);
                const roomUsers = Object.values(users);
                if (roomUsers.length > 0 && roomUsers[0].id === user.id) {
                    socket.emit("start_grid_game", { roomId });
                }
            }
        }, 1000);


    }

    socket.on("receive_chat_message", (messages) => {
        console.log('recieved message')
        $("#chatWindow").html(""); // ✅ Clear old messages

        messages.forEach(msg => {
            const safeMessage = escapeHtml(msg.message);
            $("#chatWindow").append(`
                <div class="d-flex align-items-center mb-2">
                    <img src="${msg.avatar}" width="40" class="rounded me-2">
                     <span>${safeMessage}</span>
                </div>
            `);
        });
        // ✅ Scroll to bottom after rendering
        const chatBox = document.getElementById("chatWindow");
        chatBox.scrollTop = chatBox.scrollHeight;
    });

    socket.on("all_messages_received", () => {
        console.log('recieved all message')
        let count = chatCountdownSeconds;
        $("#chatWindow").append(`
            <p class="text-center mt-3"><strong>All users have sent a message. We are about to start the task.</strong></p>
            <h3 class="text-center" id="countdown">${count}</h3>
        `);

        let roomUsers = Object.values(users);

        let countdown = setInterval(() => {
            count--;
            $("#countdown").text(count);

            if (count === 0) {
                clearInterval(countdown);
                if (roomUsers.length > 0 && roomUsers[0].id === user.id) {
                    console.log(`User ${user.id} is triggering start_grid_game`);
                    socket.emit("start_grid_game", { roomId });
                }
            }
        }, 1000);
    });

    socket.on("start_grid_game", (data) => {
        console.log(`Game starting for room ${data.roomId}`);

        // ✅ Ensure user list is available
        if (data.users) {
            users = {}; // Reset user list
            data.users.forEach(user => {
                users[user.id] = user;
            });
        }

        // ✅ Switch to grid game screen
        showRoomScreen({ roomId: data.roomId, users: Object.values(users) });
    });


    socket.on("user_left", (data) => {
        let { username } = data;
        console.log('user_left_noted' + username)
        $("#users li").each(function () {
            if ($(this).text().trim() === username) {
                $(this).css("color", "red").text(`${username} (left the room)`);
            }
        });
    });


    // ✅ Render the room with avatars
    function showRoomScreen(roomData) {
        // ✅ Find the correct user from roomData and assign their avatar
        let currentUser = roomData.users.find(u => u.id === user.id);
        if (currentUser) {
            user.avatar = currentUser.avatar; // ✅ Set the avatar dynamically
        }

        let userHtml = `
            <div class="text-center mb-3">
                <h2>${user.username}</h2>
                <img src="${user.avatar}" class="img-fluid" width="80">
            </div>
        `;

        let otherUsersHtml = roomData.users.filter(u => u.id !== user.id).map(u => `
            <div class="col text-center">
                <img src="${u.avatar}" class="img-fluid" width="40">
                <p class="small">${u.username}</p>
            </div>
        `).join("");

        
        let gridHtml = `
          <div id="game-area" style="position: relative; display: inline-block;">
            <div id="grid" class="game-grid">`;

        for (let y = 0; y < 10; y++) {
            for (let x = 0; x < 15; x++) {
                let cellClass = x <= 2 ? "orchard" : x >= 12 ? "river" : "land";
                gridHtml += `<div id="cell-${x}-${y}" class="grid-cell ${cellClass}" data-x="${x}" data-y="${y}"></div>`;
            }
        }

        gridHtml += `
            </div>

            <!-- Public punishment message -->
            <div id="centered-message" class="centered-message" style="display:none;"></div>

            <!-- Private message -->
            <div id="punishment-popup" style="display:none;"></div>
          </div>
        `;
        
        $("#mainContent").html(`
            <div class="container">
            <div class="row justify-content-center"><h2>Apple Harvest Game</h2></div>
                ${gridHtml}
                <div class="d-flex justify-content-between mt-3">
                <h3>
                <img src="${user.avatar}" class="img-fluid" width="50"></h3>
                    <h3>Apples: <span id="starScore">0</span></h3>
                    <h3>Dirt: <span id="ballScore">0</span></h3>
                    <h3>Time left: <span id="timer">000</span> sec</h3>
                </div>
            </div>
        `);

        // Draw each user once, with consistent attributes
        roomData.users.forEach(u => {
            const { x, y } = u.position;
            const $cell = $(`#cell-${x}-${y}`);

            // Always include class and data-* so cleanup/update code can find it
            $cell.append(`
      <img src="${u.avatar}"
           class="img-fluid player-avatar"
           width="30"
           data-user-id="${u.id}"
           data-username="${u.username}">
    `);
        });
        let canMove = true; // ✅ Prevents continuous movement

        $(document).keydown((event) => {
            if (gameFrozen) return;

            let allowedKeys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
            if (allowedKeys.includes(event.key) && canMove) {
                canMove = false; // ✅ Block further movement until key is released
                socket.emit("move", { userId: user.id, direction: event.key });
            }
        });

        $(document).keyup(() => {
            canMove = true; // ✅ Allow movement again when key is released
        });

    }

    socket.on("update_positions", (roomUsers) => {
        // 🧹 Remove only player avatars — keep apples, dirt, and drops
        $("#grid .grid-cell img.player-avatar").remove();

        // 🔁 For each user, re-render avatar and handle water logic
        roomUsers.forEach(u => {
            const id = u.id;
            const nowInWater = isWaterTile(u.position.x, u.position.y);
            const state = playerStates[id] || { inWater: false, dropActive: false };
            const $cell = $(`#cell-${u.position.x}-${u.position.y}`);

            // 🎨 Draw avatar
            $cell.append(`
              <img src="${u.avatar}" 
                   class="img-fluid player-avatar" 
                   width="30"
                   data-user-id="${u.id}" 
                   data-username="${u.username}">
            `);

            //enable water logic
            if (window.flags?.waterCue) {
                // 💧 Track water entry/exit for DB logging
                if (!state.inWater && nowInWater) {
                    state.inWater = true;
                    state.enterTime = Date.now();
                }
                else if (state.inWater && !nowInWater) {
                    const timeInWater = (Date.now() - state.enterTime) / 1000;
                    if (id === user.id) {
                        socket.emit("water_event", {
                            userId: user.id,
                            roomId: roomId,
                            timeInWater: timeInWater,
                            dropDuration: timeInWater / 2
                        });
                    }
                    state.inWater = false;
                    state.enterTime = null;
                }
            }//water logic

            // 🔁 Re-attach coop-drop if visible (coop_update drives show/hide)
            const coopDrop = document.querySelector(`.coop-drop[data-user-id="${id}"]`);
            if (coopDrop) {
                const avatar = document.querySelector(`img.player-avatar[data-user-id="${id}"]`);
                if (avatar && avatar.parentElement !== coopDrop.parentElement) {
                    avatar.parentElement.style.position = "relative";
                    avatar.parentElement.appendChild(coopDrop);
                }
            }

            // 🔁 Re-attach stain if visible
            const stain = document.querySelector(`.coop-stain[data-user-id="${id}"]`);
            if (stain) {
                const avatar = document.querySelector(`img.player-avatar[data-user-id="${id}"]`);
                if (avatar && avatar.parentElement !== stain.parentElement) {
                    avatar.parentElement.style.position = "relative";
                    avatar.parentElement.appendChild(stain);
                }
            }

            playerStates[id] = state;
        });//for each
    });

    // ✅ Handle timer updates
    socket.on("update_timer", (timeLeft) => {
        $("#timer").text(timeLeft);
    });

    socket.on("update_stars", (stars) => {
        $("#grid .grid-cell img[src*='star.png']").remove();
        stars.forEach(star => {
            $(`#cell-${star.x}-${star.y}`).append(`<img src="images/star.png" class="img-fluid" width="30">`);
        });
    });


    // === Update dirt / balls ===
    socket.on("update_balls", (balls) => {
        // 🧹 Remove all existing ball images
        $("#grid .grid-cell img[src*='ball.png']").remove();

        // 🎯 Draw each new ball position
        balls.forEach(ball => {
            $(`#cell-${ball.x}-${ball.y}`).append(`
      <img src="images/ball.png" class="img-fluid" width="30">
    `);
        });
    });



    // === Coop indicator handler ===
    socket.on("coop_update", ({ userId, coopValue }) => {
        if (window.flags?.waterCue) {
            if (coopValue > 0.7) {
                const wasAbsent = !document.querySelector(`.coop-drop[data-user-id="${userId}"]`);
                showCoopDrop(userId);
                if (wasAbsent) console.log(`[Coop] Drop appeared for player ${userId} — coop = ${coopValue.toFixed(3)}`);
            } else {
                hideCoopDrop(userId);
            }
        }
        if (window.flags?.stainCue) {
            if (coopValue < 0.3) {
                showStain(userId, coopValue);
            } else {
                hideStain(userId);
            }
        }
    });
    // === End Coop indicator handler ===

    //update score
    socket.on("update_scores", (scores) => {
        console.log('Update Scores')
        scores.forEach(scoreData => {
            if (scoreData.username === user.username) {
                // Update DOM
                $("#starScore").text(scoreData.star_score); // ✅ Update UI
                $("#ballScore").text(scoreData.ball_score); // ✅ Update UI
                // Update user object to keep scores in sync
                user.star_score = scoreData.star_score;
                user.ball_score = scoreData.ball_score;
            }
        });
    });

    // === Punishment Effect Handler ===

    socket.on("punishment_notice", ({ punisherId, punishedId, punishMessage, roomUsers }) => {
        gameFrozen = true;

        const punisher = users[punisherId];
        const punished = users[punishedId];
        if (!punished) return;

        const { x, y } = punished.position;
        const $cell = $(`#cell-${x}-${y}`);

        $cell.append(`<div class="punishment-effect">💥</div>`);

        const punisherAvatar = `<img src="${punisher.avatar}" width="30" class="inline-avatar">`;
        const punishedAvatar = `<img src="${punished.avatar}" width="30" class="inline-avatar">`;

        $("#centered-message").html(`${punisherAvatar} is asking ${punishedAvatar} to help clean: '${punishMessage}'`).fadeIn();

        if (user.id === punishedId) {
            $("#punishment-popup").html(`${punisherAvatar} is asking you to help clean: '${punishMessage}'`).fadeIn();
        }

        // ✅ After 3 seconds: cleanup and re-render
        setTimeout(() => {
            $(".punishment-effect").remove();
            // PUBLIC message — kill instantly, no fade
            $("#centered-message")
                .stop(true, true)      // stop ongoing animation
                .hide()                // hide immediately
                .empty();              // clear content

            // PRIVATE message — kill instantly, no fade
            $("#punishment-popup")
                .stop(true, true)
                .hide()
                .empty();



            // Re-render avatars using in-memory `roomUsers`
            roomUsers.forEach(u => {
                const pos = u.position;
                const $cell = $(`#cell-${pos.x}-${pos.y}`);
                $cell.html(`<img src="${u.avatar}" class="img-fluid player-avatar" width="30" data-user-id="${u.id}">`);
            });

            gameFrozen = false;
        }, 3000);
    });


    // === Praise Effect Handler ===
    socket.on("praise_notice", ({ praiserId, praisedId, praiseMessage, roomUsers }) => {
        gameFrozen = true;

        const praiser = users[praiserId];
        const praised = users[praisedId];
        if (!praised) return;

        const { x, y } = praised.position;
        const $cell = $(`#cell-${x}-${y}`);

        $cell.append(`<div class="praise-effect">👍</div>`);

        const praiserAvatar = `<img src="${praiser.avatar}" width="30" class="inline-avatar">`;
        const praisedAvatar = `<img src="${praised.avatar}" width="30" class="inline-avatar">`;

        $("#centered-message").html(`${praiserAvatar} is praising ${praisedAvatar}: '${praiseMessage}'`).fadeIn();

        if (user.id === praisedId) {
            $("#punishment-popup").addClass("praise-popup").html(`${praiserAvatar} is praising you: '${praiseMessage}'`).fadeIn();
        }

        setTimeout(() => {
            $(".praise-effect").remove();
            $("#centered-message").stop(true, true).hide().empty();
            $("#punishment-popup").stop(true, true).hide().empty().removeClass("praise-popup");

            roomUsers.forEach(u => {
                const pos = u.position;
                const $cell = $(`#cell-${pos.x}-${pos.y}`);
                $cell.html(`<img src="${u.avatar}" class="img-fluid player-avatar" width="30" data-user-id="${u.id}">`);
            });

            gameFrozen = false;
        }, 3000);
    });
// Final screen
   socket.on("experiment_ended", (data) => {
    console.log('date: ' + data)
    console.log('star pay:'+JSON.stringify({data}))
    console.log('star pay:'+data.starPay)
    const prolificLink = "https://app.prolific.com/submissions/complete?cc=CTTGOUEO"; // ✅ Replace with your Prolific link
    const starPay = payApple; // ✅ Define how much each apple (star) is worth in GBP

        const starScore = data.starScore || 0; // ✅ Total apples collected
        const bonusAmount = (starScore * starPay).toFixed(2); // ✅ Calculate bonus amount



        $("#mainContent").html(`
        <div class="container text-center">
            <h2>Thank you for participating!</h2>
            <p>Your responses have been recorded.</p>
            <h3>You collected <b>${starScore} apples</b> 🍏</h3>
            <h4>Your bonus amount: <b>£${bonusAmount}</b> 💰</h4>
            <p>Please return to Prolific to complete the study.</p>
            <a href="${prolificLink}" class="btn btn-primary mt-3">Return to Prolific</a>
        </div>
    `);

        socket.emit("end_experiment", { userId: data.userId });
    });


    $(document).on("click", ".player-avatar", function () {
        if (inTutorial) return;
        if (!window.flags?.punishments && !window.flags?.praise) return;
        if (gameFrozen) return;

        const targetId = $(this).attr("data-user-id");
        if (!targetId || targetId === user.id) return;

        if (window.flags?.punishments) {
            punishPlayer(targetId);
        } else if (window.flags?.praise) {
            praisePlayer(targetId);
        }
    });

    // === POST-GAME FLOW MANAGER ===
    // Define the sequence of screens
    const postGameSteps = [
        "survey_apples",
        "survey_dirt",
        "survey_coop",
        "survey_selfish",
        "survey_team",
        "sias",
        "demographics"
    ];
    let currentPostGameStep = 0;

    // Configuration for each survey screen
    const surveyConfigs = {
        survey_apples: {
            metric: "apples",
            targetType: "individual", // Slider per player
            question: "How many <b>apples</b> do you think each participant collected?",
            icon: "🍏",
            min: 0, max: 300,
            labels: ["0", "300"]
        },
        survey_dirt: {
            metric: "dirt",
            targetType: "individual",
            question: "How many <b>dirt piles</b> do you think each participant cleaned?",
            icon: "💩", //  dirt
            min: 0, max: 300,
            labels: ["0", "300"]
        },
        survey_coop: {
            metric: "cooperation",
            targetType: "individual",
            question: "How <b>cooperative</b> do you think each player was?",
            icon: "🤝",
            min: 0, max: 100,
            labels: ["Not at all", "Slightly", "Moderately", "Very", "Extremely"]
        },
        survey_selfish: {
            metric: "selfishness",
            targetType: "individual",
            question: "How <b>selfish</b> do you think each player was?",
            icon: "🛑", // Stop sign or similar for selfishness
            min: 0, max: 100,
            labels: ["Not at all", "Slightly", "Moderately", "Very", "Extremely"]
        },
        survey_team: {
            metric: "teamwork",
            targetType: "group", // Single slider for the whole team
            question: "How well do you think you worked as a <b>team</b>?",
            icon: "🙌",
            min: 0, max: 100,
            labels: ["Not at all", "Slightly", "Moderately", "Very", "Extremely"]
        }
    };

    socket.on("time_up", () => {
        gameFrozen = true; // Stop movement
        currentPostGameStep = 0;
        processPostGameStep();
    });

    function processPostGameStep() {
        const stepKey = postGameSteps[currentPostGameStep];

        if (stepKey === "demographics") {
            showDemographicsScreen();
        } else if (stepKey === "sias") {
            showSiasScreen();
        } else if (surveyConfigs[stepKey]) {
            showSurveyScreen(surveyConfigs[stepKey]);
        } else {
            console.log("Post-game flow complete or unknown step.");
        }
    }

    // ✅ Signal from server that data was saved, move to next step
    socket.on("survey_saved_success", () => {
        currentPostGameStep++;
        processPostGameStep();
    });


    // ✅ UNIVERSAL SURVEY SCREEN GENERATOR
    function showSurveyScreen(config) {
        // Get current user's score for context (only relevant for apples/dirt)
        let myScoreHtml = "";
        if (config.metric === "apples") {
            const score = user.star_score || 0;
            myScoreHtml = `<h4 class="mb-4">You collected: <b>${score}</b> ${config.icon}</h4>`;
        } else if (config.metric === "dirt") {
            // Use ball_score from user object (which tracks dirt cleaned)
            const score = user.ball_score || 0;
            myScoreHtml = `<h4 class="mb-4">You cleaned: <b>${score}</b> ${config.icon}</h4>`;
        }

        let slidersHtml = "";

        // CASE A: Individual Sliders (Partners)
        if (config.targetType === "individual") {
            const partners = Object.values(users).filter(u => u.id !== user.id);
            if (partners.length === 0) {
                slidersHtml = "<p>No other participants were in the room.</p>";
            } else {
                partners.forEach(p => {
                    slidersHtml += `
                        <div class="card p-3 mb-3 text-start">
                            <label class="form-label d-flex align-items-center">
                                <img src="${p.avatar}" width="40" class="me-3 rounded"> 
                            </label>
                            ${generateSliderHtml(p.id, config)}
                        </div>
                    `;
                });
            }
        }
        // CASE B: Group Slider (Teamwork)
        else if (config.targetType === "group") {
            slidersHtml += `
                <div class="card p-4 mb-3 text-start">
                    <label class="form-label d-flex align-items-center justify-content-center mb-3">
                        <span style="font-size: 2rem;">${config.icon}</span> 
                        <strong class="ms-2">The Entire Group</strong>
                    </label>
                    ${generateSliderHtml("group", config)}
                </div>
            `;
        }

        $("#mainContent").html(`
            <div class="container text-center" style="max-width: 700px;">
                <h2 class="mb-3">Time's Up!</h2>
                ${myScoreHtml}
                <p class="lead">${config.question}</p>
                
                <style>
                    .survey-slider { width: 100%; height: 12px; }
                    .survey-slider::-webkit-slider-runnable-track { height: 8px; background: #f1f3f5; border-radius: 6px; }
                    .survey-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 18px; height: 18px; border-radius: 50%; background: #0d6efd; margin-top: -5px; box-shadow: 0 1px 3px rgba(0,0,0,0.25); }
                    .survey-slider::-moz-range-track { height: 8px; background: #f1f3f5; border-radius: 6px; }
                    .survey-slider::-moz-range-thumb { width: 18px; height: 18px; border-radius: 50%; background: #0d6efd; border: none; }
                    .survey-slider:focus { outline: none; }
                </style>

                <form id="surveyForm">
                    ${slidersHtml}
                    <div class="text-center">
                        <button type="submit" class="btn btn-success mt-3">Submit</button>
                    </div>
                </form>
            </div>
        `);

               // ✅ Bind slider input listeners (initialize and update track + tooltip)
        $(".survey-slider").each(function () {
            const targetId = $(this).attr("data-target-id");
            const min = parseFloat($(this).attr('min')) || 0;
            const max = parseFloat($(this).attr('max')) || 100;
            const showValue = ($(this).data('show-value') === true || $(this).data('show-value') === 'true');

            // Initialize each slider at its minimum value
            $(this).val(min);

            // Keep the badge empty (we show values in the tooltip for numeric sliders)
            $("#val-" + targetId).text('');
            updateSliderTrack(this);
        }).on("input", function () {
            const targetId = $(this).attr("data-target-id");
            const min = parseFloat($(this).attr('min')) || 0;
            const step = parseFloat($(this).attr('step')) || 1;
            const rawValue = parseFloat($(this).val());
            const snappedValue = Math.round((rawValue - min) / step) * step + min;
            $(this).val(snappedValue);
            const showValue = ($(this).data('show-value') === true || $(this).data('show-value') === 'true');
            if (showValue) {
                const tooltip = $(this).closest('.position-relative').find('.slider-tooltip');
                if (tooltip.length) tooltip.text(snappedValue);
            }
            $("#val-" + targetId).text('');
            updateSliderTrack(this);
        });

        // Handle Form Submission
        $("#surveyForm").submit(function (e) {
            e.preventDefault();

            const responses = [];
            $(".survey-slider").each(function () {
                responses.push({
                    targetId: $(this).attr("data-target-id"),
                    value: parseInt($(this).val())
                });
            });

            // Send batch to server
            socket.emit("submit_survey_batch", {
                userId: user.id,
                roomId: roomId,
                metric: config.metric,
                responses: responses
            });

            $("#surveyForm button").prop("disabled", true).text("Saving...");
        });
    }

    // Helper to generate the slider HTML with dynamic labels
    function generateSliderHtml(targetId, config) {
        // Show only the value badge above the slider.
        // Place labels (words or numeric) below the slider as left/right captions.
        const isNumericLabel = (s) => /^\s*\d+\s*$/.test(String(s));
        // Start sliders at their minimum value and only show numeric tooltip for numeric-label sliders
        const currentValue = parseInt(config.min, 10) || 0;
        const showValue = isNumericLabel(config.labels[0]);

        const scaleLabels = Array.isArray(config.labels) ? config.labels : [];
        const isWordScale = !isNumericLabel(scaleLabels[0]);
        const step = isWordScale && scaleLabels.length > 1
            ? (config.max - config.min) / (scaleLabels.length - 1)
            : 1;
        // For numeric labels (apples/dirt) we show numbers below; for word labels show words below.
        const bottomLeft = isNumericLabel(scaleLabels[0]) ? config.min : scaleLabels[0];
        const lastLabel = scaleLabels[scaleLabels.length - 1];
        const bottomRight = isNumericLabel(lastLabel) ? config.max : lastLabel;

        return `
            <div class="mb-4">
                               <div class="text-center mb-3">
                    <span id="val-${targetId}" class="badge bg-primary fs-6 survey-badge">${showValue ? currentValue : ''}</span>
                </div>

                      <div class="position-relative">
                      <div class="slider-tooltip" id="tooltip-${targetId}" style="pointer-events: none; -webkit-user-select: none; user-select: none;">${showValue ? currentValue : ''}</div>
                      <input type="range"
                           class="form-range survey-slider" 
                           data-target-id="${targetId}" 
                           data-show-value="${showValue}"
                           min="${config.min}" 
                           max="${config.max}" 
                           value="${currentValue}"
                           step="${step}"
                           style="width: 100%; -webkit-appearance: slider-horizontal; appearance: slider-horizontal; background: #e9ecef;">
                    ${isWordScale && scaleLabels.length > 2 ? `
                    <div class="d-flex justify-content-between px-1 mt-1">
                        ${scaleLabels.map(label => `<small class="text-muted">${label}</small>`).join("")}
                    </div>
                    ` : `
                    <div class="d-flex justify-content-between px-2 mt-1">
                        <small class="text-muted">${bottomLeft}</small>
                        <small class="text-muted">${bottomRight}</small>
                    </div>
                    `}
                </div>
            </div>
        `;
    }

    // Helper function to update slider value display
    function updateSliderValue(elementId, value) {
        document.getElementById(elementId).textContent = value;
    }

    // Draw slider track fill so the line is visible and shows progress (and position tooltip)
    function updateSliderTrack(sliderEl) {
        try {
            const min = parseFloat(sliderEl.getAttribute('min')) || 0;
            const max = parseFloat(sliderEl.getAttribute('max')) || 100;
            const val = parseFloat(sliderEl.value) || 0;
            const pct = ((val - min) / (max - min)) * 100;
            // Keep a neutral track color; do not draw a filled blue portion behind the thumb
            sliderEl.style.background = '#e9ecef';

            // Position tooltip (if present) above the thumb
            const container = sliderEl.closest('.position-relative');
            if (container) {
                const tooltip = container.querySelector('.slider-tooltip');
                const show = sliderEl.getAttribute('data-show-value');
                if (tooltip) {
                    // place tooltip centered at pct% within the container
                    tooltip.style.left = pct + '%';
                    tooltip.style.transform = 'translateX(-50%)';
                    if (show === 'true') { 
                        tooltip.textContent = String(Math.round(val)); 
                        tooltip.style.display = 'inline-block'; 
                    } else { tooltip.style.display = 'none'; }
                }
            }
        } catch (e) {
            // ignore errors silently
        }
    }

    // === SIAS Screen ===
    function showSiasScreen() {
        const siasItems = [
            "I get nervous if I have to speak with someone in authority (teacher, boss, etc.)",
            "I have difficulty making eye-contact with others",
            "I become tense if I have to talk about myself or my feelings",
            "I find difficulty mixing comfortably with the people I work with",
            "I tense-up if I meet an acquaintance in the street",
            "When mixing socially I am uncomfortable",
            "I feel tense if I am alone with just one other person",
            "I am at ease meeting people at parties, etc.",
            "I have difficulty talking with other people",
            "I find it easy to think of things to talk about.",
            "I worry about expressing myself in case I appear awkward",
            "I find it difficult to disagree with another's point of view",
            "I have difficulty talking to attractive persons of the opposite sex",
            "I find myself worrying that I won't know what to say in social situations",
            "I am nervous mixing with people I don't know well",
            "I feel I'll say something embarrassing when talking",
            "When mixing in a group I find myself worrying I will be ignored",
            "I am tense mixing in a group",
            "I am unsure whether to greet someone I know only slightly"
        ];

        const labels = ["Not at all", "Slightly", "Moderately", "Very", "Extremely"];

        let rowsHtml = siasItems.map((text, i) => {
            const itemNum = i + 1;
            const radios = [0, 1, 2, 3, 4].map(val => `
                <td class="text-center" style="min-width:70px;">
                    <input type="radio" name="sias_${itemNum}" value="${val}" required>
                </td>
            `).join("");
            return `
                <tr>
                    <td class="text-start pe-3" style="max-width:420px;">${itemNum}. ${escapeHtml(text)}</td>
                    ${radios}
                </tr>`;
        }).join("");

        const headerCols = labels.map(l => `<th class="text-center" style="font-size:0.8rem;">${l}</th>`).join("");

        $("#mainContent").html(`
            <div class="container text-center" style="max-width:760px;">
                <h2 class="mb-3">Questionnaire</h2>
                <p class="lead mb-1">For each statement below, please indicate how characteristic or true it is of you.</p>
                <p class="text-muted mb-4" style="font-size:0.9rem;">0 = Not at all characteristic &nbsp;·&nbsp; 4 = Extremely characteristic</p>
                <form id="siasForm">
                    <div class="table-responsive">
                        <table class="table table-striped table-bordered align-middle">
                            <thead class="table-light">
                                <tr>
                                    <th class="text-start">Statement</th>
                                    ${headerCols}
                                </tr>
                            </thead>
                            <tbody>
                                ${rowsHtml}
                            </tbody>
                        </table>
                    </div>
                    <div id="sias-error" class="text-danger mb-2" style="display:none;">Please answer all questions before submitting.</div>
                    <button type="submit" class="btn btn-success mt-2 mb-4">Submit</button>
                </form>
            </div>
        `);

        $("#siasForm").submit(function (e) {
            e.preventDefault();

            const responses = [];
            for (let i = 1; i <= 19; i++) {
                const val = $(`input[name="sias_${i}"]:checked`).val();
                if (val === undefined) {
                    $("#sias-error").show();
                    return;
                }
                responses.push(parseInt(val, 10));
            }

            $("#sias-error").hide();
            $(this).find("button[type=submit]").prop("disabled", true).text("Saving...");

            socket.emit("submit_sias", {
                userId: user.id,
                roomId: roomId,
                responses
            });
        });
    }
    // === End SIAS Screen ===

    // ✅ Show demographics screen
    function showDemographicsScreen() {
        $("#mainContent").html(`
            <div class="container">
                <h2 class="mb-4">Final Information</h2>
                <p>Please complete this short questionnaire before finishing:</p>
    
                <form id="demographicsForm" class="needs-validation" novalidate>
    
                    <!-- Age Input -->
                    <div class="mb-3">
                        <label for="age" class="form-label">Age:</label>
                        <input type="number" id="age" name="age" min="18" max="99" required class="form-control">
                        <div class="invalid-feedback">Please enter a valid age between 18-99.</div>
                    </div>
    
                    <!-- Gender Dropdown -->
                    <div class="mb-3">
                        <label for="gender" class="form-label">Gender:</label>
                        <select id="gender" name="gender" required class="form-select">
                            <option value="" disabled selected>Select your gender</option>
                            <option value="Female">Female</option>
                            <option value="Male">Male</option>
                            <option value="Non-Binary">Non-Binary</option>
                            <option value="Prefer not to say">Prefer not to say</option>
                        </select>
                        <div class="invalid-feedback">Please select your gender.</div>
                    </div>
    
                    <!-- Education Dropdown -->
                    <div class="mb-3">
                        <label for="education" class="form-label">Highest level of education you completed:</label>
                        <select id="education" name="education" required class="form-select">
                            <option value="" disabled selected>Select your education level</option>
                            <option value="Basic">Basic</option>
                            <option value="High school or equivalent (GED)">High school or equivalent (GED)</option>
                            <option value="College">College</option>
                            <option value="Graduate degree">Graduate degree</option>
                            <option value="Prefer not to say">Prefer not to say</option>
                        </select>
                        <div class="invalid-feedback">Please select your education level.</div>
                    </div>
    
                    <!-- Comments Text Area -->
                    <div class="mb-3">
                        <label for="comments" class="form-label">Additional Comments and Feedback (Optional, max 1000 characters):</label>
                        <textarea id="comments" name="comments" class="form-control" maxlength="1000" rows="3"></textarea>
                    </div>
    
                    <!-- Submit Button -->
                    <button type="submit" class="btn btn-success mt-3">Finish Experiment</button>
                </form>
            </div>
        `);

    // Bootstrap form validation
    $("#demographicsForm").submit(function (event) {
        event.preventDefault(); // Prevent page reload

        if (!this.checkValidity()) {
            event.stopPropagation();
            $(this).addClass("was-validated");
            return;
        }

        let age = $("#age").val();
        let gender = $("#gender").val();
        let education = $("#education").val();
        let comments = $("#comments").val() || ""; // Optional field

        // Send data to the server
        socket.emit("submit_demographics", { userId: user.id, age, gender, education, comments });
    });
    }

});
