-- CREATE DATABASE game_data;
USE game_data;

CREATE TABLE IF NOT EXISTS movements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    exp_name VARCHAR(50),
    group_size INT,
    room_id VARCHAR(10),
    player_id VARCHAR(20),
    time_stamp INT,
    x INT,
    y INT,
    stars_in_room INT,
    balls_in_room INT,
    star_score INT,
    ball_score INT,
    picked_star BOOLEAN,
    picked_ball BOOLEAN,
    coop_value FLOAT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS demographics (
    id INT AUTO_INCREMENT PRIMARY KEY,
    player_id VARCHAR(20) NOT NULL,
    player_name VARCHAR(30) NOT NULL,
    room_id VARCHAR(10) NOT NULL,
    group_size INT NOT NULL,
    exp_name VARCHAR(100) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    age INT NOT NULL,
    gender ENUM('Female', 'Male', 'Non-Binary', 'Prefer not to say') NOT NULL,
    education ENUM('Basic', 'High school or equivalent (GED)', 'College', 'Graduate degree', 'Prefer not to say') NOT NULL,
    comments VARCHAR(1000) DEFAULT NULL,
    star_score INT DEFAULT 0 NOT NULL,
    ball_score INT DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS water_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  room_id VARCHAR(64),
  time_in_water FLOAT NOT NULL,
  drop_duration FLOAT NOT NULL,
  timestamp INT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS punishments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  punisher_id VARCHAR(255) NOT NULL,
  punished_id VARCHAR(255) NOT NULL,
  room_id VARCHAR(255) NOT NULL,
  punishment_message VARCHAR(255),
  message_id VARCHAR(20),
  timestamp INT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS praises (
  id INT AUTO_INCREMENT PRIMARY KEY,
  praiser_id VARCHAR(255) NOT NULL,
  praised_id VARCHAR(255) NOT NULL,
  room_id VARCHAR(255) NOT NULL,
  praise_message VARCHAR(255),
  message_id VARCHAR(20),
  timestamp INT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  player_id VARCHAR(20) NOT NULL,
  room_id VARCHAR(10) NOT NULL,
  sias_1 INT, sias_2 INT, sias_3 INT, sias_4 INT, sias_5 INT,
  sias_6 INT, sias_7 INT, sias_8 INT, sias_9 INT, sias_10 INT,
  sias_11 INT, sias_12 INT, sias_13 INT, sias_14 INT, sias_15 INT,
  sias_16 INT, sias_17 INT, sias_18 INT, sias_19 INT,
  total_score INT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS post_game_survey (
  id INT AUTO_INCREMENT PRIMARY KEY,
  judge_id VARCHAR(64) NOT NULL,
  target_id VARCHAR(64) NOT NULL,
  room_id VARCHAR(64) NOT NULL,
  metric VARCHAR(100) NOT NULL,
  survey_value INT NOT NULL,
  timestamp INT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

