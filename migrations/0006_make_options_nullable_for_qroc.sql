-- Migration 0006: Rendre les options nullable pour supporter QROC et QZP
-- SQLite ne permet pas de modifier directement une colonne, on doit recréer la table

-- 1. Créer une nouvelle table avec la structure corrigée
CREATE TABLE IF NOT EXISTS questions_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  qcm_id INTEGER NOT NULL,
  enonce TEXT NOT NULL,
  option_a TEXT, -- NOW NULLABLE for QROC/QZP
  option_b TEXT, -- NOW NULLABLE for QROC/QZP  
  option_c TEXT, -- NOW NULLABLE for QROC/QZP
  option_d TEXT, -- NOW NULLABLE for QROC/QZP
  option_e TEXT,
  question_type TEXT DEFAULT 'single' CHECK(question_type IN ('single', 'multiple', 'qroc', 'qrp', 'qzp')),
  reponse_correcte TEXT, -- NULLABLE
  reponses_correctes TEXT, -- JSON array pour réponses multiples
  reponse_attendue TEXT, -- Pour QROC/QRP
  image_url TEXT, -- Pour QZP
  zones_cliquables TEXT, -- JSON array pour QZP
  explication TEXT,
  ordre INTEGER NOT NULL,
  FOREIGN KEY (qcm_id) REFERENCES qcm_weekly(id) ON DELETE CASCADE
);

-- 2. Copier les données existantes
INSERT INTO questions_new (
  id, qcm_id, enonce, option_a, option_b, option_c, option_d, option_e, 
  question_type, reponse_correcte, reponses_correctes, 
  reponse_attendue, image_url, zones_cliquables,
  explication, ordre
)
SELECT 
  id, qcm_id, enonce, option_a, option_b, option_c, option_d, option_e, 
  COALESCE(question_type, 'single'), 
  reponse_correcte, 
  reponses_correctes, 
  reponse_attendue, 
  image_url, 
  zones_cliquables,
  explication, 
  ordre
FROM questions;

-- 3. Supprimer l'ancienne table
DROP TABLE questions;

-- 4. Renommer la nouvelle table
ALTER TABLE questions_new RENAME TO questions;

-- 5. Recréer l'index
CREATE INDEX IF NOT EXISTS idx_questions_qcm_id ON questions(qcm_id);