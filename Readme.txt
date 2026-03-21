Description of CleanUp multiplayer app

There are comments in the scripts, but here is an overview of the different parts of the game, how it is handled and where.
The script may contain some bugs and inefficiencies.

To run it you need to generate the MySQL database and table (and update login part in the server.js).
Then go to /server folder and run 'npm install' to install all packages and module.
To properly run go to /server folder and run 'node server.js', and the experiment is available in localhost:5000/

Good luck!
Uri

1. folder structure

cleanup-app
	/public //frontend materials
		/images // graphics
		index.html 
		script.js //frontend script
		styles.css
	/server //backend materials
		server.js //backend script
		packages.json // node package list
		tables.sql // scripts for mysql tables generation
		export_movement.js //node.js script to export movements table data
		export_demographics.js //node.js script to export demographis table data

2. Frontend

The script.js governs the progress of an experiment through these stages:
1. Welcome screen and information
2. Consent form and login (insert participant ID)
3. Task instructions
4. Joining waiting room 
5. Chat with other players in the room
6. Rendering of task and experimental task (clean-up), and user input (key-presses)
7. Exit demographics survey
8. End page with information about performance and link to prolific

3. Backend

The server.js governs and monitors the different stages of the experiment
1. Set up parameters for the experiment (group size, time for task and so on)
2. Set up the server and sockets
3. Set up connection with MySQL server
4. Handle user login
5. Waiting room management
	- Add users to waiting list
	- opening task-room and assign users
6. Manage user disconnection
7. Synchronizing chat messages
8. Governing experimental task
	- Timer for all users
	- Get movement messages and send new location and scores to all players
	- Generate stars (apples) and dirt (ball in the script...) and send their location to all users
	- Save data upon each key-press to MySQL movements table
9. Handle end of experiment
	- Send users to exit survey
	- Save survey data in MySQL demographics table
	- Close room and disconnect users
	