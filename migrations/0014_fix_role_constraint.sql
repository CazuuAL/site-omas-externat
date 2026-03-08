-- Recréer la table users avec la contrainte rôle mise à jour pour inclure super_admin

-- 1. Créer une nouvelle table avec la bonne contrainte
CREATE TABLE users_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME,
  role TEXT DEFAULT 'student' CHECK(role IN ('student', 'teacher', 'super_admin')),
  telephone TEXT,
  niveau TEXT,
  account_status TEXT DEFAULT 'pending'
);

-- 2. Copier les données existantes
INSERT INTO users_new (id, email, password_hash, nom, prenom, created_at, last_login, role, telephone, niveau, account_status)
SELECT id, email, password_hash, nom, prenom, created_at, last_login, role, telephone, niveau, account_status FROM users;

-- 3. Supprimer l'ancienne table
DROP TABLE users;

-- 4. Renommer la nouvelle table
ALTER TABLE users_new RENAME TO users;

-- 5. Créer le compte super admin
INSERT INTO users (email, password_hash, nom, prenom, role, account_status)
VALUES ('admin@omasexternat.fr', 'placeholder_hash', 'Administrateur', 'Système', 'super_admin', 'approved');