-- Ajouter la colonne role à la table users
ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'student' CHECK(role IN ('student', 'teacher'));

-- Modifier la table qcm_weekly pour ajouter l'auteur
ALTER TABLE qcm_weekly ADD COLUMN created_by INTEGER REFERENCES users(id);
ALTER TABLE qcm_weekly ADD COLUMN is_published BOOLEAN DEFAULT 0;
