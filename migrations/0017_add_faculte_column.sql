-- Migration 0017: Ajouter la colonne faculte à la table users
-- Date: 2026-02-15

-- Ajouter la colonne faculte
ALTER TABLE users ADD COLUMN faculte TEXT;

-- Commentaire sur les valeurs acceptées
-- Valeurs possibles:
-- - 'Sorbonne Université'
-- - 'Université Paris Cité'
-- - 'Sorbonne Université Paris Nord'
-- - 'Université Paris-Est Créteil'