-- Migration 0005: Ajout des colonnes pour les nouveaux types de questions R2C

-- Ajouter des colonnes pour les questions QRP/QROC (réponse ouverte)
ALTER TABLE questions ADD COLUMN reponse_attendue TEXT;

-- Ajouter des colonnes pour les questions QZP (zones à pointer sur image)
ALTER TABLE questions ADD COLUMN image_url TEXT;
ALTER TABLE questions ADD COLUMN zones_cliquables TEXT; -- JSON array des zones [{x, y, width, height, label}]

-- Mettre à jour la contrainte CHECK pour accepter les nouveaux types
-- Note: SQLite ne permet pas de modifier les contraintes existantes,
-- donc on doit recréer la table si nécessaire
-- Pour l'instant, on va juste documenter que question_type peut être:
-- 'single', 'multiple', 'qrp', 'qroc', 'qzp'
