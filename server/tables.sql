-- CREATE DATABASE game_data;
USE game_data;

CREATE TABLE IF NOT EXISTS movements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    exp_name VARCHAR(20),
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
  timestamp INT,
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

