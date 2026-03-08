-- Migration pour ajouter la confirmation par email
-- Ajouter les champs de confirmation d'email

-- Ajouter le champ email_confirmed et email_token
ALTER TABLE users ADD COLUMN email_confirmed BOOLEAN DEFAULT 0;
ALTER TABLE users ADD COLUMN email_token TEXT;
ALTER TABLE users ADD COLUMN token_expires_at DATETIME;

-- Les utilisateurs existants sont considérés comme confirmés
UPDATE users SET email_confirmed = 1 WHERE email_confirmed IS NULL;