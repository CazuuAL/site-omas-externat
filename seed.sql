-- Données de test pour l'application OMAS Externat

-- Utilisateurs de test (mot de passe: "password123" hashé - en production, utiliser bcrypt)
INSERT OR IGNORE INTO users (email, password_hash, nom, prenom, role) VALUES 
  ('etudiant1@exemple.fr', 'password123', 'Dupont', 'Marie', 'student'),
  ('etudiant2@exemple.fr', 'password123', 'Martin', 'Pierre', 'student'),
  ('enseignant@exemple.fr', 'password123', 'Professeur', 'Bernard', 'teacher');

-- QCM Hebdomadaires de test
INSERT OR IGNORE INTO qcm_weekly (titre, specialite, semaine, description, disponible_debut, disponible_fin, date_limite, created_by, is_published) VALUES 
  (
    'Cardiologie - Insuffisance cardiaque',
    'Cardiologie',
    1,
    'QCM sur la prise en charge de l''insuffisance cardiaque chronique',
    '2025-01-27',
    '2025-02-03',
    '2025-02-03',
    3,
    1
  ),
  (
    'Pneumologie - BPCO',
    'Pneumologie',
    2,
    'Évaluation et traitement de la BPCO',
    '2025-02-03',
    '2025-02-10',
    '2025-02-10',
    3,
    1
  ),
  (
    'Neurologie - AVC ischémique',
    'Neurologie',
    3,
    'Prise en charge de l''AVC ischémique à la phase aiguë',
    '2025-02-10',
    '2025-02-17',
    '2025-02-17',
    3,
    1
  );

-- Questions pour le QCM de Cardiologie
INSERT OR IGNORE INTO questions (qcm_id, enonce, option_a, option_b, option_c, option_d, option_e, reponse_correcte, explication, ordre) VALUES 
  (
    1,
    'Parmi les signes suivants, lequel est le plus évocateur d''une insuffisance cardiaque gauche ?',
    'Œdème des membres inférieurs',
    'Hépatomégalie',
    'Dyspnée d''effort',
    'Turgescence jugulaire',
    'Reflux hépato-jugulaire',
    'C',
    'La dyspnée d''effort est le signe le plus caractéristique de l''insuffisance cardiaque gauche, en raison de la congestion pulmonaire.',
    1
  ),
  (
    1,
    'Quel est le traitement de première intention de l''insuffisance cardiaque à fraction d''éjection réduite ?',
    'Inhibiteur calcique',
    'IEC ou ARA2',
    'Digoxine',
    'Diurétique seul',
    NULL,
    'B',
    'Les IEC (ou ARA2 en cas d''intolérance) sont le traitement de première ligne de l''IC à FE réduite, avec preuves de réduction de mortalité.',
    2
  ),
  (
    1,
    'Quelle valeur de BNP plaide contre le diagnostic d''insuffisance cardiaque ?',
    'BNP < 100 pg/mL',
    'BNP entre 100-400 pg/mL',
    'BNP entre 400-900 pg/mL',
    'BNP > 900 pg/mL',
    NULL,
    'A',
    'Un BNP < 100 pg/mL (ou NT-proBNP < 300 pg/mL) a une excellente valeur prédictive négative et permet d''écarter le diagnostic d''IC.',
    3
  );

-- Questions pour le QCM de Pneumologie
INSERT OR IGNORE INTO questions (qcm_id, enonce, option_a, option_b, option_c, option_d, reponse_correcte, explication, ordre) VALUES 
  (
    2,
    'Quel critère spirométrique définit une BPCO ?',
    'VEMS < 80% de la valeur prédite',
    'VEMS/CVF < 0,7 après bronchodilatateur',
    'CVF < 80% de la valeur prédite',
    'VEMS/CVF < 0,8 avant bronchodilatateur',
    'B',
    'La BPCO est définie par un rapport VEMS/CVF < 0,7 persistant après administration de bronchodilatateur.',
    1
  ),
  (
    2,
    'Quel est le principal facteur de risque de la BPCO ?',
    'Pollution atmosphérique',
    'Tabagisme',
    'Exposition professionnelle',
    'Déficit en alpha-1-antitrypsine',
    'B',
    'Le tabagisme est de loin le principal facteur de risque de BPCO, impliqué dans 80-90% des cas.',
    2
  );

-- Questions pour le QCM de Neurologie
INSERT OR IGNORE INTO questions (qcm_id, enonce, option_a, option_b, option_c, option_d, reponse_correcte, explication, ordre) VALUES 
  (
    3,
    'Dans quel délai doit être réalisée la thrombolyse IV dans l''AVC ischémique ?',
    'Dans les 2 heures',
    'Dans les 4,5 heures',
    'Dans les 6 heures',
    'Dans les 24 heures',
    'B',
    'La thrombolyse IV (rtPA) doit être réalisée dans les 4,5 heures après le début des symptômes, idéalement le plus tôt possible.',
    1
  ),
  (
    3,
    'Quelle est la première imagerie à réaliser en urgence devant un AVC ?',
    'IRM cérébrale',
    'Scanner cérébral sans injection',
    'Angio-IRM',
    'Échographie doppler des troncs supra-aortiques',
    'B',
    'Le scanner cérébral sans injection est l''examen de première intention car il permet d''éliminer rapidement une hémorragie et est plus accessible.',
    2
  );
