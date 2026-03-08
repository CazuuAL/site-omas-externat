-- Migration pour ajouter le support de qrp_long dans les contraintes

-- 1. Créer une nouvelle table avec la contrainte mise à jour
CREATE TABLE questions_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  qcm_id INTEGER NOT NULL,
  enonce TEXT NOT NULL,
  option_a TEXT,
  option_b TEXT,
  option_c TEXT,
  option_d TEXT,
  option_e TEXT,
  question_type TEXT DEFAULT 'single' CHECK(question_type IN ('single', 'multiple', 'qroc', 'qrp', 'qrp_long', 'qzp')),
  reponse_correcte TEXT,
  reponses_correctes TEXT,
  reponse_attendue TEXT,
  image_url TEXT,
  zones_cliquables TEXT,
  explication TEXT,
  ordre INTEGER NOT NULL,
  infos_etape TEXT,
  nombre_reponses_attendues INTEGER DEFAULT 1,
  correction_type TEXT DEFAULT 'standard',
  types_correction TEXT,
  options_json TEXT,
  FOREIGN KEY (qcm_id) REFERENCES qcm_weekly(id)
);

-- 2. Copier les données existantes
INSERT INTO questions_new SELECT * FROM questions;

-- 3. Supprimer l'ancienne table
DROP TABLE questions;

-- 4. Renommer la nouvelle table
ALTER TABLE questions_new RENAME TO questions;