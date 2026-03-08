-- Migration pour étendre les informations utilisateur
-- Ajout des champs obligatoires pour les étudiants

-- Ajouter les nouvelles colonnes à la table users
ALTER TABLE users ADD COLUMN nom TEXT;
ALTER TABLE users ADD COLUMN prenom TEXT; 
ALTER TABLE users ADD COLUMN telephone TEXT;
ALTER TABLE users ADD COLUMN niveau TEXT;

-- Mettre à jour les utilisateurs existants avec des valeurs par défaut
UPDATE users SET nom = 'Non renseigné' WHERE nom IS NULL;
UPDATE users SET prenom = 'Non renseigné' WHERE prenom IS NULL;
UPDATE users SET telephone = 'Non renseigné' WHERE telephone IS NULL;
UPDATE users SET niveau = 'DFGSM 3' WHERE niveau IS NULL AND role = 'student';

-- Créer un index sur le niveau pour les requêtes futures
CREATE INDEX IF NOT EXISTS idx_users_niveau ON users(niveau);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Table pour suivre les résultats des étudiants (si pas déjà existante)
CREATE TABLE IF NOT EXISTS student_detailed_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  qcm_id INTEGER NOT NULL,
  question_id INTEGER NOT NULL,
  user_answer TEXT,
  is_correct BOOLEAN NOT NULL DEFAULT 0,
  answered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (qcm_id) REFERENCES qcm_weekly(id),
  FOREIGN KEY (question_id) REFERENCES questions(id)
);

CREATE INDEX IF NOT EXISTS idx_student_results_user ON student_detailed_results(user_id);
CREATE INDEX IF NOT EXISTS idx_student_results_qcm ON student_detailed_results(qcm_id);