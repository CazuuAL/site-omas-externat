-- Migration pour remplacer l'email confirmation par validation manuelle
-- Ajouter le champ account_status et supprimer les champs email

-- Ajouter le statut du compte
ALTER TABLE users ADD COLUMN account_status TEXT DEFAULT 'pending' CHECK(account_status IN ('pending', 'approved', 'rejected'));

-- Supprimer les anciennes colonnes email (optionnel pour garder la compatibilité)
-- ALTER TABLE users DROP COLUMN email_confirmed;
-- ALTER TABLE users DROP COLUMN email_token; 
-- ALTER TABLE users DROP COLUMN token_expires_at;

-- Mettre à jour les comptes existants pour les marquer comme approuvés
UPDATE users SET account_status = 'approved' WHERE role IN ('teacher', 'super_admin');

-- Les étudiants existants sont aussi approuvés pour éviter les problèmes
UPDATE users SET account_status = 'approved' WHERE role = 'student' AND created_at < datetime('now', '-1 hour');