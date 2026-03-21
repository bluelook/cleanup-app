function showRoomScreen(roomData) {
    let gridHtml = `
        <div id="room-message" class="text-center text-danger fw-bold my-2" style="display:none;"></div>
        <table class="table-bordered mx-auto">`;

    for (let y = 0; y < 10; y++) {
        gridHtml += "<tr>";
        for (let x = 0; x < 10; x++) {
            gridHtml += `<td id="cell-${x}-${y}" class="grid-cell" data-x="${x}" data-y="${y}" style="width:40px; height:40px; text-align:center;"></td>`;
        }
        gridHtml += "</tr>";
    }
    gridHtml += "</table>";

    $("#mainContent").html(`
        <div class="container">
            <div class="row justify-content-center"><h2>Apple Harvest Game</h2></div>
            ${gridHtml}
        </div>
    `);

    // Draw avatars
    roomData.users.forEach(u => {
        const { x, y } = u.position;
        $(`#cell-${x}-${y}`).html(`<img src="${u.avatar}" width="30" onclick="punishPlayer('${u.id}')">`);
    });
}

function punishPlayer(targetId) {
    if (targetId === user.id) return;
    socket.emit("punish_player", {
        punisherId: user.id,
        punishedId: targetId,
        roomId: roomId
    });
}

socket.on("punishment_notice", ({ punisherId, punishedId }) => {
    const punisher = users[punisherId];
    const punished = users[punishedId];
    if (!punished) return;

    const { x, y } = punished.position;
    const cell = $(`#cell-${x}-${y}`);

    const originalHtml = cell.html();
    cell.html("💥").addClass("flash-red");

    setTimeout(() => {
        cell.html(originalHtml);
        cell.removeClass("flash-red");
    }, 500);

    const msg = `${punisher?.username || 'Someone'} punished ${punished?.username || 'another player'}!`;
    $("#room-message").text(msg).fadeIn();

    setTimeout(() => $("#room-message").fadeOut(), 2000);
});
