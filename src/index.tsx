import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

// Enable CORS pour les API
app.use('/api/*', cors())

// Servir les fichiers statiques
app.use('/static/*', serveStatic({ root: './public' }))

// ============================================
// ROUTES API - Authentification
// ============================================

// API - Inscription
app.post('/api/auth/register', async (c) => {
  try {
    const { nom, prenom, email, password, role } = await c.req.json()
    const { DB } = c.env

    // Validation simple
    if (!nom || !prenom || !email || !password) {
      return c.json({ error: 'Tous les champs sont requis' }, 400)
    }

    if (password.length < 6) {
      return c.json({ error: 'Le mot de passe doit contenir au moins 6 caractères' }, 400)
    }

    // Valider le rôle
    const userRole = role === 'teacher' ? 'teacher' : 'student'

    // Vérifier si l'email existe déjà
    const existing = await DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(email).first()

    if (existing) {
      return c.json({ error: 'Cet email est déjà utilisé' }, 400)
    }

    // Créer l'utilisateur (en production, utiliser bcrypt pour le hash)
    const result = await DB.prepare(
      'INSERT INTO users (email, password_hash, nom, prenom, role) VALUES (?, ?, ?, ?, ?)'
    ).bind(email, password, nom, prenom, userRole).run()

    return c.json({ 
      message: 'Inscription réussie',
      userId: result.meta.last_row_id 
    }, 201)
  } catch (error) {
    console.error('Erreur inscription:', error)
    return c.json({ error: 'Erreur lors de l\'inscription' }, 500)
  }
})

