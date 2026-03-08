-- Migration 0015: Ajout des types QRP (Questions à Réponses Précisées)

-- Ajouter une colonne pour le nombre de réponses attendues
ALTER TABLE questions ADD COLUMN nombre_reponses_attendues INTEGER DEFAULT 0;

-- Ajouter une colonne pour les types de correction des options QRP
-- JSON format: {"option1": "indispensable", "option2": "inacceptable", "option3": "vrai", "option4": "faux"}
ALTER TABLE questions ADD COLUMN types_correction TEXT;

-- Les nouveaux types supportés seront:
-- - 'single': QCM à réponse unique
-- - 'multiple': QCM à réponses multiples  
-- - 'qroc': Questions à Réponse Ouverte Courte
-- - 'qzp': Questions à Zone à Pointer
-- - 'qrp': Questions à Réponses Précisées (4-5 propositions)
-- - 'qrp_longues': Questions à Réponses Précisées Longues (10-25 propositions)