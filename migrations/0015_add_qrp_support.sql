-- Migration pour ajouter le support des questions QRP (Questions à Réponses Précisées)

-- Ajouter les colonnes nécessaires pour les QRP
ALTER TABLE questions ADD COLUMN nombre_reponses_attendues INTEGER DEFAULT 1;
ALTER TABLE questions ADD COLUMN correction_type TEXT DEFAULT 'standard'; -- 'standard', 'qrp', 'qrp_long'

-- Modifier la structure des options pour supporter les types de correction QRP
-- options_json contiendra maintenant:
-- [
--   {"text": "option1", "correction": "indispensable"}, // pour QRP
--   {"text": "option2", "correction": "inacceptable"}, // pour QRP  
--   {"text": "option3", "correction": "vrai"},         // pour QRP et QRP_long
--   {"text": "option4", "correction": "faux"}          // pour QRP et QRP_long
-- ]

-- Mettre à jour la documentation des types de questions supportés:
-- 'single' - QCM simple (1 réponse)
-- 'multiple' - QCM multiple (plusieurs réponses)
-- 'qrp' - Questions à Réponses Précisées (4-5 options, système indispensable/inacceptable)
-- 'qrp_long' - QRP Longues (10-25 options, système simple vrai/faux)
-- 'qroc' - Questions à Réponse Ouverte Courte
-- 'qzp' - Questions à Zone à Pointer