// API - Connexion
app.post('/api/auth/login', async (c) => {
  try {
    const { email, password } = await c.req.json()
    const { DB } = c.env

    if (!email || !password) {
      return c.json({ error: 'Email et mot de passe requis' }, 400)
    }

    // Récupérer l'utilisateur
    const user = await DB.prepare(
      'SELECT id, email, nom, prenom, password_hash, role FROM users WHERE email = ?'
    ).bind(email).first()

    if (!user || user.password_hash !== password) {
      return c.json({ error: 'Email ou mot de passe incorrect' }, 401)
    }

    // Mettre à jour la dernière connexion
    await DB.prepare(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(user.id).run()

    // Retourner les infos utilisateur (en production, générer un JWT)
    return c.json({
      token: `token_${user.id}_${Date.now()}`,
      user: {
        id: user.id,
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        role: user.role
      }
    })
  } catch (error) {
    console.error('Erreur connexion:', error)
    return c.json({ error: 'Erreur lors de la connexion' }, 500)
  }
})

// ============================================
// ROUTES API - QCM
// ============================================

// API - Liste des QCM hebdomadaires (pour étudiants - seulement publiés)
app.get('/api/qcm/list', async (c) => {
  try {
    const { DB } = c.env

    const qcms = await DB.prepare(`
      SELECT id, titre, specialite, semaine, description, 
             disponible_debut, disponible_fin, date_limite
      FROM qcm_weekly
      WHERE is_published = 1
      ORDER BY semaine DESC
    `).all()

    return c.json({ qcms: qcms.results })
  } catch (error) {
    console.error('Erreur chargement QCM:', error)
    return c.json({ error: 'Erreur lors du chargement des QCM' }, 500)
  }
})

// API - Détails d'un QCM avec ses questions
app.get('/api/qcm/:id', async (c) => {
  try {
    const qcmId = c.req.param('id')
    const { DB } = c.env

    // Récupérer le QCM
    const qcm = await DB.prepare(
      'SELECT * FROM qcm_weekly WHERE id = ?'
    ).bind(qcmId).first()

    if (!qcm) {
      return c.json({ error: 'QCM non trouvé' }, 404)
    }

    // Récupérer les questions
    const questions = await DB.prepare(
      'SELECT * FROM questions WHERE qcm_id = ? ORDER BY ordre'
    ).bind(qcmId).all()

    return c.json({ 
      qcm, 
      questions: questions.results 
    })
  } catch (error) {
    console.error('Erreur chargement QCM:', error)
    return c.json({ error: 'Erreur lors du chargement du QCM' }, 500)
  }
})

// API - Soumettre une réponse
app.post('/api/qcm/:id/answer', async (c) => {
  try {
    const qcmId = c.req.param('id')
    const { userId, questionId, answer } = await c.req.json()
    const { DB } = c.env

    // Récupérer la question pour vérifier la réponse
    const question = await DB.prepare(
      'SELECT reponse_correcte FROM questions WHERE id = ?'
    ).bind(questionId).first()

    if (!question) {
      return c.json({ error: 'Question non trouvée' }, 404)
    }

    const isCorrect = question.reponse_correcte === answer

    // Enregistrer la réponse
    await DB.prepare(`
      INSERT INTO student_answers (user_id, question_id, qcm_id, reponse, is_correct)
      VALUES (?, ?, ?, ?, ?)
    `).bind(userId, questionId, qcmId, answer, isCorrect ? 1 : 0).run()

    return c.json({ 
      correct: isCorrect,
      correctAnswer: question.reponse_correcte
    })
  } catch (error) {
    console.error('Erreur soumission réponse:', error)
    return c.json({ error: 'Erreur lors de la soumission' }, 500)
  }
})

// API - Sauvegarder la progression d'un QCM
app.post('/api/qcm/save-progress', async (c) => {
  try {
    const { user_id, qcm_id, score, total_questions, correct_answers, completed } = await c.req.json()
    const { DB } = c.env

    // Vérifier si une entrée existe déjà pour cet utilisateur et ce QCM
    const existing = await DB.prepare(`
      SELECT id FROM student_progress 
      WHERE user_id = ? AND qcm_id = ?
    `).bind(user_id, qcm_id).first()

    if (existing) {
      // Mettre à jour l'entrée existante
      await DB.prepare(`
        UPDATE student_progress 
        SET score = ?, total_questions = ?, correct_answers = ?, 
            completed = ?, completed_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND qcm_id = ?
      `).bind(score, total_questions, correct_answers, completed, user_id, qcm_id).run()
    } else {
      // Créer une nouvelle entrée
      await DB.prepare(`
        INSERT INTO student_progress 
        (user_id, qcm_id, score, total_questions, correct_answers, completed, completed_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(user_id, qcm_id, score, total_questions, correct_answers, completed).run()
    }

    return c.json({ success: true, message: 'Progression enregistrée' })
  } catch (error) {
    console.error('Erreur sauvegarde progression:', error)
    return c.json({ error: 'Erreur lors de la sauvegarde' }, 500)
  }
})

// API - Progression de l'étudiant
app.get('/api/student/:userId/progress', async (c) => {
  try {
    const userId = c.req.param('userId')
    const { DB } = c.env

    const progress = await DB.prepare(`
      SELECT 
        sp.*,
        q.titre,
        q.specialite,
        q.semaine
      FROM student_progress sp
      JOIN qcm_weekly q ON sp.qcm_id = q.id
      WHERE sp.user_id = ?
      ORDER BY q.semaine DESC
    `).bind(userId).all()

    return c.json({ progress: progress.results })
  } catch (error) {
    console.error('Erreur progression:', error)
    return c.json({ error: 'Erreur lors du chargement de la progression' }, 500)
  }
})

// API - Statistiques par matière pour un étudiant
app.get('/api/student/:userId/stats', async (c) => {
  try {
    const userId = c.req.param('userId')
    const { DB } = c.env

    // Récupérer les stats par spécialité
    const stats = await DB.prepare(`
      SELECT 
        q.specialite,
        COUNT(DISTINCT sp.qcm_id) as nb_qcm_faits,
        AVG(sp.score) as score_moyen,
        SUM(sp.correct_answers) as total_correct,
        SUM(sp.total_questions) as total_questions
      FROM student_progress sp
      JOIN qcm_weekly q ON sp.qcm_id = q.id
      WHERE sp.user_id = ? AND sp.completed = 1
      GROUP BY q.specialite
      ORDER BY q.specialite
    `).bind(userId).all()

    // Récupérer les derniers QCM complétés
    const recentQcms = await DB.prepare(`
      SELECT 
        sp.*,
        q.titre,
        q.specialite,
        q.semaine
      FROM student_progress sp
      JOIN qcm_weekly q ON sp.qcm_id = q.id
      WHERE sp.user_id = ? AND sp.completed = 1
      ORDER BY sp.completed_at DESC
      LIMIT 10
    `).bind(userId).all()

    return c.json({ 
      stats: stats.results,
      recentQcms: recentQcms.results 
    })
  } catch (error) {
    console.error('Erreur stats:', error)
    return c.json({ error: 'Erreur lors du chargement des statistiques' }, 500)
  }
})

// ============================================
// ROUTES API - ENSEIGNANTS
// ============================================

// API - Liste des QCM créés par un enseignant
app.get('/api/teacher/qcm/list/:teacherId', async (c) => {
  try {
    const teacherId = c.req.param('teacherId')
    const { DB } = c.env

    const qcms = await DB.prepare(`
      SELECT id, titre, specialite, semaine, description, 
             disponible_debut, disponible_fin, date_limite,
             is_published, created_at
      FROM qcm_weekly
      WHERE created_by = ?
      ORDER BY created_at DESC
    `).bind(teacherId).all()

    return c.json({ qcms: qcms.results })
  } catch (error) {
    console.error('Erreur chargement QCM enseignant:', error)
    return c.json({ error: 'Erreur lors du chargement des QCM' }, 500)
  }
})

// API - Obtenir les détails d'un QCM pour édition
app.get('/api/teacher/qcm/:id/details', async (c) => {
  try {
    const qcmId = c.req.param('id')
    const { DB } = c.env

    // Récupérer le QCM
    const qcm = await DB.prepare(`
      SELECT * FROM qcm_weekly WHERE id = ?
    `).bind(qcmId).first()

    if (!qcm) {
      return c.json({ error: 'QCM introuvable' }, 404)
    }

    // Récupérer les questions
    const questions = await DB.prepare(`
      SELECT * FROM questions WHERE qcm_id = ? ORDER BY ordre ASC
    `).bind(qcmId).all()

    return c.json({ 
      qcm: qcm,
      questions: questions.results 
    })
  } catch (error) {
    console.error('Erreur chargement détails QCM:', error)
    return c.json({ error: 'Erreur lors du chargement' }, 500)
  }
})

// API - Créer un nouveau QCM
app.post('/api/teacher/qcm/create', async (c) => {
  try {
    const body = await c.req.json()
    console.log('📝 Données reçues:', JSON.stringify(body, null, 2))
    
    const { titre, specialite, semaine, description, disponible_debut, disponible_fin, date_limite, created_by, questions } = body
    const { DB } = c.env

    // Validation détaillée
    if (!titre) {
      console.error('❌ Titre manquant')
      return c.json({ error: 'Le titre est requis' }, 400)
    }
    if (!specialite) {
      console.error('❌ Spécialité manquante')
      return c.json({ error: 'La spécialité est requise' }, 400)
    }
    if (!semaine) {
      console.error('❌ Semaine manquante')
      return c.json({ error: 'La semaine est requise' }, 400)
    }
    if (!created_by) {
      console.error('❌ created_by manquant')
      return c.json({ error: 'L\'identifiant de l\'enseignant est requis' }, 400)
    }
    if (!questions || questions.length === 0) {
      console.error('❌ Questions manquantes ou vides:', questions)
      return c.json({ error: 'Au moins une question est requise' }, 400)
    }
    
    console.log('✅ Validation OK, nombre de questions:', questions.length)

    // Créer le QCM
    const qcmResult = await DB.prepare(`
      INSERT INTO qcm_weekly (titre, specialite, semaine, description, disponible_debut, disponible_fin, date_limite, created_by, is_published)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
    `).bind(titre, specialite, semaine, description, disponible_debut, disponible_fin, date_limite, created_by).run()

    const qcmId = qcmResult.meta.last_row_id

    // Créer les questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      await DB.prepare(`
        INSERT INTO questions (qcm_id, enonce, option_a, option_b, option_c, option_d, option_e, question_type, reponse_correcte, reponses_correctes, explication, ordre)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(qcmId, q.enonce, q.option_a, q.option_b, q.option_c, q.option_d, q.option_e || null, q.question_type || 'single', q.reponse_correcte || null, q.reponses_correctes || null, q.explication, i + 1).run()
    }

    return c.json({ 
      message: 'QCM créé avec succès',
      qcmId: qcmId 
    }, 201)
  } catch (error) {
    console.error('Erreur création QCM:', error)
    return c.json({ error: 'Erreur lors de la création du QCM' }, 500)
  }
})

// API - Publier/dépublier un QCM
app.post('/api/teacher/qcm/:id/publish', async (c) => {
  try {
    const qcmId = c.req.param('id')
    const { is_published } = await c.req.json()
    const { DB } = c.env

    await DB.prepare(
      'UPDATE qcm_weekly SET is_published = ? WHERE id = ?'
    ).bind(is_published ? 1 : 0, qcmId).run()

    return c.json({ message: 'Statut de publication mis à jour' })
  } catch (error) {
    console.error('Erreur publication QCM:', error)
    return c.json({ error: 'Erreur lors de la mise à jour' }, 500)
  }
})

// API - Supprimer un QCM
app.delete('/api/teacher/qcm/:id', async (c) => {
  try {
    const qcmId = c.req.param('id')
    const { DB } = c.env

    // Supprimer les questions associées (CASCADE devrait le faire automatiquement)
    await DB.prepare('DELETE FROM questions WHERE qcm_id = ?').bind(qcmId).run()
    
    // Supprimer le QCM
    await DB.prepare('DELETE FROM qcm_weekly WHERE id = ?').bind(qcmId).run()

    return c.json({ message: 'QCM supprimé avec succès' })
  } catch (error) {
    console.error('Erreur suppression QCM:', error)
    return c.json({ error: 'Erreur lors de la suppression' }, 500)
  }
})

// API - Modifier un QCM existant
app.put('/api/teacher/qcm/:id', async (c) => {
  try {
    const qcmId = c.req.param('id')
    const { titre, specialite, semaine, description, disponible_debut, disponible_fin, date_limite, questions } = await c.req.json()
    const { DB } = c.env

    // Mettre à jour le QCM
    await DB.prepare(`
      UPDATE qcm_weekly 
      SET titre = ?, specialite = ?, semaine = ?, description = ?, 
          disponible_debut = ?, disponible_fin = ?, date_limite = ?
      WHERE id = ?
    `).bind(titre, specialite, semaine, description, disponible_debut, disponible_fin, date_limite, qcmId).run()

    // Supprimer les anciennes questions
    await DB.prepare('DELETE FROM questions WHERE qcm_id = ?').bind(qcmId).run()

    // Créer les nouvelles questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      await DB.prepare(`
        INSERT INTO questions (qcm_id, enonce, option_a, option_b, option_c, option_d, option_e, question_type, reponse_correcte, reponses_correctes, explication, ordre)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(qcmId, q.enonce, q.option_a, q.option_b, q.option_c, q.option_d, q.option_e || null, q.question_type || 'single', q.reponse_correcte || null, q.reponses_correctes || null, q.explication, i + 1).run()
    }

    return c.json({ message: 'QCM modifié avec succès' })
  } catch (error) {
    console.error('Erreur modification QCM:', error)
    return c.json({ error: 'Erreur lors de la modification' }, 500)
  }
})

// ============================================
// ROUTES PAGES HTML
// ============================================

// Page d'accueil
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>OMAS Externat - Réussissez vos examens</title>
        <link href="/static/styles.css" rel="stylesheet">
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body>
        <header class="header">
            <div class="header-content">
                <a href="/" class="logo-container">
                    <div class="logo-icon">
                        <i class="fas fa-graduation-cap"></i>
                    </div>
                    <span class="logo-text">OMAS Externat</span>
                </a>
                <nav class="nav-menu">
                    <a href="/" class="nav-link">Accueil</a>
                    <a href="/qcm" class="nav-link">QH</a>
                    <a href="/faq" class="nav-link">FAQ</a>
                    <a href="/connexion" class="btn-connexion">Connexion</a>
                </nav>
            </div>
        </header>

        <section class="hero">
            <div class="hero-badge">
                <i class="fas fa-check-circle"></i>
                Préparation EDN & ECOS
            </div>
            <h1 class="hero-title">
                Réussissez vos examens avec<br>
                <span class="highlight">OMAS Externat</span>
            </h1>
            <p class="hero-subtitle">
                Accompagnement personnalisé et QCM hebdomadaires pour vous préparer 
                efficacement aux EDN et ECOS. Progressez à votre rythme avec des 
                corrections détaillées.
            </p>
            <div class="hero-buttons">
                <a href="/qcm" class="btn-primary" style="display: inline-block; text-decoration: none; width: auto;">
                    Accéder aux QCM <i class="fas fa-arrow-right"></i>
                </a>
                <a href="/faq" class="btn-secondary">
                    En savoir plus
                </a>
            </div>
            <div class="stats">
                <div class="stat-item">
                    <div class="stat-icon">
                        <i class="fas fa-book-open"></i>
                    </div>
                    <div class="stat-value">500+</div>
                    <div class="stat-label">Questions</div>
                </div>
                <div class="stat-item">
                    <div class="stat-icon">
                        <i class="fas fa-users"></i>
                    </div>
                    <div class="stat-value">200+</div>
                    <div class="stat-label">Étudiants</div>
                </div>
                <div class="stat-item">
                    <div class="stat-icon">
                        <i class="fas fa-trophy"></i>
                    </div>
                    <div class="stat-value">95%</div>
                    <div class="stat-label">Réussite</div>
                </div>
            </div>
        </section>

        <section class="features">
            <h2 class="section-title">Une préparation complète</h2>
            <div class="features-grid">
                <div class="feature-card">
                    <div class="feature-icon">
                        <i class="fas fa-clipboard-list"></i>
                    </div>
                    <h3 class="feature-title">QCM hebdomadaires</h3>
                    <p class="feature-description">
                        Chaque semaine, de nouvelles questions pour vous 
                        entraîner régulièrement et progresser.
                    </p>
                </div>
                <div class="feature-card">
                    <div class="feature-icon">
                        <i class="fas fa-clock"></i>
                    </div>
                    <h3 class="feature-title">Deadlines claires</h3>
                    <p class="feature-description">
                        Travaillez à votre rythme avant la date limite, puis 
                        accédez aux corrections détaillées.
                    </p>
                </div>
                <div class="feature-card">
                    <div class="feature-icon">
                        <i class="fas fa-check-double"></i>
                    </div>
                    <h3 class="feature-title">Corrections complètes</h3>
                    <p class="feature-description">
                        Explications détaillées pour chaque question, avec 
                        références aux recommandations actuelles.
                    </p>
                </div>
                <div class="feature-card">
                    <div class="feature-icon">
                        <i class="fas fa-bullseye"></i>
                    </div>
                    <h3 class="feature-title">Cible EDN & ECOS</h3>
                    <p class="feature-description">
                        Questions conçues spécifiquement pour les formats 
                        des examens nationaux.
                    </p>
                </div>
                <div class="feature-card">
                    <div class="feature-icon">
                        <i class="fas fa-file-medical"></i>
                    </div>
                    <h3 class="feature-title">Toutes spécialités</h3>
                    <p class="feature-description">
                        Couverture complète du programme : cardiologie, 
                        pneumologie, neurologie, et plus.
                    </p>
                </div>
                <div class="feature-card">
                    <div class="feature-icon">
                        <i class="fas fa-headset"></i>
                    </div>
                    <h3 class="feature-title">Accompagnement</h3>
                    <p class="feature-description">
                        Notre équipe vous accompagne dans votre 
                        préparation tout au long de l'année.
                    </p>
                </div>
            </div>
        </section>

        <footer class="footer">
            <div class="footer-content">
                <div class="footer-logo">
                    <div class="logo-icon" style="width: 35px; height: 35px; font-size: 1.25rem;">
                        <i class="fas fa-graduation-cap"></i>
                    </div>
                    <span class="logo-text">OMAS Externat</span>
                </div>
                <div class="footer-links">
                    <a href="/" class="nav-link">Accueil</a>
                    <a href="/qcm" class="nav-link">QCM</a>
                    <a href="/faq" class="nav-link">FAQ</a>
                </div>
                <div class="footer-text">
                    © 2025 OMAS Externat. Tous droits réservés.
                </div>
            </div>
        </footer>

        <script src="/static/app.js"></script>
        <script src="/static/header-init.js"></script>
    </body>
    </html>
  `)
})

// Page de connexion/inscription
app.get('/connexion', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Connexion - OMAS Externat</title>
        <link href="/static/styles.css" rel="stylesheet">
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body>
        <div class="login-container">
            <div class="login-card">
                <div class="login-logo">
                    <div class="logo-icon" style="width: 50px; height: 50px; font-size: 1.75rem;">
                        <i class="fas fa-graduation-cap"></i>
                    </div>
                </div>
                <h2 class="login-title">OMAS Externat</h2>
                <p class="login-subtitle">Connectez-vous pour accéder à votre espace</p>
                
                <div class="tabs">
                    <button class="tab active" data-tab="login-tab">Connexion</button>
                    <button class="tab" data-tab="register-tab">Inscription</button>
                </div>

                <div id="login-tab" class="tab-content active">
                    <form id="login-form">
                        <div class="form-group">
                            <label class="form-label">Email</label>
                            <input type="email" name="email" class="form-input" placeholder="votre@email.com" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Mot de passe</label>
                            <input type="password" name="password" class="form-input" placeholder="••••••••" required>
                        </div>
                        <button type="submit" class="btn-primary">Se connecter</button>
                    </form>
                </div>

                <div id="register-tab" class="tab-content" style="display: none;">
                    <form id="register-form">
                        <div class="form-group">
                            <label class="form-label">Je suis :</label>
                            <div style="display: flex; gap: 1rem; margin-top: 0.5rem;">
                                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                    <input type="radio" name="role" value="student" checked style="cursor: pointer;">
                                    <span>Étudiant</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                    <input type="radio" name="role" value="teacher" style="cursor: pointer;">
                                    <span>Enseignant</span>
                                </label>
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Nom</label>
                            <input type="text" name="nom" class="form-input" placeholder="Dupont" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Prénom</label>
                            <input type="text" name="prenom" class="form-input" placeholder="Marie" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Email</label>
                            <input type="email" name="email" class="form-input" placeholder="votre@email.com" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Mot de passe</label>
                            <input type="password" name="password" class="form-input" placeholder="••••••••" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Confirmer le mot de passe</label>
                            <input type="password" name="confirmPassword" class="form-input" placeholder="••••••••" required>
                        </div>
                        <button type="submit" class="btn-primary">S'inscrire</button>
                    </form>
                </div>
            </div>
        </div>

        <script src="/static/app.js"></script>
        <script src="/static/header-init.js"></script>
    </body>
    </html>
  `)
})

