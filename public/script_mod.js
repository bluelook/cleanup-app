//const socket = io("http://localhost:5000");
const DEV_MODE = true;

const socket = io();

let user = null;
let roomId = null;
let users={};
let waitingTimeout;
const  timeOut = 10;//10 minutes
const payApple = 0.02;//
let instructionPage = 1; // ✅ Track the instruction page number

function showScreen(screenType) {
    let html = "";
    console.log('login data'+JSON.stringify(user))

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
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="consent1">
                        <label class="form-check-label" for="consent1">
                            I have read the information page and I consent to take part in this study.
                        </label>
                    </div>

                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="consent2">
                        <label class="form-check-label" for="consent2">
                            I understand that anonymous data that cannot be traced back to me individually may be used in academic publications and shared in accordance with open science guidelines and I consent to this.
                        </label>
                    </div>

                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="consent3">
                        <label class="form-check-label" for="consent3">
                            I understand that the legal basis for processing any personal information about me is my consent.
                        </label>
                    </div>

                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="consent4">
                        <label class="form-check-label" for="consent4">
                            I understand that I can withdraw at any time from the study by closing my browser window but that it will be difficult or impossible to withdraw my data once the task has been submitted.
                        </label>
                    </div>

                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="consent5">
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
            startTutorial(1); // Start at tutorial stage 1
            return;

        case "quiz":
            showQuiz(); // ✅ Show quiz after instructions
            return;
    }

    $("#mainContent").html(html);
}

