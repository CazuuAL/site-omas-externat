-- Ajouter la colonne options_json à la table questions
-- Cette colonne stockera les options des questions QRP au format JSON

ALTER TABLE questions ADD COLUMN options_json TEXT;