// Page QCM Hebdomadaires
app.get('/qcm', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>QCM Hebdomadaires - OMAS Externat</title>
        <link href="/static/styles.css" rel="stylesheet">
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body>
        <header class="header">
            <div class="header-content">
                <a href="/" class="logo-container">
                    <div class="logo-icon">
                        <i class="fas fa-graduation-cap"></i>
                    </div>
                    <span class="logo-text">OMAS Externat</span>
                </a>
                <nav class="nav-menu">
                    <a href="/" class="nav-link">Accueil</a>
                    <a href="/qcm" class="nav-link">QH</a>
                    <a href="/faq" class="nav-link">FAQ</a>
                    <a href="/connexion" class="btn-connexion">Connexion</a>
                </nav>
            </div>
        </header>

        <section style="padding: 2rem; max-width: 1400px; margin: 0 auto;">
            <h1 style="text-align: center; font-size: 2rem; margin-bottom: 0.5rem; color: var(--gray-dark);">
                QCM Hebdomadaires
            </h1>
            <p style="text-align: center; color: var(--gray-dark); margin-bottom: 3rem;">
                Entraînez-vous chaque semaine avec nos questions ciblées EDN & ECOS
            </p>
            
            <div id="qcm-list" class="qcm-grid">
                <div style="text-align: center; padding: 2rem;">
                    <div class="spinner"></div>
                    <p style="margin-top: 1rem;">Chargement des QCM...</p>
                </div>
            </div>
        </section>

        <footer class="footer">
            <div class="footer-content">
                <div class="footer-logo">
                    <div class="logo-icon" style="width: 35px; height: 35px; font-size: 1.25rem;">
                        <i class="fas fa-graduation-cap"></i>
                    </div>
                    <span class="logo-text">OMAS Externat</span>
                </div>
                <div class="footer-links">
                    <a href="/" class="nav-link">Accueil</a>
                    <a href="/qcm" class="nav-link">QCM</a>
                    <a href="/faq" class="nav-link">FAQ</a>
                </div>
                <div class="footer-text">
                    © 2025 OMAS Externat. Tous droits réservés.
                </div>
            </div>
        </footer>

        <script src="/static/app.js"></script>
        <script src="/static/header-init.js"></script>
    </body>
    </html>
  `)
})

// Page FAQ
app.get('/faq', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>FAQ - OMAS Externat</title>
        <link href="/static/styles.css" rel="stylesheet">
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body>
        <header class="header">
            <div class="header-content">
                <a href="/" class="logo-container">
                    <div class="logo-icon">
                        <i class="fas fa-graduation-cap"></i>
                    </div>
                    <span class="logo-text">OMAS Externat</span>
                </a>
                <nav class="nav-menu">
                    <a href="/" class="nav-link">Accueil</a>
                    <a href="/qcm" class="nav-link">QH</a>
                    <a href="/faq" class="nav-link">FAQ</a>
                    <a href="/connexion" class="btn-connexion">Connexion</a>
                </nav>
            </div>
        </header>

        <section style="padding: 3rem 2rem;">
            <h1 style="text-align: center; font-size: 2rem; margin-bottom: 0.5rem;">
                Foire Aux Questions
            </h1>
            <p style="text-align: center; color: var(--gray-dark); margin-bottom: 3rem;">
                Retrouvez les réponses aux questions les plus fréquentes sur OMAS Externat
            </p>

            <div class="faq-container">
                <div class="faq-item">
                    <button class="faq-question">
                        Qu'est-ce qu'OMAS Externat ?
                        <i class="fas fa-chevron-down"></i>
                    </button>
                    <div class="faq-answer">
                        OMAS Externat est une plateforme de préparation aux examens de l'externat 
                        de médecine (EDN et ECOS). Nous proposons des QCM hebdomadaires avec des 
                        corrections détaillées pour vous aider à progresser efficacement.
                    </div>
                </div>

                <div class="faq-item">
                    <button class="faq-question">
                        Comment fonctionnent les QCM hebdomadaires ?
                        <i class="fas fa-chevron-down"></i>
                    </button>
                    <div class="faq-answer">
                        Chaque semaine, un nouveau QCM thématique est disponible. Vous avez jusqu'à 
                        la date limite pour le compléter. Après la deadline, les corrections détaillées 
                        avec explications sont accessibles pour tous les étudiants.
                    </div>
                </div>

                <div class="faq-item">
                    <button class="faq-question">
                        Les QCM sont-ils adaptés au format des EDN ?
                        <i class="fas fa-chevron-down"></i>
                    </button>
                    <div class="faq-answer">
                        Oui, nos questions sont spécifiquement conçues pour correspondre au format 
                        des Épreuves Dématérialisées Nationales. Elles respectent les recommandations 
                        actuelles et couvrent l'ensemble du programme.
                    </div>
                </div>

                <div class="faq-item">
                    <button class="faq-question">
                        Puis-je accéder aux corrections avant la date limite ?
                        <i class="fas fa-chevron-down"></i>
                    </button>
                    <div class="faq-answer">
                        Non, les corrections sont débloquées uniquement après la date limite du QCM. 
                        Cela permet à tous les étudiants de travailler dans les mêmes conditions et 
                        de maximiser l'apprentissage.
                    </div>
                </div>

                <div class="faq-item">
                    <button class="faq-question">
                        Quelles spécialités sont couvertes ?
                        <i class="fas fa-chevron-down"></i>
                    </button>
                    <div class="faq-answer">
                        Nous couvrons toutes les spécialités du programme : cardiologie, pneumologie, 
                        neurologie, gastro-entérologie, néphrologie, endocrinologie, et bien d'autres. 
                        Les QCM alternent chaque semaine pour assurer une révision complète.
                    </div>
                </div>

                <div class="faq-item">
                    <button class="faq-question">
                        Comment puis-je rejoindre OMAS Externat ?
                        <i class="fas fa-chevron-down"></i>
                    </button>
                    <div class="faq-answer">
                        Il vous suffit de créer un compte via la page d'inscription. L'inscription 
                        est simple et rapide. Une fois inscrit, vous aurez immédiatement accès à 
                        tous les QCM disponibles.
                    </div>
                </div>

                <div class="faq-item">
                    <button class="faq-question">
                        Les anciennes questions restent-elles accessibles ?
                        <i class="fas fa-chevron-down"></i>
                    </button>
                    <div class="faq-answer">
                        Oui, après leur date limite, tous les QCM restent accessibles avec leurs 
                        corrections. Vous pouvez les consulter à tout moment pour réviser.
                    </div>
                </div>

                <div class="faq-item">
                    <button class="faq-question">
                        Y a-t-il un suivi de ma progression ?
                        <i class="fas fa-chevron-down"></i>
                    </button>
                    <div class="faq-answer">
                        Oui, votre espace étudiant vous permet de suivre vos résultats, vos scores 
                        pour chaque QCM, et votre progression globale au fil des semaines.
                    </div>
                </div>
            </div>
        </section>

        <footer class="footer">
            <div class="footer-content">
                <div class="footer-logo">
                    <div class="logo-icon" style="width: 35px; height: 35px; font-size: 1.25rem;">
                        <i class="fas fa-graduation-cap"></i>
                    </div>
                    <span class="logo-text">OMAS Externat</span>
                </div>
                <div class="footer-links">
                    <a href="/" class="nav-link">Accueil</a>
                    <a href="/qcm" class="nav-link">QCM</a>
                    <a href="/faq" class="nav-link">FAQ</a>
                </div>
                <div class="footer-text">
                    © 2025 OMAS Externat. Tous droits réservés.
                </div>
            </div>
        </footer>

        <script src="/static/app.js"></script>
        <script src="/static/header-init.js"></script>
    </body>
    </html>
  `)
})