// ✅ Handle consent submission

    function submitConsent() {
        // Ensure all checkboxes are checked
        if (!$("#consent1").is(":checked") || 
            !$("#consent2").is(":checked") || 
            !$("#consent3").is(":checked") || 
            !$("#consent4").is(":checked") || 
            !$("#consent5").is(":checked")) {
            alert("Please check all the boxes before continuing.");
            return;
        }else{
             // Ensure Prolific ID is entered
        let prolificId = $("#prolificId").val().trim();
        if (!prolificId) {
            alert("Please enter your Prolific ID.");
            return;
        }else{
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
        { text: "You are not the only farmer collecting apples and cleaning the river, other farmers are playing the game with you. <br>In the next step we will connect you to other players, and you will be able to send them a message before playing the apple harvest game together.<br>The number of apples each player collected will determine their individual bonus.",img:''}
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
        console.log('User'+JSON.stringify(user))

        socket.emit("join_waiting_list", user ); // ✅ Join waiting list
        showWaitingScreen(); // ✅ Correct answers → move to waiting room


    } else {
        showInstructions(instructionPage);
    }
}

function startTutorial(stage) {
    let position = { x: 3, y: 1 }; // Player starts in the center
    let moves = 0;
    let maxMoves = 3;
    let gridObjects = {}; // Store objects (apple, dirt, etc.)
    
    // Define tutorial instructions for each stage
    let tutorialStages = [
        { text: "In this multiplayer apple harvest game, you play a farmer harvesting apples. <br>You move around a D map using your keyboard arrow keys.<br>Let’s try it – Use the arrow keys to move around the grid.", 
            objective: "Move 3 steps." },
        { text: "Apples grow in the orchard, the green squares on the left of the map. <br>You collect them by moving over them. <br>Let’s try it – move to collect the apple. ", 
            objective: "Collect the apple." },
        { text: "Apples don’t grow if there is too much dirt in the river, the blue squares on the right of the map.<br>To clean the river from dirt, you move over it.<br>Let’s try it – move to clean the dirt from the river.", 
            objective: "Clean the dirt." },
        { text: "Your goal is to collect as many apples as possible, each apple will earn you <b>£"+ payApple+"</b> bonus.<br>To get more apples, you need to clean the river first.<br>Let’s try it – move to clean the river, and then collect the apple.", 
            objective: "Clean the dirt." },
        { text: "Your goal is to collect as many apples as possible, each apple will earn you <b>£"+ payApple+"</b> bonus.<br>To get more apples, you need to clean the river first.<br>Let’s try it – move to clean the river, and then collect the apple.", 
            objective: "Collect the new apple." }
    ];

    // Place objects based on the tutorial stage
    if (stage === 2) gridObjects.apple = { x: 0, y: 2 };
    if (stage === 3) gridObjects.dirt = { x: 6, y: 1 };
    if (stage === 4) gridObjects.dirt = { x: 6, y: 0 }; // Collecting dirt instead of cleaning
    if (stage === 5) {
        position = { x: 6, y: 0 };
        gridObjects.apple = { x: 0, y: 1 }; // Apple appears after cleaning dirt
    }

    let html = `
        <div class="container text-center">
            <h2>Tutorial - Step ${stage}</h2>
            <p>${tutorialStages[stage - 1].text}</p>
            <p><strong>Objective:</strong> ${tutorialStages[stage - 1].objective}</p>
            <div id="tutorialGrid" class="d-inline-block"></div>
            <div id="tutorialMessage" class="mt-3" style="display: none;">
                <h3>Great job!</h3>
                <button class="btn btn-success" onclick="${stage < 5 ? `startTutorial(${stage + 1})` : `showScreen('quiz')`}">
                    ${stage < 5 ? "Next" : "Proceed to Questionnaire"}
            </div>
        </div>
    `;

    $("#mainContent").html(html);
    drawTutorialGrid(position, gridObjects);

    $(document).off("keydown").on("keydown", (event) => {
        let allowedKeys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
        if (!allowedKeys.includes(event.key)) return;

        let newPosition = { ...position };

        if (event.key === "ArrowLeft" && position.x > 0) newPosition.x--;
        if (event.key === "ArrowRight" && position.x < 7) newPosition.x++;
        if (event.key === "ArrowUp" && position.y > 0) newPosition.y--;
        if (event.key === "ArrowDown" && position.y < 2) newPosition.y++;

        if (newPosition.x !== position.x || newPosition.y !== position.y) {
            moves++;
            position = newPosition;
            drawTutorialGrid(position, gridObjects);
           // $("#moveCounter").text(`Moves: ${moves}/${maxMoves}`);

            if (stage === 1 && moves >= maxMoves) {
                $("#tutorialMessage").show();
                $(document).off("keydown");
            }

            if (stage === 2 && position.x === gridObjects.apple.x && position.y === gridObjects.apple.y) {
                $("#tutorialMessage").show();
                $(document).off("keydown");
            }

            if ((stage === 3 ) && position.x === gridObjects.dirt.x && position.y === gridObjects.dirt.y) {
                $("#tutorialMessage").show();
                $(document).off("keydown");
            }

            if (stage === 4 && position.x === gridObjects.dirt.x && position.y === gridObjects.dirt.y) {
                startTutorial(5);
                //$(document).off("keydown");
            }
            

            if (stage === 5 && position.x === gridObjects.apple.x && position.y === gridObjects.apple.y) {
                $("#tutorialMessage").show();
                $(document).off("keydown");
            }
        }
    });
}

function drawTutorialGrid(playerPos, objects) {
    let gridHtml = "<table class='table-bordered mx-auto'>";
    for (let y = 0; y < 3; y++) {
        gridHtml += "<tr>";
        for (let x = 0; x < 7; x++) {
            let cellId = `cell-${x}-${y}`;
            let cellClass = (x === 0) ? "orchard" : (x === 6) ? "river" : "land"; // Assign class based on column
            let cellContent = "";

            if (x === playerPos.x && y === playerPos.y) {
                cellContent = `<img src="images/player_demo.png" class="img-fluid" width="30">`; // Player Avatar
            } else if (objects.apple && objects.apple.x === x && objects.apple.y === y) {
                cellContent = `<img src="images/star.png" class="img-fluid" width="30">`; // Apple
            } else if (objects.dirt && objects.dirt.x === x && objects.dirt.y === y) {
                cellContent = `<img src="images/ball.png" class="img-fluid" width="30">`; // Dirt
            }
            gridHtml += `<td id="${cellId}" class="${cellClass}">${cellContent}</td>`;

            //gridHtml += `<td id="${cellId}" class="border p-3 text-center ${cellClass}">${cellContent}</td>`;
        }
        gridHtml += "</tr>";
    }
    gridHtml += "</table>";
    $("#tutorialGrid").html(gridHtml);
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

            <button class="btn btn-primary mt-3" onclick="checkQuiz()">Submit Answers</button>
        </div>
    `;

    $("#mainContent").html(html);
}

// ✅ Validate quiz answers
function checkQuiz() {
    let q1 = $("#q1").val();
    let q2 = $("#q2").val();

    if (q1 === "apples" && q2 === "score") {
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

    //        // Start 10-minute timeout
    // waitingTimeout = setTimeout(() => {
    //     alert("No players joined within the allocated time. Redirecting...");
    //     timeOutScreen();
    //     }, timeOut*60*1000);

         // Start countdown timer
     waitingTimeout = setInterval(() => {
        timeLeft--;
        $("#waitingTimer").text(formatTime(timeLeft));

        if (timeLeft <= 0) {
            clearInterval(waitingTimeout);
            alert("No players joined within the allocated time. Redirecting...");
            console.log('user time out :'+user.id)
            socket.emit("user_timeout", {userId: user.id});
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
function timeOutScreen(){
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

    function punishPlayer(targetId) {
        if (!confirm("Are you sure you want to punish this player?")) return;
console.log("📤 Sending punish_player:", {
    punisherId: user.id,
    punishedId: targetId,
    roomId
});

        socket.emit("punish_player", {
            punisherId: user.id,
            punishedId: targetId,
            roomId
        });

        // Removed alert — now handled via punishment_notice socket
    }


$(document).ready(() => {

    



    socket.on("login_success", (data) => {
        console.log('step 1 successful')
        user = data;
        console.log('login data'+JSON.stringify(user))

        showScreen("tutorial"); // ✅ Move to instructions
    });

    

    // // ✅ Show login UI
    // function showLoginScreen() {
    //     $("#mainContent").html(`
    //         <h2>Enter Your Username</h2>
    //         <input type="text" id="username" class="form-control my-3" placeholder="Enter your name">
    //         <button id="loginButton" class="btn btn-primary">Login</button>
    //     `);

    //     $("#loginButton").click(() => {
    //         let username = $("#username").val().trim();
    //         if (!username) {
    //             alert("Please enter a username!");
    //             return;
    //         }
    //         socket.emit("login", username);
    //     });
    // }

    // socket.on("login_success", (data) => {
    //     console.log('step 1 successful')
    //     user = data;
    //     showJoinWaitingListScreen();
    // });

    // function showJoinWaitingListScreen() {
    //     console.log('step 2 successful')

    //     $("#mainContent").html(`
    //         <h2>Welcome, ${user.username}!</h2>
    //         <p>Press the button below to join the waiting list.</p>
    //         <button id="joinWaitingListButton" class="btn btn-warning">Join Waiting List</button>
    //     `);

    //     $("#joinWaitingListButton").click(() => {
    //         console.log('step 2 press')

    //         socket.emit("join_waiting_list", user);
    //         showWaitingScreen();
    //     });
    // }



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
                <p>Before we start, please send a message to greet all other players.</p>
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
    
        // ✅ Disable the send button after sending a message
        $("#sendMessage").click(() => {
            let message = $("#chatMessage").val().trim();
            if (message) {
                socket.emit("send_chat_message", { userId: user.id, roomId, message });
                $("#sendMessage").prop("disabled", true);
                $("#chatMessage").prop("disabled", true);
            } else {
                alert("Please enter a message before sending.");
            }
        });
    }

    socket.on("receive_chat_message", (messages) => {
        console.log('recieved message')
        $("#chatWindow").html(""); // ✅ Clear old messages
    
        messages.forEach(msg => {
            $("#chatWindow").append(`
                <div class="d-flex align-items-center mb-2">
                    <img src="${msg.avatar}" width="40" class="rounded me-2">
                     <span>${msg.message}</span>
                </div>
            `);
        });
    });

    socket.on("all_messages_received", () => {
        console.log('recieved all message')
        let count = 5;
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
        console.log('user_left_noted'+username)
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

        let gridHtml = `<div id="room-message" class="text-center text-danger fw-bold my-2" style="display:none;"></div>
    <table class="table-bordered mx-auto">`;

        for (let y = 0; y < 10; y++) {
            gridHtml += "<tr>";
            for (let x = 0; x < 15; x++) {
                let cellClass = x <= 2 ? "orchard" : x >= 12 ? "river" : "land"; // ✅ Assign terrain class
                gridHtml += `<td id="cell-${x}-${y}" class="${cellClass}"></td>`;
                }
            gridHtml += "</tr>";
        }
        gridHtml += "</table>";

        // <div class="row justify-content-center">${userHtml}</div>
        // <div class="row">${otherUsersHtml}</div>
       $("#mainContent").html(`
    <div class="container">
        <div class="row justify-content-center"><h2>Apple Harvest Game</h2></div>
        <div id="room-message" class="text-center text-danger mb-3" style="display:none; font-size: 20px;"></div>
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
        if ($("#room-message").length === 0) {
            $("#mainContent").prepend(`<div id="room-message" class="text-center text-danger fw-bold my-2" style="display:none;"></div>`);
        }

        roomData.users.forEach(u => {
            let { x, y } = u.position;
            //$(`#cell-${x}-${y}`).html(`<img src="${u.avatar}" class="img-fluid" width="30">`);
            const avatarHTML = `<img src="${u.avatar}" class="img-fluid" width="30">`;
            const cell = $(`#cell-${x}-${y}`);

            if (u.id !== user.id) {
                // Clickable for punishment
                cell.html(`<div onclick="punishPlayer('${u.id}')">${avatarHTML}</div>`);
            } else {
                // Your own avatar: no click
                cell.html(avatarHTML);
    }
        });

        // ✅ Add punishment click handlers dynamically
$(".player-avatar").off("click").on("click", function () {
    const targetId = $(this).data("id");
    if (targetId !== user.id) {
        punishPlayer(targetId);
    }
});


        let canMove = true; // ✅ Prevents continuous movement

        $(document).keydown((event) => {
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

    

    // ✅ Handle position updates
    socket.on("update_positions", (roomUsers) => {
        // ✅ Remove only player avatars, keeping stars intact
        $(".table-bordered td").each(function () {
            let img = $(this).find("img");
            if (img.length > 0 && !img.attr("src").includes("star.png") && !img.attr("src").includes("ball.png")) {
                $(this).html(""); // Clear only player images
            }
        });
    
        // ✅ Redraw all players at their new positions
        roomUsers.forEach(user => {
            $(`#cell-${user.position.x}-${user.position.y}`).html(`<img src="${user.avatar}" class="img-fluid" width="30">`);
        });
    });
    
    
    
    // ✅ Handle timer updates
    socket.on("update_timer", (timeLeft) => {
        $("#timer").text(timeLeft);
    });

    //update stars
    socket.on("update_stars", (stars) => {
        //console.log('Update Stars'+JSON.stringify(stars))

        // ✅ First, clear all stars from the grid
        let img = $(this).find("img");
        if (img.length > 0 && img.attr("src").includes("star.png")) {
            $(this).html(""); // Clear only star images
        }
    
        // ✅ Then, redraw all stars
        stars.forEach(star => {
            $(`#cell-${star.x}-${star.y}`).html(`<img src="images/star.png" class="img-fluid" width="30">`);
        });
    });

     //update balls
     socket.on("update_balls", (balls) => {
        //console.log('Update Stars'+JSON.stringify(stars))

        // ✅ First, clear all stars from the grid
        let img = $(this).find("img");
        if (img.length > 0 && img.attr("src").includes("ball.png")) {
            $(this).html(""); // Clear only ball images
        }
    
        // ✅ Then, redraw all stars
        balls.forEach(ball => {
            $(`#cell-${ball.x}-${ball.y}`).html(`<img src="images/ball.png" class="img-fluid" width="30">`);
        });
    });

   
    //update score
    socket.on("update_scores", (scores) => {
        console.log('Update Scores')
        scores.forEach(scoreData => {
            if (scoreData.username === user.username) {
                $("#starScore").text(scoreData.star_score); // ✅ Update UI
                $("#ballScore").text(scoreData.ball_score); // ✅ Update UI
            }
        });
    });
     console.log("Setting up listener for punishment_notice");


    socket.on("punishment_notice", ({ punisherId, punishedId }) => {
    const punisher = users[punisherId];
    const punished = users[punishedId];

    if (!punished) return;

    const { x, y } = punished.position;
    const punishedCell = $(`#cell-${x}-${y}`);

    // Flash red + 💥 effect
    punishedCell.addClass("flash-red");
    const originalHtml = punishedCell.html();
    punishedCell.html("💥");

    setTimeout(() => {
        punishedCell.html(originalHtml);
        punishedCell.removeClass("flash-red");
    }, 500);

    // Show text message
    const message = `${punisher?.username || 'Someone'} punished ${punished?.username || 'a player'}!`;
    const msgEl = $("#room-message");
    msgEl.html(message).fadeIn();

    setTimeout(() => {
        msgEl.fadeOut();
    }, 2000);
});



    // time up - exit questionnaire
    socket.on("time_up", () => {
        $("#mainContent").html(`
            <div class="container">
                <h2 class="mb-4">Time's Up!</h2>
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
  
    socket.emit("end_experiment", {userId: data.userId});
});

if (DEV_MODE) {
    const randId1 = Math.random().toString(36).substring(7);
    const randId2 = Math.random().toString(36).substring(7);

    const user1 = {
        id: "dev_user_" + randId1,
        username: "DevTester_" + randId1,
        avatar: "images/player_1.png",
        position: { x: 2, y: 2 }
    };

    const user2 = {
        id: "dev_user_" + randId2,
        username: "DevTester_" + randId2,
        avatar: "images/player_2.png",
        position: { x: 5, y: 3 }
    };

    user = user1;
    roomId = "devroom";
    users = {
        [user1.id]: user1,
        [user2.id]: user2
    };

    showRoomScreen({ roomId, users: Object.values(users) });

    // Simulate punishment event after 3s
    setTimeout(() => {
        socket.emit("punish_player", {
            punisherId: user1.id,
            punishedId: user2.id,
            roomId: roomId
        });
    }, 3000);
}

});
