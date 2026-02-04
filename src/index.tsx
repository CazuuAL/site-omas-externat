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
    const { nom, prenom, email, password } = await c.req.json()
    const { DB } = c.env

    // Validation simple
    if (!nom || !prenom || !email || !password) {
      return c.json({ error: 'Tous les champs sont requis' }, 400)
    }

    if (password.length < 6) {
      return c.json({ error: 'Le mot de passe doit contenir au moins 6 caractères' }, 400)
    }

    // Vérifier si l'email existe déjà
    const existing = await DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(email).first()

    if (existing) {
      return c.json({ error: 'Cet email est déjà utilisé' }, 400)
    }

    // Créer l'utilisateur (en production, utiliser bcrypt pour le hash)
    const result = await DB.prepare(
      'INSERT INTO users (email, password_hash, nom, prenom) VALUES (?, ?, ?, ?)'
    ).bind(email, password, nom, prenom).run()

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
      'SELECT id, email, nom, prenom, password_hash FROM users WHERE email = ?'
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
        prenom: user.prenom
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

// API - Liste des QCM hebdomadaires
app.get('/api/qcm/list', async (c) => {
  try {
    const { DB } = c.env

    const qcms = await DB.prepare(`
      SELECT id, titre, specialite, semaine, description, 
             disponible_debut, disponible_fin, date_limite
      FROM qcm_weekly
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
                <a href="/qcm" class="btn-primary" style="display: inline-block; text-decoration: none;">
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

export default app