// Page détail QCM
app.get('/qcm/:id', async (c) => {
  const qcmId = c.req.param('id')
  
  return c.html(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>QCM - OMAS Externat</title>
        <link href="/static/styles.css" rel="stylesheet">
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <style>
            .qcm-header-full {
                background-color: var(--white);
                padding: 2rem;
                margin-bottom: 2rem;
                border-radius: 12px;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            }
            .qcm-meta {
                display: flex;
                gap: 2rem;
                margin-top: 1rem;
                color: var(--gray-dark);
            }
            .questions-container {
                max-width: 900px;
                margin: 0 auto;
            }
            .question-card {
                background-color: var(--white);
                padding: 2rem;
                margin-bottom: 2rem;
                border-radius: 12px;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            }
            .question-number {
                display: inline-block;
                background-color: var(--teal-primary);
                color: var(--white);
                padding: 0.5rem 1rem;
                border-radius: 6px;
                font-weight: 600;
                margin-bottom: 1rem;
            }
            .question-text {
                font-size: 1.1rem;
                font-weight: 600;
                margin-bottom: 1.5rem;
                line-height: 1.6;
            }
            .options {
                margin-bottom: 1.5rem;
            }
            .option {
                display: flex;
                align-items: start;
                gap: 0.75rem;
                padding: 0.75rem;
                margin-bottom: 0.5rem;
                border-radius: 6px;
                transition: background-color 0.2s;
            }
            .option:hover {
                background-color: var(--gray-light);
            }
            .option input[type="radio"] {
                margin-top: 0.25rem;
            }
            .option label {
                flex: 1;
                cursor: pointer;
            }
            .answer-section {
                margin-top: 1.5rem;
                padding: 1.5rem;
                background-color: var(--teal-light);
                border-radius: 8px;
                border-left: 4px solid var(--teal-primary);
            }
            .correct-answer {
                margin-bottom: 1rem;
                color: var(--teal-dark);
                font-weight: 600;
            }
            .explanation {
                color: var(--gray-dark);
                line-height: 1.7;
            }
            .btn-show-answer {
                background-color: var(--teal-primary);
                color: var(--white);
                padding: 0.75rem 1.5rem;
                border: none;
                border-radius: 6px;
                font-weight: 600;
                cursor: pointer;
                transition: background-color 0.2s;
            }
            .btn-show-answer:hover {
                background-color: var(--teal-dark);
            }
        </style>
    </head>
    <body>
        <header class="header">
            <div class="header-content">
                <a href="/" class="logo-container">
                    <div class="logo-icon">
                        <i class="fas fa-graduation-cap"></i>
                    </div>
                    <span class="logo-text">OMAS Externat</span>
                </a>
                <nav class="nav-menu">
                    <a href="/" class="nav-link">Accueil</a>
                    <a href="/qcm" class="nav-link">QH</a>
                    <a href="/faq" class="nav-link">FAQ</a>
                    <a href="/connexion" class="btn-connexion">Connexion</a>
                </nav>
            </div>
        </header>

        <div style="padding: 2rem; max-width: 1200px; margin: 0 auto;">
            <div id="qcm-content">
                <div style="text-align: center; padding: 3rem;">
                    <div class="spinner"></div>
                    <p style="margin-top: 1rem;">Chargement du QCM...</p>
                </div>
            </div>
        </div>

        <footer class="footer">
            <div class="footer-content">
                <div class="footer-logo">
                    <div class="logo-icon" style="width: 35px; height: 35px; font-size: 1.25rem;">
                        <i class="fas fa-graduation-cap"></i>
                    </div>
                    <span class="logo-text">OMAS Externat</span>
                </div>
                <div class="footer-links">
                    <a href="/" class="nav-link">Accueil</a>
                    <a href="/qcm" class="nav-link">QCM</a>
                    <a href="/faq" class="nav-link">FAQ</a>
                </div>
                <div class="footer-text">
                    © 2025 OMAS Externat. Tous droits réservés.
                </div>
            </div>
        </footer>

        <script src="/static/app.js"></script>
        <script src="/static/header-init.js"></script>
        <script>
            // Charger le QCM au chargement de la page
            document.addEventListener('DOMContentLoaded', () => {
                loadQCM(${qcmId});
            });
        </script>
    </body>
    </html>
  `)
})

// Page Dashboard Étudiant
app.get('/espace-etudiant', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Mon Espace - OMAS Externat</title>
        <link href="/static/styles.css" rel="stylesheet">
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    </head>
    <body>
        <header class="header">
            <div class="header-content">
                <a href="/" class="logo-container">
                    <div class="logo-icon">
                        <i class="fas fa-graduation-cap"></i>
                    </div>
                    <span class="logo-text">OMAS Externat</span>
                </a>
                <nav class="nav-menu">
                    <a href="/espace-etudiant" class="nav-link">Mon Espace</a>
                    <a href="/qcm" class="nav-link">QH</a>
                    <a href="/faq" class="nav-link">FAQ</a>
                    <span class="nav-link" id="user-name-display" style="color: var(--teal-primary); font-weight: 600;">
                        <i class="fas fa-user-circle"></i> <span id="user-name">Profil</span>
                    </span>
                    <a href="#" class="nav-link" onclick="logout(); return false;">
                        <i class="fas fa-sign-out-alt"></i> Déconnexion
                    </a>
                </nav>
            </div>
        </header>

        <main class="main-content">
            <div class="dashboard-container">
                <div class="dashboard-header">
                    <h1><i class="fas fa-chart-line"></i> Mon Tableau de Bord</h1>
                    <p class="dashboard-subtitle">Suivez votre progression et vos performances</p>
                </div>

                <!-- Stats globales -->
                <div id="global-stats" class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-icon" style="background: linear-gradient(135deg, var(--primary-color), var(--dark-teal));">
                            <i class="fas fa-check-circle"></i>
                        </div>
                        <div class="stat-content">
                            <div class="stat-value" id="total-qcm">0</div>
                            <div class="stat-label">QCM Complétés</div>
                        </div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-icon" style="background: linear-gradient(135deg, #27ae60, #229954);">
                            <i class="fas fa-percentage"></i>
                        </div>
                        <div class="stat-content">
                            <div class="stat-value" id="avg-score">0%</div>
                            <div class="stat-label">Score Moyen</div>
                        </div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-icon" style="background: linear-gradient(135deg, #f39c12, #e67e22);">
                            <i class="fas fa-star"></i>
                        </div>
                        <div class="stat-content">
                            <div class="stat-value" id="best-subject">-</div>
                            <div class="stat-label">Meilleure Matière</div>
                        </div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-icon" style="background: linear-gradient(135deg, #e74c3c, #c0392b);">
                            <i class="fas fa-exclamation-triangle"></i>
                        </div>
                        <div class="stat-content">
                            <div class="stat-value" id="weak-subject">-</div>
                            <div class="stat-label">À Améliorer</div>
                        </div>
                    </div>
                </div>

                <!-- Graphique radar -->
                <div class="chart-container">
                    <h2><i class="fas fa-chart-radar"></i> Performance par Matière</h2>
                    <div class="chart-wrapper">
                        <canvas id="radarChart"></canvas>
                    </div>
                    <p class="chart-note">
                        <i class="fas fa-info-circle"></i> 
                        Ce graphique radar montre vos performances dans chaque spécialité médicale
                    </p>
                </div>

                <!-- Liste des QCM complétés -->
                <div class="recent-qcm-container">
                    <h2><i class="fas fa-history"></i> Mes Derniers QCM</h2>
                    <div id="recent-qcm-list">
                        <div class="loading-spinner">
                            <i class="fas fa-spinner fa-spin"></i> Chargement...
                        </div>
                    </div>
                </div>
            </div>
        </main>

        <footer class="footer">
            <div class="footer-content">
                <div class="footer-logo">OMAS Externat</div>
                <div class="footer-links">
                    <a href="/">Accueil</a>
                    <a href="/qcm">QCM</a>
                </div>
                <div class="footer-copyright">© 2026 OMAS Externat. Tous droits réservés.</div>
            </div>
        </footer>

        <script src="/static/app.js"></script>
        <script src="/static/header-init.js"></script>
        <script src="/static/student-dashboard.js"></script>
    </body>
    </html>
  `)
})

