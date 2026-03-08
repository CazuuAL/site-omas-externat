-- Migration 0007: Ajouter le support des Dossiers Progressifs
-- Ajouter une colonne pour identifier les QCM comme dossiers progressifs

-- Ajouter la colonne is_dossier_progressif à la table qcm_weekly
ALTER TABLE qcm_weekly ADD COLUMN is_dossier_progressif BOOLEAN DEFAULT 0;

-- Ajouter une colonne pour le contexte initial du dossier progressif
ALTER TABLE qcm_weekly ADD COLUMN contexte_initial TEXT;

-- Ajouter une colonne pour les informations d'étape de chaque question
ALTER TABLE questions ADD COLUMN infos_etape TEXT; -- Informations révélées à cette étape

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_qcm_weekly_is_dossier_progressif ON qcm_weekly(is_dossier_progressif);