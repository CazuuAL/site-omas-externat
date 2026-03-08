-- Migration pour ajouter le système super admin
-- Ajouter le rôle super_admin et créer le compte

-- Créer le super admin
INSERT OR IGNORE INTO users (
  email, 
  password_hash, 
  nom, 
  prenom, 
  role, 
  created_at
) VALUES (
  'admin@omasexternat.fr',
  'superadmin123',  -- En production, utiliser bcrypt
  'Administrateur',
  'Système',
  'super_admin',
  CURRENT_TIMESTAMP
);

-- Mettre à jour les utilisateurs existants avec role teacher s'ils n'ont pas de nom/prénom
UPDATE users 
SET 
  nom = COALESCE(nom, 'Enseignant'),
  prenom = COALESCE(prenom, 'OMAS')
WHERE role = 'teacher' AND (nom IS NULL OR prenom IS NULL);