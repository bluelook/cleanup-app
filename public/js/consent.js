function showConsentScreen() {
    $("#mainContent").html(`
        <div class="text-center">
            <h2>Consent Form</h2>
            <p>Please enter your Participant ID and accept to continue.</p>
            <input type="text" id="participantId" class="form-control mb-3" placeholder="Enter your ID">
            <button id="consentBtn" class="btn btn-primary">I Agree</button>
        </div>
    `);

    $("#consentBtn").click(() => {
        const id = $("#participantId").val().trim();
        if (!id) {
            alert("Please enter your Participant ID.");
            return;
        }
        user = {
            id,
            username: `Player_${id}`,
            avatar: `images/player_${Math.floor(Math.random() * 4) + 1}.png`,
            position: { x: 2, y: 2 }
        };
        showRoomJoinScreen();
    });
}
