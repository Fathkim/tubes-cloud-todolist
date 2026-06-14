CREATE DATABASE IF NOT EXISTS todolist_db;
USE todolist_db;

CREATE TABLE IF NOT EXISTS tasks (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    task_name   VARCHAR(255) NOT NULL,
    description TEXT,
    category    VARCHAR(50)                         DEFAULT 'Umum',
    priority    ENUM('Rendah','Sedang','Tinggi')    DEFAULT 'Sedang',
    due_date    DATE,
    image_path  VARCHAR(255),
    status      ENUM('pending','completed')         DEFAULT 'pending',
    created_at  TIMESTAMP                           DEFAULT CURRENT_TIMESTAMP
);