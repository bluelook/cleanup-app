function showRoomJoinScreen() {
    $("#mainContent").html(`
        <div class="text-center">
            <h2>Join a Room</h2>
            <input type="text" id="roomInput" class="form-control mb-3" placeholder="Enter Room ID">
            <button id="joinBtn" class="btn btn-success">Join Room</button>
        </div>
    `);

    $("#joinBtn").click(() => {
        roomId = $("#roomInput").val().trim();
        if (!roomId) {
            alert("Please enter a Room ID.");
            return;
        }
    console.log("🧠 Emitting join_room:", { userId: user.id, roomId });

        socket.emit("join_room", { userId: user.id, roomId });
    });
}

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