// Page Dashboard Enseignant
app.get('/dashboard-enseignant', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Dashboard Enseignant - OMAS Externat</title>
        <link href="/static/styles.css" rel="stylesheet">
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body>
        <header class="header">
            <div class="header-content">
                <a href="/" class="logo-container">
                    <div class="logo-icon">
                        <i class="fas fa-graduation-cap"></i>
                    </div>
                    <span class="logo-text">OMAS Externat</span>
                </a>
                <nav class="nav-menu">
                    <a href="/dashboard-enseignant" class="nav-link">Mes QCM</a>
                    <a href="/creer-qcm" class="nav-link">Créer un QCM</a>
                    <a href="/" class="nav-link">Accueil</a>
                    <span class="nav-link" id="user-name-display" style="color: var(--teal-primary); font-weight: 600;">
                        <i class="fas fa-user-circle"></i> <span id="user-name">Profil</span>
                    </span>
                    <a href="#" class="nav-link" onclick="logout(); return false;">
                        <i class="fas fa-sign-out-alt"></i> Déconnexion
                    </a>
                </nav>
            </div>
        </header>

        <div class="teacher-dashboard">
            <div class="dashboard-header">
                <h1 class="dashboard-title">Mes QCM</h1>
                <a href="/creer-qcm" class="btn-primary" style="display: inline-flex; align-items: center; gap: 0.5rem; width: auto; text-decoration: none;">
                    <i class="fas fa-plus"></i> Créer un nouveau QCM
                </a>
            </div>

            <div id="teacher-qcm-list" class="teacher-qcm-grid">
                <div style="text-align: center; padding: 3rem; grid-column: 1/-1;">
                    <div class="spinner"></div>
                    <p style="margin-top: 1rem;">Chargement de vos QCM...</p>
                </div>
            </div>
        </div>

        <script src="/static/app.js"></script>
        <script src="/static/header-init.js"></script>
        <script src="/static/teacher.js"></script>
    </body>
    </html>
  `)
})

// Page Création de QCM
app.get('/creer-qcm', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Créer un QCM - OMAS Externat</title>
        <link href="/static/styles.css" rel="stylesheet">
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body>
        <header class="header">
            <div class="header-content">
                <a href="/" class="logo-container">
                    <div class="logo-icon">
                        <i class="fas fa-graduation-cap"></i>
                    </div>
                    <span class="logo-text">OMAS Externat</span>
                </a>
                <nav class="nav-menu">
                    <a href="/dashboard-enseignant" class="nav-link">Mes QCM</a>
                    <a href="/creer-qcm" class="nav-link">Créer un QCM</a>
                    <a href="/" class="nav-link">Accueil</a>
                    <span class="nav-link" id="user-name-display" style="color: var(--teal-primary); font-weight: 600;">
                        <i class="fas fa-user-circle"></i> <span id="user-name">Profil</span>
                    </span>
                    <a href="#" class="nav-link" onclick="logout(); return false;">
                        <i class="fas fa-sign-out-alt"></i> Déconnexion
                    </a>
                </nav>
            </div>
        </header>

        <div class="create-qcm-container">
            <h1 class="dashboard-title" style="margin-bottom: 2rem;">Créer un nouveau QCM</h1>

            <form id="create-qcm-form">
                <!-- Informations générales -->
                <div class="form-section">
                    <h3 class="form-section-title">Informations générales</h3>
                    
                    <div class="form-group">
                        <label class="form-label">Titre du QCM *</label>
                        <input type="text" name="titre" class="form-input" required
                          placeholder="Ex: Cardiologie - Insuffisance cardiaque">
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Spécialité *</label>
                            <select name="specialite" class="form-input" required>
                                <option value="">Sélectionner...</option>
                                <option value="Cardiologie">Cardiologie</option>
                                <option value="Pneumologie">Pneumologie</option>
                                <option value="Neurologie">Neurologie</option>
                                <option value="Gastro-entérologie">Gastro-entérologie</option>
                                <option value="Néphrologie">Néphrologie</option>
                                <option value="Endocrinologie">Endocrinologie</option>
                                <option value="Hématologie">Hématologie</option>
                                <option value="Rhumatologie">Rhumatologie</option>
                                <option value="Dermatologie">Dermatologie</option>
                                <option value="ORL">ORL</option>
                                <option value="Ophtalmologie">Ophtalmologie</option>
                                <option value="Pédiatrie">Pédiatrie</option>
                                <option value="Gynécologie-Obstétrique">Gynécologie-Obstétrique</option>
                                <option value="Psychiatrie">Psychiatrie</option>
                                <option value="Infectiologie">Infectiologie</option>
                                <option value="Autre">Autre</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label class="form-label">Semaine *</label>
                            <input type="number" name="semaine" class="form-input" min="1" max="52" required
                              placeholder="1-52">
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Description</label>
                        <textarea name="description" class="form-input" rows="3"
                          placeholder="Décrivez brièvement le contenu de ce QCM..."></textarea>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Disponible à partir du *</label>
                            <input type="date" name="disponible_debut" class="form-input" required>
                        </div>

                        <div class="form-group">
                            <label class="form-label">Disponible jusqu'au *</label>
                            <input type="date" name="disponible_fin" class="form-input" required>
                        </div>

                        <div class="form-group">
                            <label class="form-label">Date limite *</label>
                            <input type="date" name="date_limite" class="form-input" required>
                        </div>
                    </div>
                </div>

                <!-- Questions -->
                <div class="form-section">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                        <h3 class="form-section-title" style="margin: 0; border: none; padding: 0;">Questions</h3>
                        <button type="button" id="add-question-btn" class="btn-add-question">
                            <i class="fas fa-plus"></i> Ajouter une question
                        </button>
                    </div>

                    <div id="questions-container"></div>
                </div>

                <!-- Actions -->
                <div class="form-actions">
                    <a href="/dashboard-enseignant" class="btn-cancel">Annuler</a>
                    <button type="submit" class="btn-primary" style="width: auto;">
                        <i class="fas fa-save"></i> Créer le QCM
                    </button>
                </div>
            </form>
        </div>

        <script src="/static/app.js"></script>
        <script src="/static/header-init.js"></script>
        <script src="/static/teacher.js"></script>
    </body>
    </html>
  `)
})

export default app
