-- Table des utilisateurs
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME
);

-- Table des QCM hebdomadaires
CREATE TABLE IF NOT EXISTS qcm_weekly (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  titre TEXT NOT NULL,
  specialite TEXT NOT NULL,
  semaine INTEGER NOT NULL,
  description TEXT,
  disponible_debut DATETIME NOT NULL,
  disponible_fin DATETIME NOT NULL,
  date_limite DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table des questions
CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  qcm_id INTEGER NOT NULL,
  enonce TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  option_e TEXT,
  reponse_correcte TEXT NOT NULL,
  explication TEXT,
  ordre INTEGER NOT NULL,
  FOREIGN KEY (qcm_id) REFERENCES qcm_weekly(id) ON DELETE CASCADE
);

-- Table des réponses des étudiants
CREATE TABLE IF NOT EXISTS student_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  question_id INTEGER NOT NULL,
  qcm_id INTEGER NOT NULL,
  reponse TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  answered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
  FOREIGN KEY (qcm_id) REFERENCES qcm_weekly(id) ON DELETE CASCADE
);

-- Table de progression des étudiants
CREATE TABLE IF NOT EXISTS student_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  qcm_id INTEGER NOT NULL,
  score REAL,
  total_questions INTEGER NOT NULL,
  correct_answers INTEGER NOT NULL,
  completed BOOLEAN DEFAULT 0,
  completed_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (qcm_id) REFERENCES qcm_weekly(id) ON DELETE CASCADE,
  UNIQUE(user_id, qcm_id)
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_qcm_weekly_semaine ON qcm_weekly(semaine);
CREATE INDEX IF NOT EXISTS idx_questions_qcm_id ON questions(qcm_id);
CREATE INDEX IF NOT EXISTS idx_student_answers_user_id ON student_answers(user_id);
CREATE INDEX IF NOT EXISTS idx_student_answers_qcm_id ON student_answers(qcm_id);
CREATE INDEX IF NOT EXISTS idx_student_progress_user_id ON student_progress(user_id);
