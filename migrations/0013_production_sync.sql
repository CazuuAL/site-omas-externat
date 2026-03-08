-- Migration pour synchroniser la production avec le schéma local complet
-- Ajout de toutes les colonnes manquantes à la table users

ALTER TABLE users ADD COLUMN telephone TEXT;
ALTER TABLE users ADD COLUMN niveau TEXT;
ALTER TABLE users ADD COLUMN email_confirmed INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN email_token TEXT;
ALTER TABLE users ADD COLUMN token_expires_at DATETIME;
ALTER TABLE users ADD COLUMN account_status TEXT DEFAULT 'pending';

-- Mettre à jour les comptes existants s'il y en a
UPDATE users SET account_status = 'approved' WHERE role = 'super_admin';

-- Ajouter la colonne is_dossier_progressif à qcm_weekly si elle n'existe pas
ALTER TABLE qcm_weekly ADD COLUMN is_dossier_progressif INTEGER DEFAULT 0;