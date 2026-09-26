CREATE TABLE IF NOT EXISTS users (
 id INT PRIMARY KEY AUTO_INCREMENT, username VARCHAR(50) NOT NULL UNIQUE, password VARCHAR(255) NOT NULL,
 full_name VARCHAR(100) NOT NULL, department VARCHAR(100) NOT NULL DEFAULT '', position VARCHAR(100) NOT NULL DEFAULT '',
 role ENUM('admin','evaluatee','evaluator') NOT NULL, is_active BOOLEAN NOT NULL DEFAULT 1,
 must_change_password BOOLEAN NOT NULL DEFAULT 1, token_version INT NOT NULL DEFAULT 0
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS evaluation_periods (
 id INT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(200) NOT NULL, eval_year INT NOT NULL,
 starts_at DATETIME NOT NULL, ends_at DATETIME NOT NULL, status ENUM('draft','open','closed') NOT NULL DEFAULT 'draft',
 published_at DATETIME NULL, formula_version VARCHAR(30) NOT NULL DEFAULT 'weighted-v1', created_by INT NOT NULL,
 FOREIGN KEY(created_by) REFERENCES users(id), CHECK(starts_at < ends_at)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS topics (
 id INT PRIMARY KEY AUTO_INCREMENT, period_id INT NOT NULL, name VARCHAR(200) NOT NULL, description TEXT,
 UNIQUE(id,period_id), FOREIGN KEY(period_id) REFERENCES evaluation_periods(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS indicators (
 id INT PRIMARY KEY AUTO_INCREMENT, period_id INT NOT NULL, topic_id INT NOT NULL, name VARCHAR(200) NOT NULL,
 description TEXT, weight DECIMAL(8,2) NOT NULL, score_type ENUM('scale4','boolean') NOT NULL,
 evidence_mode ENUM('none','url','file','either') NOT NULL DEFAULT 'either', evidence_required BOOLEAN NOT NULL DEFAULT 0,
 evidence_instruction VARCHAR(500) NOT NULL DEFAULT '', UNIQUE(id,period_id),
 FOREIGN KEY(topic_id,period_id) REFERENCES topics(id,period_id), CHECK(weight>0)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS period_participants (
 id INT PRIMARY KEY AUTO_INCREMENT, period_id INT NOT NULL, evaluatee_id INT NOT NULL,
 status ENUM('draft','submitted') NOT NULL DEFAULT 'draft', submitted_at DATETIME NULL,
 UNIQUE(period_id,evaluatee_id), UNIQUE(id,period_id),
 FOREIGN KEY(period_id) REFERENCES evaluation_periods(id), FOREIGN KEY(evaluatee_id) REFERENCES users(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS files (
 id INT PRIMARY KEY AUTO_INCREMENT, owner_id INT NOT NULL, storage_key VARCHAR(100) NOT NULL UNIQUE,
 original_name VARCHAR(255) NOT NULL, mime_type VARCHAR(100) NOT NULL, size_bytes BIGINT NOT NULL,
 purpose ENUM('evidence','signature') NOT NULL, FOREIGN KEY(owner_id) REFERENCES users(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS evaluator_assignments (
 id INT PRIMARY KEY AUTO_INCREMENT, period_id INT NOT NULL, participant_id INT NOT NULL, evaluator_id INT NOT NULL,
 committee_role ENUM('chair','member') NOT NULL, status ENUM('pending','in_progress','submitted') NOT NULL DEFAULT 'pending',
 overall_feedback TEXT, signature_file_id INT NULL, submitted_at DATETIME NULL,
 UNIQUE(participant_id,evaluator_id), UNIQUE(id,period_id),
 FOREIGN KEY(participant_id,period_id) REFERENCES period_participants(id,period_id),
 FOREIGN KEY(evaluator_id) REFERENCES users(id), FOREIGN KEY(signature_file_id) REFERENCES files(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS self_assessments (
 id INT PRIMARY KEY AUTO_INCREMENT, period_id INT NOT NULL, participant_id INT NOT NULL, indicator_id INT NOT NULL,
 narrative TEXT, score TINYINT NULL, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE(participant_id,indicator_id),
 FOREIGN KEY(participant_id,period_id) REFERENCES period_participants(id,period_id),
 FOREIGN KEY(indicator_id,period_id) REFERENCES indicators(id,period_id), CHECK(score IS NULL OR score BETWEEN 0 AND 4)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS evidence_items (
 id INT PRIMARY KEY AUTO_INCREMENT, self_assessment_id INT NOT NULL, kind ENUM('url','file') NOT NULL,
 url VARCHAR(2000) NULL, file_id INT NULL UNIQUE,
 FOREIGN KEY(self_assessment_id) REFERENCES self_assessments(id), FOREIGN KEY(file_id) REFERENCES files(id),
 CHECK((kind='url' AND url IS NOT NULL AND file_id IS NULL) OR (kind='file' AND file_id IS NOT NULL AND url IS NULL))
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS evaluator_scores (
 id INT PRIMARY KEY AUTO_INCREMENT, period_id INT NOT NULL, assignment_id INT NOT NULL, indicator_id INT NOT NULL,
 score TINYINT NOT NULL, UNIQUE(assignment_id,indicator_id),
 FOREIGN KEY(assignment_id,period_id) REFERENCES evaluator_assignments(id,period_id),
 FOREIGN KEY(indicator_id,period_id) REFERENCES indicators(id,period_id), CHECK(score BETWEEN 0 AND 4)
) ENGINE=InnoDB;
