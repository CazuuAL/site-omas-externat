import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'

// Fonction utilitaire pour envoyer des emails via Resend
async function sendEmail(to: string, subject: string, html: string, apiKey?: string) {
  // Si pas de clé API, simuler l'envoi (mode développement)
  if (!apiKey) {
    console.log(`📧 [SIMULATION] Email à envoyer:
      À: ${to}
      Sujet: ${subject}
      HTML: ${html.substring(0, 100)}...
    `);
    return { success: true, id: 'simulated-' + Date.now() };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'OMAS Externat <onboarding@resend.dev>', // Domain vérifié par défaut de Resend
        to: [to],
        subject: subject,
        html: html
      })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ Erreur envoi email:', result);
      return { success: false, error: result.message || 'Erreur envoi email' };
    }

    console.log('✅ Email envoyé avec succès:', { to, id: result.id });
    return { success: true, id: result.id };

  } catch (error) {
    console.error('❌ Erreur lors de l\'envoi email:', error);
    return { success: false, error: error.message };
  }
}

// Fonction pour générer le template HTML de confirmation
function generateConfirmationEmailHtml(nom: string, prenom: string, confirmationUrl: string) {
  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Confirmation d'inscription - OMAS Externat</title>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; }
            .header { background: linear-gradient(135deg, #0f7c8c, #0a5d6a); color: white; padding: 2rem; text-align: center; }
            .logo { font-size: 1.5rem; font-weight: bold; margin-bottom: 0.5rem; }
            .content { padding: 2rem; }
            .welcome { font-size: 1.2rem; margin-bottom: 1rem; color: #0f7c8c; }
            .button { display: inline-block; background: linear-gradient(135deg, #0f7c8c, #0a5d6a); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 1.5rem 0; }
            .button:hover { background: linear-gradient(135deg, #0a5d6a, #0f7c8c); }
            .footer { background-color: #f8f9fa; padding: 1rem; text-align: center; font-size: 0.9rem; color: #666; border-top: 1px solid #dee2e6; }
            .warning { background-color: #fff3cd; border: 1px solid #ffeeba; color: #856404; padding: 1rem; border-radius: 6px; margin: 1rem 0; }
            .highlight { color: #0f7c8c; font-weight: 600; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">🎓 OMAS Externat</div>
                <p>Plateforme de préparation EDN & ECOS</p>
            </div>
            
            <div class="content">
                <h2 class="welcome">Bienvenue ${prenom} ${nom} ! 👋</h2>
                
                <p>Votre inscription sur <strong>OMAS Externat</strong> a été réalisée avec succès.</p>
                
                <p>Pour activer votre compte et accéder à la plateforme, cliquez sur le bouton ci-dessous :</p>
                
                <div style="text-align: center;">
                    <a href="${confirmationUrl}" class="button">
                        ✅ Confirmer mon inscription
                    </a>
                </div>
                
                <div class="warning">
                    <strong>⚠️ Important :</strong>
                    <ul>
                        <li>Ce lien est valide pendant <span class="highlight">24 heures</span></li>
                        <li>Après confirmation, vous pourrez accéder aux QCM hebdomadaires</li>
                        <li>Conservez vos identifiants de connexion en sécurité</li>
                    </ul>
                </div>
                
                <p>Si vous n'arrivez pas à cliquer sur le bouton, copiez-collez ce lien dans votre navigateur :</p>
                <p style="word-break: break-all; background-color: #f8f9fa; padding: 1rem; border-radius: 4px; font-family: monospace;">
                    ${confirmationUrl}
                </p>
                
                <p>Si vous n'êtes pas à l'origine de cette inscription, vous pouvez ignorer cet email.</p>
            </div>
            
            <div class="footer">
                <p><strong>OMAS Externat</strong> - Préparation EDN & ECOS</p>
                <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
                <p style="font-size: 0.8rem; color: #999;">
                    Besoin d'aide ? Contactez l'administration de votre établissement.
                </p>
            </div>
        </div>
    </body>
    </html>
  `;
}

type Bindings = {
  DB: D1Database
  RESEND_API_KEY?: string // Clé API Resend optionnelle
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
    const { nom, prenom, email, password, telephone, niveau, faculte, role } = await c.req.json()
    const { DB } = c.env

    // Validation simple
    if (!nom || !prenom || !email || !password || !telephone || !faculte) {
      return c.json({ error: 'Tous les champs sont requis' }, 400)
    }

    if (password.length < 6) {
      return c.json({ error: 'Le mot de passe doit contenir au moins 6 caractères' }, 400)
    }

    // Forcer le rôle étudiant (plus d'inscription enseignant directe)
    const userRole = 'student'
    
    // Validation niveau obligatoire pour étudiants
    if (!niveau) {
      return c.json({ error: 'Le niveau d\'études est requis' }, 400)
    }
    
    // Valider le niveau
    const validNiveaux = ['DFGSM2', 'DFGSM3', 'DFASM1', 'DFASM2', 'DFASM3']
    if (!validNiveaux.includes(niveau)) {
      return c.json({ error: 'Niveau d\'études invalide' }, 400)
    }
    
    // Valider la faculté
    const validFacultes = [
      'Sorbonne Université',
      'Université Paris Cité',
      'Sorbonne Université Paris Nord',
      'Université Paris-Est Créteil',
      'Université Paris-Saclay',
      'Université de Versailles Saint-Quentin (UVSQ)',
      'Université de Tours',
      'Université d\'Orléans',
      'Université d\'Aix-Marseille',
      'Université de Montpellier',
      'Université Côte d\'Azur (Nice)',
      'Université de Toulouse',
      'Université de Bordeaux',
      'Université de Reims Champagne-Ardenne',
      'Université de Rouen Normandie'
    ]
    if (!validFacultes.includes(faculte)) {
      return c.json({ error: 'Faculté invalide' }, 400)
    }
    
    // Valider le format du téléphone (français)
    const phoneRegex = /^(?:(?:\+33|0)[1-9](?:[0-9]{8}))$/
    const cleanPhone = telephone.replace(/\s/g, '') // Supprimer les espaces
    if (!phoneRegex.test(cleanPhone)) {
      return c.json({ error: 'Format de téléphone invalide' }, 400)
    }

    // Vérifier si l'email existe déjà
    const existingEmail = await DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(email).first()

    if (existingEmail) {
      return c.json({ error: 'Cet email est déjà utilisé' }, 400)
    }
    
    // Vérifier si le téléphone existe déjà
    const existingPhone = await DB.prepare(
      'SELECT id FROM users WHERE telephone = ?'
    ).bind(cleanPhone).first()

    if (existingPhone) {
      return c.json({ error: 'Ce numéro de téléphone est déjà utilisé' }, 400)
    }

    // Créer l'utilisateur (en attente de validation par l'admin)
    const result = await DB.prepare(
      `INSERT INTO users (
        email, password_hash, nom, prenom, telephone, niveau, faculte, role, account_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      email, password, nom, prenom, cleanPhone, niveau, faculte, userRole, 'pending'
    ).run()

    console.log('✅ Nouvel utilisateur inscrit (en attente de validation):', { 
      id: result.meta.last_row_id, 
      email, 
      nom, 
      prenom, 
      niveau,
      faculte,
      status: 'pending'
    })

    return c.json({ 
      message: 'Inscription réussie ! Votre compte sera activé par un administrateur sous 48h.',
      requiresApproval: true,
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
      'SELECT id, email, nom, prenom, password_hash, role, account_status FROM users WHERE email = ?'
    ).bind(email).first()

    // Cas spécial pour le super admin temporaire
    if (email === 'admin@omasexternat.fr' && password === 'superadmin123') {
      // Connexion super admin simulée
      const superUser = {
        id: 999,
        email: 'admin@omasexternat.fr',
        nom: 'Administrateur',
        prenom: 'Système',
        password_hash: 'superadmin123',
        role: 'super_admin'
      }
      
      return c.json({
        token: `token_${superUser.id}_${Date.now()}`,
        user: {
          id: superUser.id,
          email: superUser.email,
          nom: superUser.nom,
          prenom: superUser.prenom,
          role: superUser.role
        }
      })
    }

    if (!user || user.password_hash !== password) {
      return c.json({ error: 'Email ou mot de passe incorrect' }, 401)
    }

    // Vérifier si le compte est approuvé (sauf pour le super admin)
    if (user.role !== 'super_admin' && user.email !== 'admin@omasexternat.fr' && user.account_status !== 'approved') {
      if (user.account_status === 'pending') {
        return c.json({ 
          error: 'Votre compte est en attente de validation par un administrateur.',
          requiresApproval: true
        }, 403)
      } else if (user.account_status === 'rejected') {
        return c.json({ 
          error: 'Votre demande d\'inscription a été rejetée. Contactez l\'administration.',
          accountRejected: true
        }, 403)
      }
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
             disponible_debut, disponible_fin, date_limite, is_dossier_progressif
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
// ROUTES API - QROC (Questions à Réponse Ouverte Courte)
// ============================================

// API - Créer une question QROC
app.post('/api/teacher/qroc/create', async (c) => {
  try {
    const body = await c.req.json()
    console.log('📝 Données reçues pour QROC:', JSON.stringify(body, null, 2))
    
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
    
    console.log('✅ Validation QROC OK, nombre de questions:', questions.length)

    // Créer le QCM
    const qcmResult = await DB.prepare(`
      INSERT INTO qcm_weekly (titre, specialite, semaine, description, disponible_debut, disponible_fin, date_limite, created_by, is_published)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
    `).bind(titre, specialite, semaine, description, disponible_debut, disponible_fin, date_limite, created_by).run()

    const qcmId = qcmResult.meta.last_row_id
    console.log('✅ QROC créé avec ID:', qcmId)

    // Créer les questions QROC
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      console.log(`📝 Traitement question QROC ${i + 1}:`, q)
      
      try {
        await DB.prepare(`
          INSERT INTO questions (
            qcm_id, enonce, 
            option_a, option_b, option_c, option_d, option_e, 
            question_type, reponse_correcte, reponses_correctes, 
            reponse_attendue, image_url, zones_cliquables,
            explication, ordre
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          qcmId, 
          q.enonce,
          null, // option_a - null pour QROC
          null, // option_b - null pour QROC
          null, // option_c - null pour QROC
          null, // option_d - null pour QROC
          null, // option_e - null pour QROC
          'qroc', // question_type
          null, // reponse_correcte - null pour QROC
          null, // reponses_correctes - null pour QROC
          q.reponse_attendue || null,
          null, // image_url - null pour QROC
          null, // zones_cliquables - null pour QROC
          q.explication, 
          i + 1
        ).run()
        
        console.log(`✅ Question QROC ${i + 1} créée avec succès`)
      } catch (questionError) {
        console.error(`❌ Erreur lors de la création de la question QROC ${i + 1}:`, questionError)
        throw questionError
      }
    }

    return c.json({ 
      message: 'QROC créé avec succès',
      qcmId: qcmId 
    }, 201)
  } catch (error) {
    console.error('Erreur création QROC:', error)
    return c.json({ error: 'Erreur lors de la création du QROC', details: error.message }, 500)
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
    
    const { titre, specialite, semaine, description, disponible_debut, disponible_fin, date_limite, created_by, questions, is_dossier_progressif, contexte_initial } = body
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
      INSERT INTO qcm_weekly (titre, specialite, semaine, description, disponible_debut, disponible_fin, date_limite, created_by, is_published, is_dossier_progressif, contexte_initial)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).bind(titre, specialite, semaine, description, disponible_debut, disponible_fin, date_limite, created_by, is_dossier_progressif || false, contexte_initial || null).run()

    const qcmId = qcmResult.meta.last_row_id
    console.log('✅ QCM créé avec ID:', qcmId)

    // Créer les questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      console.log(`📝 Traitement question ${i + 1}:`, q)
      
      try {
        await DB.prepare(`
          INSERT INTO questions (
            qcm_id, enonce, 
            option_a, option_b, option_c, option_d, option_e, 
            question_type, reponse_correcte, reponses_correctes, 
            reponse_attendue, image_url, zones_cliquables,
            infos_etape, explication, ordre, options_json, 
            nombre_reponses_attendues, types_correction
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          qcmId, 
          q.enonce,
          q.option_a || null, 
          q.option_b || null, 
          q.option_c || null, 
          q.option_d || null, 
          q.option_e || null,
          q.question_type || 'single', 
          q.reponse_correcte || null, 
          q.reponses_correctes || null,
          q.reponse_attendue || null,
          q.image_url || null,
          q.zones_cliquables || null,
          q.infos_etape || null,
          q.explication, 
          q.ordre || (i + 1),
          q.options_json || null,
          q.nombre_reponses_attendues || null,
          q.types_correction || null
        ).run()
        
        console.log(`✅ Question ${i + 1} créée avec succès`)
      } catch (questionError) {
        console.error(`❌ Erreur lors de la création de la question ${i + 1}:`, questionError)
        throw questionError
      }
    }

    return c.json({ 
      message: 'QCM créé avec succès',
      qcmId: qcmId 
    }, 201)
  } catch (error) {
    console.error('Erreur création QCM:', error)
    return c.json({ error: 'Erreur lors de la création du QCM', details: error.message }, 500)
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

    console.log(`📝 Modification QCM ${qcmId}:`, { titre, specialite, semaine })
    console.log(`📝 Questions à modifier:`, questions.length)

    // Mettre à jour le QCM
    await DB.prepare(`
      UPDATE qcm_weekly 
      SET titre = ?, specialite = ?, semaine = ?, description = ?, 
          disponible_debut = ?, disponible_fin = ?, date_limite = ?
      WHERE id = ?
    `).bind(titre, specialite, semaine, description, disponible_debut, disponible_fin, date_limite, qcmId).run()

    // Supprimer les anciennes questions
    await DB.prepare('DELETE FROM questions WHERE qcm_id = ?').bind(qcmId).run()
    console.log('✅ Anciennes questions supprimées')

    // Créer les nouvelles questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      console.log(`📝 Modification question ${i + 1}:`, q.question_type)
      
      try {
        await DB.prepare(`
          INSERT INTO questions (
            qcm_id, enonce, 
            option_a, option_b, option_c, option_d, option_e, 
            question_type, reponse_correcte, reponses_correctes, 
            reponse_attendue, image_url, zones_cliquables,
            infos_etape, explication, ordre, options_json, 
            nombre_reponses_attendues, types_correction
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          qcmId, 
          q.enonce,
          q.option_a || null, 
          q.option_b || null, 
          q.option_c || null, 
          q.option_d || null, 
          q.option_e || null,
          q.question_type || 'single', 
          q.reponse_correcte || null, 
          q.reponses_correctes || null,
          q.reponse_attendue || null,
          q.image_url || null,
          q.zones_cliquables || null,
          q.infos_etape || null,
          q.explication, 
          q.ordre || (i + 1),
          q.options_json || null,
          q.nombre_reponses_attendues || null,
          q.types_correction || null
        ).run()
        
        console.log(`✅ Question ${i + 1} modifiée avec succès`)
      } catch (questionError) {
        console.error(`❌ Erreur lors de la modification de la question ${i + 1}:`, questionError)
        throw questionError
      }
    }

    console.log('✅ QCM modifié avec succès')
    return c.json({ message: 'QCM modifié avec succès' })
  } catch (error) {
    console.error('Erreur modification QCM:', error)
    return c.json({ error: 'Erreur lors de la modification', details: error.message }, 500)
  }
})

// ============================================
// API ROUTES - GESTION ÉTUDIANTS (ENSEIGNANTS)
// ============================================

// API - Liste de tous les étudiants (pour enseignants)
app.get('/api/teacher/students', async (c) => {
  try {
    const { DB } = c.env
    
    // Récupérer tous les étudiants avec leurs informations de base
    const students = await DB.prepare(`
      SELECT 
        id, email, nom, prenom, telephone, niveau, created_at, last_login,
        (SELECT COUNT(*) FROM student_progress WHERE user_id = users.id AND completed = 1) as qcm_completed,
        (SELECT AVG(score) FROM student_progress WHERE user_id = users.id AND completed = 1) as avg_score,
        (SELECT COUNT(DISTINCT qcm_id) FROM student_progress WHERE user_id = users.id) as qcm_attempted
      FROM users 
      WHERE role = 'student' 
      ORDER BY created_at DESC
    `).all()

    return c.json({ 
      students: students.results,
      total: students.results.length 
    })
  } catch (error) {
    console.error('Erreur chargement étudiants:', error)
    return c.json({ error: 'Erreur lors du chargement des étudiants' }, 500)
  }
})

// API - Détails d'un étudiant avec ses résultats
app.get('/api/teacher/student/:studentId', async (c) => {
  try {
    const studentId = c.req.param('studentId')
    const { DB } = c.env
    
    // Récupérer les infos de l'étudiant
    const student = await DB.prepare(`
      SELECT id, email, nom, prenom, telephone, niveau, created_at, last_login
      FROM users 
      WHERE id = ? AND role = 'student'
    `).bind(studentId).first()
    
    if (!student) {
      return c.json({ error: 'Étudiant non trouvé' }, 404)
    }
    
    // Récupérer les résultats détaillés
    const results = await DB.prepare(`
      SELECT 
        sp.*,
        qw.titre, qw.specialite, qw.semaine, qw.is_dossier_progressif,
        ROUND((sp.correct_answers * 100.0 / sp.total_questions), 1) as percentage
      FROM student_progress sp
      JOIN qcm_weekly qw ON sp.qcm_id = qw.id
      WHERE sp.user_id = ?
      ORDER BY sp.completed_at DESC
    `).bind(studentId).all()
    
    // Calculer les statistiques
    const stats = {
      total_qcm: results.results.length,
      completed_qcm: results.results.filter(r => r.completed).length,
      avg_score: results.results.length > 0 
        ? (results.results.reduce((sum, r) => sum + (r.percentage || 0), 0) / results.results.length).toFixed(1)
        : 0,
      best_score: results.results.length > 0 
        ? Math.max(...results.results.map(r => r.percentage || 0)).toFixed(1)
        : 0
    }
    
    return c.json({ 
      student,
      results: results.results,
      stats
    })
  } catch (error) {
    console.error('Erreur chargement détails étudiant:', error)
    return c.json({ error: 'Erreur lors du chargement des détails' }, 500)
  }
})

// API - Résultats d'un QCM spécifique pour tous les étudiants
app.get('/api/teacher/qcm/:qcmId/results', async (c) => {
  try {
    const qcmId = c.req.param('qcmId')
    const { DB } = c.env
    
    // Récupérer les infos du QCM
    const qcm = await DB.prepare(`
      SELECT id, titre, specialite, semaine, is_dossier_progressif
      FROM qcm_weekly 
      WHERE id = ?
    `).bind(qcmId).first()
    
    if (!qcm) {
      return c.json({ error: 'QCM non trouvé' }, 404)
    }
    
    // Récupérer tous les résultats pour ce QCM
    const results = await DB.prepare(`
      SELECT 
        sp.*,
        u.nom, u.prenom, u.email, u.niveau,
        ROUND((sp.correct_answers * 100.0 / sp.total_questions), 1) as percentage
      FROM student_progress sp
      JOIN users u ON sp.user_id = u.id
      WHERE sp.qcm_id = ? AND sp.completed = 1
      ORDER BY percentage DESC, sp.completed_at ASC
    `).bind(qcmId).all()
    
    // Calculer les statistiques du QCM
    const qcmStats = {
      total_participants: results.results.length,
      avg_score: results.results.length > 0 
        ? (results.results.reduce((sum, r) => sum + r.percentage, 0) / results.results.length).toFixed(1)
        : 0,
      success_rate: results.results.length > 0 
        ? ((results.results.filter(r => r.percentage >= 50).length / results.results.length) * 100).toFixed(1)
        : 0,
      excellent_rate: results.results.length > 0 
        ? ((results.results.filter(r => r.percentage >= 80).length / results.results.length) * 100).toFixed(1)
        : 0
    }
    
    return c.json({ 
      qcm,
      results: results.results,
      stats: qcmStats
    })
  } catch (error) {
    console.error('Erreur chargement résultats QCM:', error)
    return c.json({ error: 'Erreur lors du chargement des résultats' }, 500)
  }
})

// API - Confirmation email
app.get('/api/auth/confirm-email', async (c) => {
  try {
    const token = c.req.query('token')
    const { DB } = c.env

    if (!token) {
      return c.json({ error: 'Token manquant' }, 400)
    }

    // Vérifier le token
    const user = await DB.prepare(`
      SELECT id, email, nom, prenom, email_confirmed, token_expires_at 
      FROM users 
      WHERE email_token = ? AND email_confirmed = 0
    `).bind(token).first()

    if (!user) {
      return c.json({ error: 'Token invalide ou compte déjà confirmé' }, 400)
    }

    // Vérifier l'expiration
    const expiresAt = new Date(user.token_expires_at)
    const now = new Date()
    
    if (now > expiresAt) {
      return c.json({ error: 'Token expiré. Veuillez vous réinscrire.' }, 400)
    }

    // Confirmer l'email
    await DB.prepare(`
      UPDATE users 
      SET email_confirmed = 1, email_token = NULL, token_expires_at = NULL
      WHERE id = ?
    `).bind(user.id).run()

    console.log('✅ Email confirmé pour utilisateur:', {
      id: user.id,
      email: user.email,
      nom: user.nom,
      prenom: user.prenom
    })

    return c.json({ 
      message: 'Email confirmé avec succès ! Vous pouvez maintenant vous connecter.',
      success: true
    })
  } catch (error) {
    console.error('Erreur confirmation email:', error)
    return c.json({ error: 'Erreur lors de la confirmation' }, 500)
  }
})

// API - Renvoyer l'email de confirmation
app.post('/api/auth/resend-confirmation', async (c) => {
  try {
    const { email } = await c.req.json()
    const { DB } = c.env

    if (!email) {
      return c.json({ error: 'Email requis' }, 400)
    }

    // Vérifier l'utilisateur
    const user = await DB.prepare(`
      SELECT id, email, nom, prenom, email_confirmed 
      FROM users 
      WHERE email = ? AND email_confirmed = 0
    `).bind(email).first()

    if (!user) {
      return c.json({ error: 'Email non trouvé ou déjà confirmé' }, 400)
    }

    // Générer un nouveau token
    const emailToken = 'token_' + Math.random().toString(36).substr(2, 15) + Date.now()
    const tokenExpires = new Date()
    tokenExpires.setHours(tokenExpires.getHours() + 24)

    // Mettre à jour le token
    await DB.prepare(`
      UPDATE users 
      SET email_token = ?, token_expires_at = ?
      WHERE id = ?
    `).bind(emailToken, tokenExpires.toISOString(), user.id).run()

    // Envoyer le nouvel email de confirmation
    const confirmationUrl = `${c.req.url.split('/api')[0]}/confirm-email?token=${emailToken}`
    const emailHtml = generateConfirmationEmailHtml(user.nom, user.prenom, confirmationUrl)
    
    const emailResult = await sendEmail(
      email,
      'Confirmez votre inscription - OMAS Externat',
      emailHtml,
      c.env.RESEND_API_KEY
    )

    if (emailResult.success) {
      console.log('✅ Nouvel email de confirmation envoyé:', { 
        email, 
        emailId: emailResult.id 
      })

      return c.json({ 
        message: 'Email de confirmation renvoyé avec succès ! Vérifiez votre boîte de réception.',
        success: true
      })
    } else {
      console.error('❌ Échec renvoi email:', emailResult.error)
      
      return c.json({ 
        message: 'Erreur lors du renvoi de l\'email. Veuillez réessayer plus tard.',
        success: false
      }, 500)
    }
  } catch (error) {
    console.error('Erreur renvoi confirmation:', error)
    return c.json({ error: 'Erreur lors du renvoi' }, 500)
  }
})

// ============================================
// ROUTES API SUPER ADMIN
// ============================================

// API - Liste de tous les enseignants (pour super admin)
app.get('/api/admin/teachers', async (c) => {
  try {
    const { DB } = c.env
    
    // Récupérer tous les enseignants avec leurs statistiques
    const teachers = await DB.prepare(`
      SELECT 
        id, email, nom, prenom, telephone, created_at, last_login,
        (SELECT COUNT(*) FROM qcm_weekly WHERE created_by = users.id) as qcm_created,
        (SELECT COUNT(*) FROM qcm_weekly WHERE created_by = users.id AND is_published = 1) as qcm_published
      FROM users 
      WHERE role = 'teacher' 
      ORDER BY created_at DESC
    `).all()

    return c.json({ 
      teachers: teachers.results,
      total: teachers.results.length 
    })
  } catch (error) {
    console.error('Erreur chargement enseignants:', error)
    return c.json({ error: 'Erreur lors du chargement des enseignants' }, 500)
  }
})

// API - Créer un enseignant (pour super admin)
app.post('/api/admin/create-teacher', async (c) => {
  try {
    const { nom, prenom, email, telephone, password } = await c.req.json()
    const { DB } = c.env

    // Validation simple
    if (!nom || !prenom || !email || !password || !telephone) {
      return c.json({ error: 'Tous les champs sont requis' }, 400)
    }

    if (password.length < 6) {
      return c.json({ error: 'Le mot de passe doit contenir au moins 6 caractères' }, 400)
    }
    
    // Valider le format du téléphone (français)
    const phoneRegex = /^(?:(?:\+33|0)[1-9](?:[0-9]{8}))$/
    const cleanPhone = telephone.replace(/\s/g, '') // Supprimer les espaces
    if (!phoneRegex.test(cleanPhone)) {
      return c.json({ error: 'Format de téléphone invalide' }, 400)
    }

    // Vérifier si l'email existe déjà
    const existingEmail = await DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(email).first()

    if (existingEmail) {
      return c.json({ error: 'Cet email est déjà utilisé' }, 400)
    }
    
    // Vérifier si le téléphone existe déjà
    const existingPhone = await DB.prepare(
      'SELECT id FROM users WHERE telephone = ?'
    ).bind(cleanPhone).first()

    if (existingPhone) {
      return c.json({ error: 'Ce numéro de téléphone est déjà utilisé' }, 400)
    }

    // Créer l'enseignant (approuvé automatiquement)
    const result = await DB.prepare(
      'INSERT INTO users (email, password_hash, nom, prenom, telephone, role, account_status) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(email, password, nom, prenom, cleanPhone, 'teacher', 'approved').run()

    console.log('✅ Nouvel enseignant créé par super admin:', { 
      id: result.meta.last_row_id, 
      email, 
      nom, 
      prenom, 
      telephone: cleanPhone
    })

    return c.json({ 
      message: 'Enseignant créé avec succès',
      teacherId: result.meta.last_row_id
    }, 201)
  } catch (error) {
    console.error('Erreur création enseignant:', error)
    return c.json({ error: 'Erreur lors de la création de l\'enseignant' }, 500)
  }
})

// API - Statistiques globales (pour super admin)
app.get('/api/admin/stats', async (c) => {
  try {
    const { DB } = c.env
    
    // Compter les enseignants
    const teachersCount = await DB.prepare('SELECT COUNT(*) as count FROM users WHERE role = "teacher"').first()
    
    // Compter les étudiants
    const studentsCount = await DB.prepare('SELECT COUNT(*) as count FROM users WHERE role = "student"').first()
    
    // Compter les QCM
    const qcmCount = await DB.prepare('SELECT COUNT(*) as count FROM qcm_weekly').first()
    
    // Inscriptions récentes (7 derniers jours)
    const recentRegistrations = await DB.prepare(`
      SELECT nom, prenom, email, role, created_at
      FROM users 
      WHERE created_at >= date('now', '-7 days')
      ORDER BY created_at DESC
      LIMIT 10
    `).all()
    
    // Activité QCM récente
    const recentQcmActivity = await DB.prepare(`
      SELECT qw.titre, qw.specialite, u.nom as teacher_nom, u.prenom as teacher_prenom, qw.created_at
      FROM qcm_weekly qw
      JOIN users u ON qw.created_by = u.id
      WHERE qw.created_at >= date('now', '-7 days')
      ORDER BY qw.created_at DESC
      LIMIT 10
    `).all()

    return c.json({
      totals: {
        teachers: teachersCount.count,
        students: studentsCount.count,
        qcm: qcmCount.count
      },
      recent_registrations: recentRegistrations.results,
      recent_qcm_activity: recentQcmActivity.results
    })
  } catch (error) {
    console.error('Erreur statistiques admin:', error)
    return c.json({ error: 'Erreur lors du chargement des statistiques' }, 500)
  }
})

// API - Créer un étudiant (pour super admin)
app.post('/api/admin/create-student', async (c) => {
  try {
    const { DB } = c.env
    const { nom, prenom, email, telephone, niveau, password } = await c.req.json()

    // Validation des champs obligatoires
    if (!nom || !prenom || !email || !password || !telephone || !niveau) {
      return c.json({ error: 'Tous les champs sont obligatoires' }, 400)
    }

    // Validation du téléphone français
    const phoneRegex = /^(?:(?:\+33|0)[1-9](?:[0-9]{8}))$/
    const cleanPhone = telephone.replace(/\s/g, '')
    if (!phoneRegex.test(cleanPhone)) {
      return c.json({ error: 'Format de téléphone invalide' }, 400)
    }

    // Validation du niveau
    const validNiveaux = ['DFGSM2', 'DFGSM3', 'DFASM1', 'DFASM2', 'DFASM3']
    if (!validNiveaux.includes(niveau)) {
      return c.json({ error: 'Niveau d\'études invalide' }, 400)
    }

    // Vérifier si l'email existe déjà
    const existingEmail = await DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(email).first()

    if (existingEmail) {
      return c.json({ error: 'Cet email est déjà utilisé' }, 400)
    }
    
    // Vérifier si le téléphone existe déjà
    const existingPhone = await DB.prepare(
      'SELECT id FROM users WHERE telephone = ?'
    ).bind(cleanPhone).first()

    if (existingPhone) {
      return c.json({ error: 'Ce numéro de téléphone est déjà utilisé' }, 400)
    }

    // Créer l'étudiant
    const result = await DB.prepare(
      'INSERT INTO users (email, password_hash, nom, prenom, telephone, niveau, role, account_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(email, password, nom, prenom, cleanPhone, niveau, 'student', 'approved').run()

    console.log('✅ Nouvel étudiant créé par super admin:', { 
      id: result.meta.last_row_id, 
      email, 
      nom, 
      prenom, 
      telephone: cleanPhone,
      niveau
    })

    return c.json({ 
      message: 'Étudiant créé avec succès',
      studentId: result.meta.last_row_id
    }, 201)
  } catch (error) {
    console.error('Erreur création étudiant:', error)
    return c.json({ error: 'Erreur lors de la création de l\'étudiant' }, 500)
  }
})

// API - Réinitialiser mot de passe enseignant (pour super admin)
app.post('/api/admin/reset-teacher-password', async (c) => {
  try {
    const { DB } = c.env
    const { teacherId, newPassword } = await c.req.json()

    if (!teacherId || !newPassword) {
      return c.json({ error: 'ID enseignant et nouveau mot de passe requis' }, 400)
    }

    if (newPassword.length < 6) {
      return c.json({ error: 'Le mot de passe doit faire au moins 6 caractères' }, 400)
    }

    // Vérifier que l'enseignant existe
    const teacher = await DB.prepare('SELECT id, nom, prenom, email FROM users WHERE id = ? AND role = "teacher"').bind(teacherId).first()
    
    if (!teacher) {
      return c.json({ error: 'Enseignant non trouvé' }, 404)
    }

    // Réinitialiser le mot de passe
    await DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(newPassword, teacherId).run()

    console.log('🔄 Mot de passe enseignant réinitialisé par super admin:', { 
      teacherId, 
      teacher: teacher.nom + ' ' + teacher.prenom,
      email: teacher.email
    })

    return c.json({ 
      message: 'Mot de passe réinitialisé avec succès',
      teacher: teacher
    })
  } catch (error) {
    console.error('Erreur réinitialisation MDP enseignant:', error)
    return c.json({ error: 'Erreur lors de la réinitialisation' }, 500)
  }
})

// API - Réinitialiser mot de passe étudiant (pour super admin)
app.post('/api/admin/reset-student-password', async (c) => {
  try {
    const { DB } = c.env
    const { studentId, newPassword } = await c.req.json()

    if (!studentId || !newPassword) {
      return c.json({ error: 'ID étudiant et nouveau mot de passe requis' }, 400)
    }

    if (newPassword.length < 6) {
      return c.json({ error: 'Le mot de passe doit faire au moins 6 caractères' }, 400)
    }

    // Vérifier que l'étudiant existe
    const student = await DB.prepare('SELECT id, nom, prenom, email FROM users WHERE id = ? AND role = "student"').bind(studentId).first()
    
    if (!student) {
      return c.json({ error: 'Étudiant non trouvé' }, 404)
    }

    // Réinitialiser le mot de passe
    await DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(newPassword, studentId).run()

    console.log('🔄 Mot de passe étudiant réinitialisé par super admin:', { 
      studentId, 
      student: student.nom + ' ' + student.prenom,
      email: student.email
    })

    return c.json({ 
      message: 'Mot de passe réinitialisé avec succès',
      student: student
    })
  } catch (error) {
    console.error('Erreur réinitialisation MDP étudiant:', error)
    return c.json({ error: 'Erreur lors de la réinitialisation' }, 500)
  }
})

// API - Supprimer enseignant (pour super admin)
app.delete('/api/admin/delete-teacher/:teacherId', async (c) => {
  try {
    const { DB } = c.env
    const teacherId = c.req.param('teacherId')

    // Vérifier que l'enseignant existe
    const teacher = await DB.prepare('SELECT id, nom, prenom, email FROM users WHERE id = ? AND role = "teacher"').bind(teacherId).first()
    
    if (!teacher) {
      return c.json({ error: 'Enseignant non trouvé' }, 404)
    }

    // Supprimer l'enseignant (attention aux contraintes de clés étrangères)
    await DB.prepare('DELETE FROM users WHERE id = ?').bind(teacherId).run()

    console.log('🗑️ Enseignant supprimé par super admin:', { 
      teacherId, 
      teacher: teacher.nom + ' ' + teacher.prenom,
      email: teacher.email
    })

    return c.json({ 
      message: 'Enseignant supprimé avec succès',
      teacher: teacher
    })
  } catch (error) {
    console.error('Erreur suppression enseignant:', error)
    return c.json({ error: 'Erreur lors de la suppression' }, 500)
  }
})

// API - Supprimer étudiant (pour super admin)
app.delete('/api/admin/delete-student/:studentId', async (c) => {
  try {
    const { DB } = c.env
    const studentId = c.req.param('studentId')

    // Vérifier que l'étudiant existe
    const student = await DB.prepare('SELECT id, nom, prenom, email FROM users WHERE id = ? AND role = "student"').bind(studentId).first()
    
    if (!student) {
      return c.json({ error: 'Étudiant non trouvé' }, 404)
    }

    // Supprimer l'étudiant et ses progressions
    await DB.prepare('DELETE FROM student_progress WHERE user_id = ?').bind(studentId).run()
    await DB.prepare('DELETE FROM users WHERE id = ?').bind(studentId).run()

    console.log('🗑️ Étudiant supprimé par super admin:', { 
      studentId, 
      student: student.nom + ' ' + student.prenom,
      email: student.email
    })

    return c.json({ 
      message: 'Étudiant supprimé avec succès',
      student: student
    })
  } catch (error) {
    console.error('Erreur suppression étudiant:', error)
    return c.json({ error: 'Erreur lors de la suppression' }, 500)
  }
})

// API - Liste de tous les étudiants (pour super admin)
app.get('/api/admin/students', async (c) => {
  try {
    const { DB } = c.env
    
    // Récupérer tous les étudiants avec leurs statistiques
    const students = await DB.prepare(`
      SELECT 
        u.id,
        u.email,
        u.nom,
        u.prenom,
        u.telephone,
        u.niveau,
        u.faculte,
        u.created_at,
        u.last_login,
        u.account_status,
        COUNT(DISTINCT sp.qcm_id) as qcm_attempted,
        COUNT(CASE WHEN sp.completed = 1 THEN sp.qcm_id END) as qcm_completed,
        ROUND(AVG(CASE WHEN sp.completed = 1 THEN sp.score END), 3) as avg_score
      FROM users u
      LEFT JOIN student_progress sp ON u.id = sp.user_id
      WHERE u.role = 'student'
      GROUP BY u.id, u.email, u.nom, u.prenom, u.telephone, u.niveau, u.created_at, u.last_login, u.account_status
      ORDER BY u.created_at DESC
    `).all()

    return c.json({ 
      students: students.results,
      total: students.results.length 
    })
  } catch (error) {
    console.error('Erreur chargement étudiants admin:', error)
    return c.json({ error: 'Erreur lors du chargement des étudiants' }, 500)
  }
})

// API - Approuver un étudiant (pour super admin)
app.post('/api/admin/approve-student/:studentId', async (c) => {
  try {
    const { DB } = c.env
    const studentId = c.req.param('studentId')

    // Vérifier que l'étudiant existe et est en attente
    const student = await DB.prepare('SELECT id, nom, prenom, email, account_status FROM users WHERE id = ? AND role = "student"').bind(studentId).first()
    
    if (!student) {
      return c.json({ error: 'Étudiant non trouvé' }, 404)
    }

    if (student.account_status !== 'pending') {
      return c.json({ error: 'Ce compte n\'est pas en attente' }, 400)
    }

    // Approuver le compte
    await DB.prepare('UPDATE users SET account_status = ? WHERE id = ?').bind('approved', studentId).run()

    console.log('✅ Compte étudiant approuvé par super admin:', { 
      studentId, 
      student: student.nom + ' ' + student.prenom,
      email: student.email
    })

    return c.json({ 
      message: 'Compte approuvé avec succès',
      student: student
    })
  } catch (error) {
    console.error('Erreur approbation étudiant:', error)
    return c.json({ error: 'Erreur lors de l\'approbation' }, 500)
  }
})

// API - Rejeter un étudiant (pour super admin)
app.post('/api/admin/reject-student/:studentId', async (c) => {
  try {
    const { DB } = c.env
    const studentId = c.req.param('studentId')

    // Vérifier que l'étudiant existe et est en attente
    const student = await DB.prepare('SELECT id, nom, prenom, email, account_status FROM users WHERE id = ? AND role = "student"').bind(studentId).first()
    
    if (!student) {
      return c.json({ error: 'Étudiant non trouvé' }, 404)
    }

    if (student.account_status !== 'pending') {
      return c.json({ error: 'Ce compte n\'est pas en attente' }, 400)
    }

    // Rejeter le compte
    await DB.prepare('UPDATE users SET account_status = ? WHERE id = ?').bind('rejected', studentId).run()

    console.log('❌ Compte étudiant rejeté par super admin:', { 
      studentId, 
      student: student.nom + ' ' + student.prenom,
      email: student.email
    })

    return c.json({ 
      message: 'Compte rejeté',
      student: student
    })
  } catch (error) {
    console.error('Erreur rejet étudiant:', error)
    return c.json({ error: 'Erreur lors du rejet' }, 500)
  }
})

// API - Liste des comptes en attente (pour super admin)
app.get('/api/admin/pending-accounts', async (c) => {
  try {
    const { DB } = c.env
    
    // Récupérer tous les comptes en attente
    const pendingAccounts = await DB.prepare(`
      SELECT 
        id, email, nom, prenom, telephone, niveau, faculte, role, created_at, account_status
      FROM users 
      WHERE account_status = 'pending'
      ORDER BY created_at DESC
    `).all()

    return c.json({ 
      accounts: pendingAccounts.results,
      total: pendingAccounts.results.length 
    })
  } catch (error) {
    console.error('Erreur chargement comptes en attente:', error)
    return c.json({ error: 'Erreur lors du chargement des comptes en attente' }, 500)
  }
})

// API - Changer le mot de passe d'un utilisateur (admin only)
app.post('/api/admin/change-password/:userId', async (c) => {
  try {
    const { DB } = c.env
    const userId = c.req.param('userId')
    const { newPassword } = await c.req.json()

    // Validation
    if (!newPassword || newPassword.length < 6) {
      return c.json({ error: 'Le mot de passe doit contenir au moins 6 caractères' }, 400)
    }

    // Vérifier que l'utilisateur existe
    const user = await DB.prepare(
      'SELECT id, email, nom, prenom, role FROM users WHERE id = ?'
    ).bind(userId).first()

    if (!user) {
      return c.json({ error: 'Utilisateur non trouvé' }, 404)
    }

    // Mettre à jour le mot de passe
    const result = await DB.prepare(
      'UPDATE users SET password_hash = ? WHERE id = ?'
    ).bind(newPassword, userId).run()

    if (result.success) {
      console.log('✅ Mot de passe modifié par admin:', { 
        userId, 
        userEmail: user.email,
        adminAction: true 
      })

      return c.json({ 
        message: `Mot de passe modifié avec succès pour ${user.prenom} ${user.nom}`,
        success: true 
      })
    } else {
      throw new Error('Échec de la mise à jour')
    }
  } catch (error) {
    console.error('Erreur modification mot de passe:', error)
    return c.json({ error: 'Erreur lors de la modification du mot de passe' }, 500)
  }
})

// API - Réinitialiser le mot de passe d'un enseignant (admin only)
app.post('/api/admin/reset-teacher-password', async (c) => {
  try {
    const { DB } = c.env
    const { teacherId, newPassword } = await c.req.json()

    // Validation
    if (!newPassword || newPassword.length < 6) {
      return c.json({ error: 'Le mot de passe doit contenir au moins 6 caractères' }, 400)
    }

    // Vérifier que l'enseignant existe
    const teacher = await DB.prepare(
      'SELECT id, email, nom, prenom FROM users WHERE id = ? AND role = "teacher"'
    ).bind(teacherId).first()

    if (!teacher) {
      return c.json({ error: 'Enseignant non trouvé' }, 404)
    }

    // Mettre à jour le mot de passe
    const result = await DB.prepare(
      'UPDATE users SET password_hash = ? WHERE id = ?'
    ).bind(newPassword, teacherId).run()

    if (result.success) {
      console.log('✅ Mot de passe enseignant réinitialisé:', { 
        teacherId, 
        teacherEmail: teacher.email,
        adminAction: true 
      })

      return c.json({ 
        message: `Mot de passe réinitialisé avec succès pour ${teacher.prenom} ${teacher.nom}`,
        success: true 
      })
    } else {
      throw new Error('Échec de la mise à jour')
    }
  } catch (error) {
    console.error('Erreur réinitialisation mot de passe enseignant:', error)
    return c.json({ error: 'Erreur lors de la réinitialisation du mot de passe' }, 500)
  }
})

// API - Réinitialiser le mot de passe d'un étudiant (admin only)
app.post('/api/admin/reset-student-password', async (c) => {
  try {
    const { DB } = c.env
    const { studentId, newPassword } = await c.req.json()

    // Validation
    if (!newPassword || newPassword.length < 6) {
      return c.json({ error: 'Le mot de passe doit contenir au moins 6 caractères' }, 400)
    }

    // Vérifier que l'étudiant existe
    const student = await DB.prepare(
      'SELECT id, email, nom, prenom FROM users WHERE id = ? AND role = "student"'
    ).bind(studentId).first()

    if (!student) {
      return c.json({ error: 'Étudiant non trouvé' }, 404)
    }

    // Mettre à jour le mot de passe
    const result = await DB.prepare(
      'UPDATE users SET password_hash = ? WHERE id = ?'
    ).bind(newPassword, studentId).run()

    if (result.success) {
      console.log('✅ Mot de passe étudiant réinitialisé:', { 
        studentId, 
        studentEmail: student.email,
        adminAction: true 
      })

      return c.json({ 
        message: `Mot de passe réinitialisé avec succès pour ${student.prenom} ${student.nom}`,
        success: true 
      })
    } else {
      throw new Error('Échec de la mise à jour')
    }
  } catch (error) {
    console.error('Erreur réinitialisation mot de passe étudiant:', error)
    return c.json({ error: 'Erreur lors de la réinitialisation du mot de passe' }, 500)
  }
})

// ============================================
// ROUTES PAGES HTML
// ============================================

// Page Confirmation Email
app.get('/confirm-email', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Confirmation Email - OMAS Externat</title>
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
                
                <div id="confirmation-content">
                    <div style="text-align: center; padding: 2rem 0;">
                        <div class="spinner"></div>
                        <p style="margin-top: 1rem;">Confirmation de votre email en cours...</p>
                    </div>
                </div>
            </div>
        </div>

        <script>
        // Confirmer l'email au chargement de la page
        document.addEventListener('DOMContentLoaded', function() {
            const urlParams = new URLSearchParams(window.location.search);
            const token = urlParams.get('token');
            const content = document.getElementById('confirmation-content');
            
            if (!token) {
                content.innerHTML = \`
                    <div style="text-align: center; padding: 2rem 0;">
                        <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: #e74c3c; margin-bottom: 1rem;"></i>
                        <h3 style="color: #e74c3c;">Token manquant</h3>
                        <p style="color: #666;">Le lien de confirmation est invalide.</p>
                        <a href="/connexion" class="btn-primary" style="margin-top: 1rem; display: inline-block; text-decoration: none;">
                            Retour à la connexion
                        </a>
                    </div>
                \`;
                return;
            }
            
            // Appeler l'API de confirmation
            fetch('/api/auth/confirm-email?token=' + encodeURIComponent(token))
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        content.innerHTML = \`
                            <div style="text-align: center; padding: 2rem 0;">
                                <i class="fas fa-check-circle" style="font-size: 3rem; color: #28a745; margin-bottom: 1rem;"></i>
                                <h3 style="color: #28a745;">Email confirmé !</h3>
                                <p style="color: #666;">Votre compte a été activé avec succès.</p>
                                <a href="/connexion" class="btn-primary" style="margin-top: 1rem; display: inline-block; text-decoration: none;">
                                    Se connecter
                                </a>
                            </div>
                        \`;
                    } else {
                        content.innerHTML = \`
                            <div style="text-align: center; padding: 2rem 0;">
                                <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: #e74c3c; margin-bottom: 1rem;"></i>
                                <h3 style="color: #e74c3c;">Erreur de confirmation</h3>
                                <p style="color: #666;">\${data.error || 'Une erreur est survenue.'}</p>
                                <a href="/connexion" class="btn-primary" style="margin-top: 1rem; display: inline-block; text-decoration: none;">
                                    Retour à la connexion
                                </a>
                            </div>
                        \`;
                    }
                })
                .catch(error => {
                    console.error('Erreur confirmation:', error);
                    content.innerHTML = \`
                        <div style="text-align: center; padding: 2rem 0;">
                            <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: #e74c3c; margin-bottom: 1rem;"></i>
                            <h3 style="color: #e74c3c;">Erreur</h3>
                            <p style="color: #666;">Une erreur est survenue lors de la confirmation.</p>
                            <a href="/connexion" class="btn-primary" style="margin-top: 1rem; display: inline-block; text-decoration: none;">
                                Retour à la connexion
                            </a>
                        </div>
                    \`;
                });
        });
        </script>
    </body>
    </html>
  `)
})

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
        <script src="/static/header-dynamic.js"></script>
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
                    <form id="login-form" method="POST" action="/api/auth/login">
                        <div class="form-group">
                            <label class="form-label">Email</label>
                            <input type="email" name="email" class="form-input" placeholder="votre@email.com" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Mot de passe</label>
                            <input type="password" name="password" class="form-input" placeholder="••••••••" required>
                        </div>
                        <button type="submit" class="btn-primary">Se connecter</button>
                        <div id="login-error" class="error-message" style="display: none;"></div>
                    </form>
                </div>

                <div id="register-tab" class="tab-content" style="display: none;">
                    <form id="register-form">
                        <div class="form-group">
                            <!-- Role caché - toujours étudiant -->
                            <input type="hidden" name="role" value="student">
                            <div style="background: var(--teal-light); padding: 1rem; border-radius: 6px; margin-bottom: 1rem;">
                                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                    <i class="fas fa-user-graduate" style="color: var(--teal-primary);"></i>
                                    <strong>Inscription Étudiant</strong>
                                </div>
                                <p style="margin: 0; font-size: 0.9rem; color: var(--teal-primary);">
                                    Seuls les étudiants peuvent s'inscrire directement. Les comptes enseignants sont créés par l'administration.
                                </p>
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Nom *</label>
                                <input type="text" name="nom" class="form-input" placeholder="Dupont" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Prénom *</label>
                                <input type="text" name="prenom" class="form-input" placeholder="Marie" required>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Email *</label>
                            <input type="email" name="email" class="form-input" placeholder="votre@email.com" required>
                            <small style="color: #666; font-size: 0.85rem; margin-top: 0.25rem; display: block;">
                                <i class="fas fa-envelope"></i> Un email de confirmation sera envoyé
                            </small>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Numéro de téléphone *</label>
                            <input type="tel" name="telephone" class="form-input" placeholder="06 12 34 56 78" required
                                   pattern="^(\\+33|0)[1-9][0-9]{8}$" 
                                   title="Numéro de téléphone français valide">
                            <small style="color: #666; font-size: 0.85rem; margin-top: 0.25rem; display: block;">
                                <i class="fas fa-info-circle"></i> Format : 06 12 34 56 78 ou +33 6 12 34 56 78
                            </small>
                        </div>
                        
                        <!-- Niveau obligatoire pour étudiants -->
                        <div class="form-group">
                            <label class="form-label">Niveau d'études *</label>
                            <select name="niveau" class="form-input" required>
                                <option value="">Sélectionnez votre niveau...</option>
                                <option value="DFGSM2">DFGSM 2</option>
                                <option value="DFGSM3">DFGSM 3</option>
                                <option value="DFASM1">DFASM 1</option>
                                <option value="DFASM2">DFASM 2</option>
                                <option value="DFASM3">DFASM 3</option>
                            </select>
                            <small style="color: #666; font-size: 0.85rem; margin-top: 0.25rem; display: block;">
                                <i class="fas fa-graduation-cap"></i> Votre année d'études actuelle
                            </small>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Faculté de médecine *</label>
                            <select name="faculte" class="form-input" required>
                                <option value="">Sélectionnez votre faculté...</option>
                                <optgroup label="Région Parisienne">
                                    <option value="Sorbonne Université">Sorbonne Université</option>
                                    <option value="Université Paris Cité">Université Paris Cité</option>
                                    <option value="Sorbonne Université Paris Nord">Sorbonne Université Paris Nord</option>
                                    <option value="Université Paris-Est Créteil">Université Paris-Est Créteil</option>
                                    <option value="Université Paris-Saclay">Université Paris-Saclay</option>
                                    <option value="Université de Versailles Saint-Quentin (UVSQ)">Université de Versailles Saint-Quentin (UVSQ)</option>
                                </optgroup>
                                <optgroup label="Autres Régions">
                                    <option value="Université de Tours">Université de Tours</option>
                                    <option value="Université d'Orléans">Université d'Orléans</option>
                                    <option value="Université d'Aix-Marseille">Université d'Aix-Marseille</option>
                                    <option value="Université de Montpellier">Université de Montpellier</option>
                                    <option value="Université Côte d'Azur (Nice)">Université Côte d'Azur (Nice)</option>
                                    <option value="Université de Toulouse">Université de Toulouse</option>
                                    <option value="Université de Bordeaux">Université de Bordeaux</option>
                                    <option value="Université de Reims Champagne-Ardenne">Université de Reims Champagne-Ardenne</option>
                                    <option value="Université de Rouen Normandie">Université de Rouen Normandie</option>
                                </optgroup>
                            </select>
                            <small style="color: #666; font-size: 0.85rem; margin-top: 0.25rem; display: block;">
                                <i class="fas fa-university"></i> Votre université/faculté de médecine
                            </small>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Mot de passe *</label>
                                <input type="password" name="password" class="form-input" placeholder="••••••••" required
                                       minlength="6" title="Au moins 6 caractères">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Confirmer le mot de passe *</label>
                                <input type="password" name="confirmPassword" class="form-input" placeholder="••••••••" required>
                            </div>
                        </div>
                        
                        <div style="background: #f0f8ff; padding: 1rem; border-radius: 6px; border-left: 4px solid #2196F3; margin: 1rem 0;">
                            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                <i class="fas fa-info-circle" style="color: #2196F3;"></i>
                                <strong>Validation du compte</strong>
                            </div>
                            <p style="margin: 0; font-size: 0.9rem; color: #333; line-height: 1.4;">
                                Votre compte sera validé prochainement par un administrateur.
                            </p>
                        </div>
                        
                        <button type="submit" class="btn-primary">
                            <i class="fas fa-user-plus"></i> S'inscrire
                        </button>
                    </form>
                </div>
            </div>
        </div>

        <script src="/static/app.js"></script>
        <script src="/static/header-init.js"></script>
        <script src="/static/header-dynamic.js"></script>
        
        <script>
        // Gestion des onglets connexion/inscription
        document.addEventListener('DOMContentLoaded', function() {
            // Gestion des onglets
            const tabs = document.querySelectorAll('.tab');
            const tabContents = document.querySelectorAll('.tab-content');
            
            tabs.forEach(tab => {
                tab.addEventListener('click', function() {
                    const targetId = this.getAttribute('data-tab');
                    
                    // Retirer la classe active de tous les onglets et contenus
                    tabs.forEach(t => t.classList.remove('active'));
                    tabContents.forEach(tc => {
                        tc.classList.remove('active');
                        tc.style.display = 'none';
                    });
                    
                    // Ajouter la classe active à l'onglet cliqué et son contenu
                    this.classList.add('active');
                    const targetContent = document.getElementById(targetId);
                    if (targetContent) {
                        targetContent.classList.add('active');
                        targetContent.style.display = 'block';
                    }
                });
            });

            // Gestion sécurisée de la connexion
            const loginForm = document.getElementById('login-form');
            const loginError = document.getElementById('login-error');
            
            if (loginForm) {
                loginForm.addEventListener('submit', async function(e) {
                    e.preventDefault(); // Empêcher la soumission normale (GET)
                    
                    const formData = new FormData(loginForm);
                    const email = formData.get('email');
                    const password = formData.get('password');
                    
                    try {
                        const response = await fetch('/api/auth/login', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ email, password })
                        });
                        
                        const data = await response.json();
                        
                        if (response.ok && data.token) {
                            // Connexion réussie
                            localStorage.setItem('omas_token', data.token);
                            localStorage.setItem('omas_user', JSON.stringify(data.user));
                            
                            // Redirection selon le rôle
                            if (data.user.role === 'teacher') {
                                window.location.href = '/dashboard-enseignant';
                            } else {
                                window.location.href = '/dashboard';
                            }
                        } else {
                            // Erreur de connexion
                            loginError.textContent = data.error || 'Erreur de connexion';
                            loginError.style.display = 'block';
                        }
                    } catch (error) {
                        console.error('Erreur de connexion:', error);
                        loginError.textContent = 'Erreur de connexion. Veuillez réessayer.';
                        loginError.style.display = 'block';
                    }
                });
            }
        });
        </script>
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
        <script src="/static/header-dynamic.js"></script>
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
        <script src="/static/header-dynamic.js"></script>
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
            <div id="qcm-container">
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

// Route Dashboard étudiant (alias pour /espace-etudiant)
app.get('/dashboard', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Mon Dashboard - OMAS Externat</title>
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
                    <a href="/dashboard" class="nav-link">Mon Dashboard</a>
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

        <div class="container">
            <div class="dashboard-container">
                <div class="dashboard-header">
                    <h1 class="dashboard-title">Mon Dashboard Étudiant</h1>
                    <p class="dashboard-subtitle">Suivez votre progression et vos performances</p>
                </div>

                <!-- Statistiques de progression -->
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-icon" style="background-color: var(--teal-light);">
                            <i class="fas fa-clipboard-list" style="color: var(--teal-primary);"></i>
                        </div>
                        <div class="stat-content">
                            <h3 class="stat-number" id="qcm-completed">0</h3>
                            <p class="stat-label">QCM Terminés</p>
                        </div>
                    </div>

                    <div class="stat-card">
                        <div class="stat-icon" style="background-color: #dcfce7;">
                            <i class="fas fa-chart-line" style="color: #059669;"></i>
                        </div>
                        <div class="stat-content">
                            <h3 class="stat-number" id="avg-score">0%</h3>
                            <p class="stat-label">Score Moyen</p>
                        </div>
                    </div>

                    <div class="stat-card">
                        <div class="stat-icon" style="background-color: #fef3c7;">
                            <i class="fas fa-trophy" style="color: #d97706;"></i>
                        </div>
                        <div class="stat-content">
                            <h3 class="stat-number" id="best-score">0%</h3>
                            <p class="stat-label">Meilleur Score</p>
                        </div>
                    </div>

                    <div class="stat-card">
                        <div class="stat-icon" style="background-color: #e0e7ff;">
                            <i class="fas fa-clock" style="color: #4f46e5;"></i>
                        </div>
                        <div class="stat-content">
                            <h3 class="stat-number" id="study-time">0h</h3>
                            <p class="stat-label">Temps d'Étude</p>
                        </div>
                    </div>
                </div>

                <!-- Graphique de progression -->
                <div class="chart-container">
                    <h2 class="section-title">Progression des Scores</h2>
                    <canvas id="progress-chart" width="400" height="200"></canvas>
                </div>

                <!-- QCM récents -->
                <div class="recent-qcm">
                    <h2 class="section-title">QCM Récents</h2>
                    <div id="recent-qcm-list">
                        <!-- Contenu dynamique -->
                    </div>
                </div>
            </div>
        </div>

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
                <nav class="nav-menu" style="display: flex; gap: 1.5rem; align-items: center; flex-wrap: wrap;">
                    <a href="/dashboard-enseignant" class="nav-link">Mes QCM</a>
                    <a href="/creer-qcm" class="nav-link">Créer un QCM</a>
                    <a href="/gestion-etudiants" class="nav-link">Étudiants</a>
                    <a href="/" class="nav-link">Accueil</a>
                    <span class="nav-link" id="user-name-display" style="color: var(--teal-primary); font-weight: 600; display: flex; align-items: center; gap: 0.3rem;">
                        <i class="fas fa-user-circle"></i> <span id="user-name">Profil</span>
                    </span>
                    <a href="#" class="nav-link" onclick="logout(); return false;" style="display: flex; align-items: center; gap: 0.3rem; color: var(--red, #e74c3c); font-weight: 600;">
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
                <nav class="nav-menu" style="display: flex; gap: 1.5rem; align-items: center; flex-wrap: wrap;">
                    <a href="/dashboard-enseignant" class="nav-link">Mes QCM</a>
                    <a href="/creer-qcm" class="nav-link">Créer un QCM</a>
                    <a href="/gestion-etudiants" class="nav-link">Étudiants</a>
                    <a href="/" class="nav-link">Accueil</a>
                    <span class="nav-link" id="user-name-display" style="color: var(--teal-primary); font-weight: 600; display: flex; align-items: center; gap: 0.3rem;">
                        <i class="fas fa-user-circle"></i> <span id="user-name">Profil</span>
                    </span>
                    <a href="#" class="nav-link" onclick="logout(); return false;" style="display: flex; align-items: center; gap: 0.3rem; color: var(--red, #e74c3c); font-weight: 600;">
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

                    <!-- Type de QCM -->
                    <div class="form-group">
                        <div class="checkbox-group" style="background: #f8f9fa; padding: 1rem; border-radius: 8px; border: 1px solid #e1e5e9;">
                            <label class="checkbox-label" style="display: flex; align-items: center; gap: 0.75rem; cursor: pointer;">
                                <input type="checkbox" name="is_dossier_progressif" id="is_dossier_progressif" 
                                       onchange="toggleDossierProgressifMode()" 
                                       style="transform: scale(1.2);">
                                <div style="flex: 1;">
                                    <strong style="color: #667e74; font-size: 1rem;">
                                        <i class="fas fa-file-medical" style="color: #7c3aed; margin-right: 0.5rem;"></i>
                                        Dossier Progressif (DP)
                                    </strong>
                                    <p style="margin: 0.25rem 0 0 0; font-size: 0.9rem; color: #666; line-height: 1.4;">
                                        Les questions sont présentées une par une de manière progressive. 
                                        Une fois validée, une réponse ne peut plus être modifiée.
                                    </p>
                                </div>
                            </label>
                        </div>
                    </div>

                    <!-- Contexte initial (visible seulement si DP activé) -->
                    <div class="form-group" id="contexte-initial-group" style="display: none;">
                        <label class="form-label">
                            <i class="fas fa-user-md"></i> Contexte initial du dossier *
                        </label>
                        <textarea name="contexte_initial" class="form-input" rows="4"
                                  placeholder="Ex: M. DUPONT, 65 ans, consulte aux urgences pour douleur thoracique apparue brutalement il y a 2 heures..."></textarea>
                        <small style="color: #666; font-style: italic;">
                            <i class="fas fa-info-circle"></i> 
                            Présentez ici le patient et la situation clinique initiale
                        </small>
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
        
        <script>
        // Fonction pour basculer le mode Dossier Progressif
        function toggleDossierProgressifMode() {
            const isDP = document.getElementById('is_dossier_progressif').checked;
            const contexteGroup = document.getElementById('contexte-initial-group');
            const contexteInput = document.querySelector('textarea[name="contexte_initial"]');
            
            if (isDP) {
                contexteGroup.style.display = 'block';
                contexteInput.required = true;
                
                // Changer le style des questions pour indiquer le mode DP
                document.querySelectorAll('.question-container').forEach(container => {
                    container.classList.add('dp-mode');
                    updateQuestionForDPMode(container);
                });
                
                // Ajouter des indices visuels
                const questionsTitle = document.querySelector('.form-section h3');
                if (questionsTitle && !questionsTitle.innerHTML.includes('clipboard-list')) {
                    questionsTitle.innerHTML = '<i class="fas fa-clipboard-list" style="color: #7c3aed;"></i> Questions - Mode Dossier Progressif';
                }
            } else {
                contexteGroup.style.display = 'none';
                contexteInput.required = false;
                
                // Supprimer le style DP
                document.querySelectorAll('.question-container').forEach(container => {
                    container.classList.remove('dp-mode');
                    updateQuestionForDPMode(container);
                });
                
                // Restaurer le titre normal
                const questionsTitle = document.querySelector('.form-section h3');
                if (questionsTitle) {
                    questionsTitle.innerHTML = 'Questions';
                }
            }
        }
        
        // Modifier les questions pour le mode DP
        function updateQuestionForDPMode(questionContainer) {
            const isDP = document.getElementById('is_dossier_progressif').checked;
            if (isDP) {
                // Ajouter un champ pour les informations d'étape si c'est un DP
                if (!questionContainer.querySelector('.infos-etape-group')) {
                    const infosEtapeHTML = \`
                        <div class="form-group infos-etape-group" style="background: #f0f4f8; padding: 1rem; border-radius: 6px; border-left: 4px solid #7c3aed;">
                            <label class="form-label">
                                <i class="fas fa-info-circle" style="color: #7c3aed;"></i> 
                                Informations révélées à cette étape
                            </label>
                            <textarea name="infos_etape" class="form-input" rows="3"
                                      placeholder="Ex: L'ECG montre un sus-décalage en DII, DIII, aVF. La troponine est à 15 ng/mL..."></textarea>
                            <small style="color: #666; font-style: italic;">
                                Nouvelles informations cliniques, résultats d'examens, évolution...
                            </small>
                        </div>
                    \`;
                    
                    // Insérer après l'énoncé et avant les options
                    const enonceGroup = questionContainer.querySelector('.form-group');
                    enonceGroup.insertAdjacentHTML('afterend', infosEtapeHTML);
                }
            } else {
                // Supprimer les champs infos d'étape si ce n'est plus un DP
                const infosEtapeGroup = questionContainer.querySelector('.infos-etape-group');
                if (infosEtapeGroup) {
                    infosEtapeGroup.remove();
                }
            }
        }
        </script>
    </body>
    </html>
  `)
})

// Page Dashboard Super Admin (pour gestion des enseignants)
app.get('/super-admin', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Super Admin - OMAS Externat</title>
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
                <nav class="nav-menu" style="display: flex; gap: 1.5rem; align-items: center; flex-wrap: wrap;">
                    <a href="/super-admin" class="nav-link active">Gestion</a>
                    <a href="/" class="nav-link">Accueil</a>
                    <span class="nav-link" id="user-name-display" style="color: var(--teal-primary); font-weight: 600; display: flex; align-items: center; gap: 0.3rem;">
                        <i class="fas fa-user-shield"></i> <span id="user-name">Super Admin</span>
                    </span>
                    <a href="#" class="nav-link" onclick="logout(); return false;" style="display: flex; align-items: center; gap: 0.3rem; color: var(--red, #e74c3c); font-weight: 600;">
                        <i class="fas fa-sign-out-alt"></i> Déconnexion
                    </a>
                </nav>
            </div>
        </header>

        <div class="teacher-dashboard">
            <div class="dashboard-header">
                <h1 class="dashboard-title">
                    <i class="fas fa-user-shield"></i> Administration Système
                </h1>
                <div class="dashboard-stats" id="admin-stats">
                    <div class="stat-card">
                        <div class="stat-icon" style="background: linear-gradient(135deg, #667e74 0%, #7c3aed 100%);">
                            <i class="fas fa-chalkboard-teacher"></i>
                        </div>
                        <div class="stat-info">
                            <div class="stat-number" id="total-teachers">-</div>
                            <div class="stat-label">Enseignants</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon" style="background: linear-gradient(135deg, #0f7c8c 0%, #0a5d6a 100%);">
                            <i class="fas fa-users"></i>
                        </div>
                        <div class="stat-info">
                            <div class="stat-number" id="total-students-admin">-</div>
                            <div class="stat-label">Étudiants</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon" style="background: linear-gradient(135deg, #e67e22 0%, #d35400 100%);">
                            <i class="fas fa-question-circle"></i>
                        </div>
                        <div class="stat-info">
                            <div class="stat-number" id="total-qcm">-</div>
                            <div class="stat-label">QCM Total</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Système d'onglets pour la gestion -->
            <div class="admin-section">
                <div class="admin-tabs">
                    <button class="admin-tab active" data-tab="pending-tab">
                        <i class="fas fa-clock"></i> En attente
                    </button>
                    <button class="admin-tab" data-tab="teachers-tab">
                        <i class="fas fa-chalkboard-teacher"></i> Enseignants
                    </button>
                    <button class="admin-tab" data-tab="students-tab">
                        <i class="fas fa-user-graduate"></i> Étudiants
                    </button>
                </div>

                <!-- Onglet Comptes en attente -->
                <div id="pending-tab" class="admin-tab-content active">
                    <div class="section-header">
                        <h2><i class="fas fa-clock"></i> Comptes en attente de validation</h2>
                        <div style="display: flex; gap: 0.5rem;">
                            <button onclick="refreshPendingAccounts()" class="btn-secondary">
                                <i class="fas fa-sync-alt"></i> Actualiser
                            </button>
                        </div>
                    </div>
                    
                    <div id="pending-accounts-list" class="teachers-grid">
                        <div style="text-align: center; padding: 3rem; grid-column: 1/-1;">
                            <div class="spinner"></div>
                            <p style="margin-top: 1rem;">Chargement des comptes en attente...</p>
                        </div>
                    </div>
                </div>

                <!-- Onglet Enseignants -->
                <div id="teachers-tab" class="admin-tab-content" style="display: none;">
                    <div class="section-header">
                        <h2><i class="fas fa-chalkboard-teacher"></i> Gestion des Enseignants</h2>
                        <button onclick="showCreateTeacherModal()" class="btn-primary">
                            <i class="fas fa-plus"></i> Créer un enseignant
                        </button>
                    </div>
                    
                    <div id="teachers-list" class="teachers-grid">
                        <div style="text-align: center; padding: 3rem; grid-column: 1/-1;">
                            <div class="spinner"></div>
                            <p style="margin-top: 1rem;">Chargement des enseignants...</p>
                        </div>
                    </div>
                </div>

                <!-- Onglet Étudiants -->
                <div id="students-tab" class="admin-tab-content" style="display: none;">
                    <div class="section-header">
                        <h2><i class="fas fa-user-graduate"></i> Gestion des Étudiants</h2>
                        <button onclick="showCreateStudentModal()" class="btn-primary">
                            <i class="fas fa-plus"></i> Créer un étudiant
                        </button>
                    </div>
                    
                    <div id="students-list" class="teachers-grid">
                        <div style="text-align: center; padding: 3rem; grid-column: 1/-1;">
                            <div class="spinner"></div>
                            <p style="margin-top: 1rem;">Chargement des étudiants...</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Statistiques Système -->
            <div class="admin-section">
                <div class="section-header">
                    <h2><i class="fas fa-chart-line"></i> Statistiques Système</h2>
                </div>
                
                <div class="system-stats-grid">
                    <div class="system-stat-card">
                        <h4>Inscriptions Récentes</h4>
                        <div id="recent-registrations">
                            <div class="spinner"></div>
                        </div>
                    </div>
                    <div class="system-stat-card">
                        <h4>Activité QCM</h4>
                        <div id="qcm-activity">
                            <div class="spinner"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Modal Créer Enseignant -->
        <div id="create-teacher-modal" class="modal" style="display: none;">
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h3>Créer un compte enseignant</h3>
                    <button onclick="closeCreateTeacherModal()" class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="create-teacher-form">
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Nom *</label>
                                <input type="text" name="nom" class="form-input" placeholder="Dupont" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Prénom *</label>
                                <input type="text" name="prenom" class="form-input" placeholder="Marie" required>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Email *</label>
                            <input type="email" name="email" class="form-input" placeholder="marie.dupont@hopital.fr" required>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Numéro de téléphone *</label>
                            <input type="tel" name="telephone" class="form-input" placeholder="06 12 34 56 78" required
                                   pattern="^(\\+33|0)[1-9][0-9]{8}$" 
                                   title="Numéro de téléphone français valide">
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Mot de passe temporaire *</label>
                            <input type="password" name="password" class="form-input" placeholder="••••••••" required
                                   minlength="6" title="Au moins 6 caractères">
                        </div>
                        
                        <div style="background: #fff3cd; padding: 1rem; border-radius: 6px; border-left: 4px solid #ffc107; margin: 1rem 0;">
                            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                <i class="fas fa-exclamation-triangle" style="color: #856404;"></i>
                                <strong>Information importante</strong>
                            </div>
                            <p style="margin: 0; font-size: 0.9rem; color: #856404; line-height: 1.4;">
                                L'enseignant recevra ses identifiants et devra changer son mot de passe à la première connexion.
                            </p>
                        </div>
                        
                        <div class="form-actions">
                            <button type="button" onclick="closeCreateTeacherModal()" class="btn-secondary">Annuler</button>
                            <button type="submit" class="btn-primary">
                                <i class="fas fa-user-plus"></i> Créer le compte
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>

        <!-- Modal Créer Étudiant -->
        <div id="create-student-modal" class="modal" style="display: none;">
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h3>Créer un compte étudiant</h3>
                    <button onclick="closeCreateStudentModal()" class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="create-student-form">
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Nom *</label>
                                <input type="text" name="nom" class="form-input" placeholder="Dupont" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Prénom *</label>
                                <input type="text" name="prenom" class="form-input" placeholder="Marie" required>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Email *</label>
                            <input type="email" name="email" class="form-input" placeholder="marie.dupont@student.fr" required>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Numéro de téléphone *</label>
                            <input type="tel" name="telephone" class="form-input" placeholder="06 12 34 56 78" required
                                   pattern="^(\\+33|0)[1-9][0-9]{8}$" 
                                   title="Numéro de téléphone français valide">
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Niveau d'études *</label>
                            <select name="niveau" class="form-input" required>
                                <option value="">Sélectionner un niveau</option>
                                <option value="DFGSM2">DFGSM2</option>
                                <option value="DFGSM3">DFGSM3</option>
                                <option value="DFASM1">DFASM1</option>
                                <option value="DFASM2">DFASM2</option>
                                <option value="DFASM3">DFASM3</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Faculté de médecine *</label>
                            <select name="faculte" class="form-input" required>
                                <option value="">Sélectionner une faculté</option>
                                <optgroup label="Région Parisienne">
                                    <option value="Sorbonne Université">Sorbonne Université</option>
                                    <option value="Université Paris Cité">Université Paris Cité</option>
                                    <option value="Sorbonne Université Paris Nord">Sorbonne Université Paris Nord</option>
                                    <option value="Université Paris-Est Créteil">Université Paris-Est Créteil</option>
                                    <option value="Université Paris-Saclay">Université Paris-Saclay</option>
                                    <option value="Université de Versailles Saint-Quentin (UVSQ)">Université de Versailles Saint-Quentin (UVSQ)</option>
                                </optgroup>
                                <optgroup label="Autres Régions">
                                    <option value="Université de Tours">Université de Tours</option>
                                    <option value="Université d'Orléans">Université d'Orléans</option>
                                    <option value="Université d'Aix-Marseille">Université d'Aix-Marseille</option>
                                    <option value="Université de Montpellier">Université de Montpellier</option>
                                    <option value="Université Côte d'Azur (Nice)">Université Côte d'Azur (Nice)</option>
                                    <option value="Université de Toulouse">Université de Toulouse</option>
                                    <option value="Université de Bordeaux">Université de Bordeaux</option>
                                    <option value="Université de Reims Champagne-Ardenne">Université de Reims Champagne-Ardenne</option>
                                    <option value="Université de Rouen Normandie">Université de Rouen Normandie</option>
                                </optgroup>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Mot de passe temporaire *</label>
                            <input type="password" name="password" class="form-input" placeholder="••••••••" required
                                   minlength="6" title="Au moins 6 caractères">
                        </div>
                        
                        <div style="background: #e1f5fe; padding: 1rem; border-radius: 6px; border-left: 4px solid #0288d1; margin: 1rem 0;">
                            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                <i class="fas fa-info-circle" style="color: #0277bd;"></i>
                                <strong>Information</strong>
                            </div>
                            <p style="margin: 0; font-size: 0.9rem; color: #0277bd; line-height: 1.4;">
                                Le compte sera créé avec email confirmé. L'étudiant pourra se connecter immédiatement.
                            </p>
                        </div>
                        
                        <div class="form-actions">
                            <button type="button" onclick="closeCreateStudentModal()" class="btn-secondary">Annuler</button>
                            <button type="submit" class="btn-primary">
                                <i class="fas fa-user-plus"></i> Créer le compte
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>

        <!-- Modal Réinitialiser MDP -->
        <div id="reset-password-modal" class="modal" style="display: none;">
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>Réinitialiser le mot de passe</h3>
                    <button onclick="closeResetPasswordModal()" class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="reset-password-form">
                        <input type="hidden" id="reset-user-id" name="userId">
                        <input type="hidden" id="reset-user-type" name="userType">
                        
                        <div class="user-info" id="reset-user-info">
                            <!-- Info utilisateur sera injectée ici -->
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Nouveau mot de passe *</label>
                            <input type="password" name="newPassword" class="form-input" placeholder="••••••••" required
                                   minlength="6" title="Au moins 6 caractères">
                        </div>
                        
                        <div class="form-actions">
                            <button type="button" onclick="closeResetPasswordModal()" class="btn-secondary">Annuler</button>
                            <button type="submit" class="btn-primary">
                                <i class="fas fa-key"></i> Réinitialiser
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>

        <script src="/static/app.js"></script>
        <script src="/static/header-init.js"></script>
        <script src="/static/super-admin.js"></script>
    </body>
    </html>
  `)
})

// Page Gestion des Étudiants (pour enseignants)
app.get('/gestion-etudiants', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Gestion des Étudiants - OMAS Externat</title>
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
                <nav class="nav-menu" style="display: flex; gap: 1.5rem; align-items: center; flex-wrap: wrap;">
                    <a href="/dashboard-enseignant" class="nav-link">Mes QCM</a>
                    <a href="/creer-qcm" class="nav-link">Créer un QCM</a>
                    <a href="/gestion-etudiants" class="nav-link active">Étudiants</a>
                    <a href="/" class="nav-link">Accueil</a>
                    <span class="nav-link" id="user-name-display" style="color: var(--teal-primary); font-weight: 600; display: flex; align-items: center; gap: 0.3rem;">
                        <i class="fas fa-user-circle"></i> <span id="user-name">Profil</span>
                    </span>
                    <a href="#" class="nav-link" onclick="logout(); return false;" style="display: flex; align-items: center; gap: 0.3rem; color: var(--red, #e74c3c); font-weight: 600;">
                        <i class="fas fa-sign-out-alt"></i> Déconnexion
                    </a>
                </nav>
            </div>
        </header>

        <div class="teacher-dashboard">
            <div class="dashboard-header">
                <h1 class="dashboard-title">Gestion des Étudiants</h1>
                <div class="dashboard-stats" id="students-stats">
                    <div class="stat-card">
                        <div class="stat-icon" style="background: linear-gradient(135deg, #667e74 0%, #7c3aed 100%);">
                            <i class="fas fa-users"></i>
                        </div>
                        <div class="stat-info">
                            <div class="stat-number" id="total-students">-</div>
                            <div class="stat-label">Étudiants inscrits</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Filtres -->
            <div class="filters-container" style="background: white; padding: 1.5rem; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                <div class="filters-row" style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
                    <div class="filter-group">
                        <label style="font-weight: 600; margin-right: 0.5rem;">Niveau :</label>
                        <select id="niveau-filter" class="form-input" style="width: auto;">
                            <option value="">Tous les niveaux</option>
                            <option value="DFGSM2">DFGSM 2</option>
                            <option value="DFGSM3">DFGSM 3</option>
                            <option value="DFASM1">DFASM 1</option>
                            <option value="DFASM2">DFASM 2</option>
                            <option value="DFASM3">DFASM 3</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <label style="font-weight: 600; margin-right: 0.5rem;">Recherche :</label>
                        <input type="text" id="search-filter" class="form-input" placeholder="Nom, prénom ou email..." style="width: 250px;">
                    </div>
                    <div class="filter-group">
                        <button onclick="exportStudentsCSV()" class="btn-secondary" style="width: auto;">
                            <i class="fas fa-download"></i> Exporter CSV
                        </button>
                    </div>
                </div>
            </div>

            <!-- Liste des étudiants -->
            <div class="students-container">
                <div id="students-list" class="students-grid">
                    <div style="text-align: center; padding: 3rem; grid-column: 1/-1;">
                        <div class="spinner"></div>
                        <p style="margin-top: 1rem;">Chargement des étudiants...</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Modal détails étudiant -->
        <div id="student-modal" class="modal" style="display: none;">
            <div class="modal-content" style="max-width: 800px;">
                <div class="modal-header">
                    <h3 id="student-modal-title">Détails de l'étudiant</h3>
                    <button onclick="closeStudentModal()" class="modal-close">&times;</button>
                </div>
                <div class="modal-body" id="student-modal-body">
                    <!-- Contenu injecté dynamiquement -->
                </div>
            </div>
        </div>

        <script src="/static/app.js"></script>
        <script src="/static/header-init.js"></script>
        <script src="/static/students-management.js"></script>
    </body>
    </html>
  `)
})

export default app
