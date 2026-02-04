// Frontend JavaScript pour OMAS Externat

// Variables globales pour le QCM en cours
let currentQCM = null;
let currentQuestions = [];
let userAnswers = {};

// Gestion des onglets (Connexion / Inscription)
function initTabs() {
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      
      // Désactiver tous les onglets
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(tc => tc.classList.remove('active'));
      
      // Activer l'onglet sélectionné
      tab.classList.add('active');
      document.getElementById(target).classList.add('active');
    });
  });
}

// Gestion de la connexion
async function handleLogin(e) {
  e.preventDefault();
  
  const form = e.target;
  const email = form.email.value;
  const password = form.password.value;
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  
  // Désactiver le bouton pendant le traitement
  submitBtn.disabled = true;
  submitBtn.textContent = 'Connexion en cours...';
  
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      // Stocker le token et les infos utilisateur
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      // Rediriger selon le rôle
      if (data.user.role === 'teacher') {
        window.location.href = '/dashboard-enseignant';
      } else {
        window.location.href = '/espace-etudiant';
      }
    } else {
      showAlert(data.error || 'Email ou mot de passe incorrect', 'error');
    }
  } catch (error) {
    console.error('Erreur:', error);
    showAlert('Une erreur est survenue. Veuillez réessayer.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

// Gestion de l'inscription
async function handleRegister(e) {
  e.preventDefault();
  
  const form = e.target;
  const nom = form.nom.value;
  const prenom = form.prenom.value;
  const email = form.email.value;
  const password = form.password.value;
  const confirmPassword = form.confirmPassword.value;
  const role = form.role.value; // Récupérer le rôle
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  
  // Validation
  if (password !== confirmPassword) {
    showAlert('Les mots de passe ne correspondent pas', 'error');
    return;
  }
  
  if (password.length < 6) {
    showAlert('Le mot de passe doit contenir au moins 6 caractères', 'error');
    return;
  }
  
  submitBtn.disabled = true;
  submitBtn.textContent = 'Inscription en cours...';
  
  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ nom, prenom, email, password, role })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showAlert('Inscription réussie ! Vous pouvez maintenant vous connecter.', 'success');
      
      // Basculer vers l'onglet connexion après 2 secondes
      setTimeout(() => {
        document.querySelector('[data-tab="login-tab"]').click();
        form.reset();
      }, 2000);
    } else {
      showAlert(data.error || 'Une erreur est survenue lors de l\'inscription', 'error');
    }
  } catch (error) {
    console.error('Erreur:', error);
    showAlert('Une erreur est survenue. Veuillez réessayer.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

// Afficher un message d'alerte
function showAlert(message, type = 'info') {
  const existingAlert = document.querySelector('.alert');
  if (existingAlert) {
    existingAlert.remove();
  }
  
  const alert = document.createElement('div');
  alert.className = `alert alert-${type}`;
  alert.textContent = message;
  
  const form = document.querySelector('form');
  if (form) {
    form.insertBefore(alert, form.firstChild);
  }
  
  // Supprimer l'alerte après 5 secondes
  setTimeout(() => {
    alert.remove();
  }, 5000);
}

// Gestion de la déconnexion
function handleLogout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/connexion';
}

// Vérifier si l'utilisateur est connecté
function checkAuth() {
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user');
  
  if (token && user) {
    return JSON.parse(user);
  }
  
  return null;
}

// Fonction de déconnexion
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/connexion';
}

// Charger les QCM hebdomadaires
async function loadQCMList() {
  const container = document.getElementById('qcm-list');
  if (!container) return;
  
  // Vérifier si l'utilisateur est connecté
  const user = checkAuth();
  
  if (!user) {
    // Afficher un message invitant à se connecter
    container.innerHTML = `
      <div style="text-align: center; padding: 4rem 2rem; max-width: 600px; margin: 0 auto;">
        <div style="font-size: 4rem; color: var(--primary-color); margin-bottom: 1.5rem;">
          <i class="fas fa-lock"></i>
        </div>
        <h2 style="font-size: 1.8rem; color: var(--text-dark); margin-bottom: 1rem;">
          Connexion requise
        </h2>
        <p style="font-size: 1.1rem; color: var(--text-medium); margin-bottom: 2rem;">
          Vous devez être connecté pour accéder aux QCM hebdomadaires
        </p>
        <a href="/connexion" class="btn-primary" style="display: inline-block; text-decoration: none;">
          <i class="fas fa-sign-in-alt"></i> Se connecter
        </a>
      </div>
    `;
    return;
  }
  
  try {
    const response = await fetch('/api/qcm/list');
    const data = await response.json();
    
    if (response.ok) {
      displayQCMList(data.qcms);
    } else {
      console.error('Erreur lors du chargement des QCM');
    }
  } catch (error) {
    console.error('Erreur:', error);
  }
}

// Afficher la liste des QCM
function displayQCMList(qcms) {
  const container = document.getElementById('qcm-list');
  if (!container) return;
  
  container.innerHTML = '';
  
  if (qcms.length === 0) {
    container.innerHTML = '<p style="text-align: center; padding: 2rem;">Aucun QCM disponible pour le moment.</p>';
    return;
  }
  
  qcms.forEach(qcm => {
    const isAvailable = new Date() >= new Date(qcm.disponible_debut) && 
                       new Date() <= new Date(qcm.disponible_fin);
    
    const card = `
      <div class="qcm-card">
        <div class="qcm-header">
          <span class="qcm-badge">Semaine ${qcm.semaine}</span>
          <h3 class="qcm-title">${qcm.titre}</h3>
          <p class="qcm-description">${qcm.description}</p>
        </div>
        <div class="qcm-body">
          <div class="qcm-info">
            <div class="qcm-info-item">
              <i class="fas fa-calendar"></i>
              <span>Disponible: ${formatDate(qcm.disponible_debut)}</span>
            </div>
            <div class="qcm-info-item">
              <i class="fas fa-clock"></i>
              <span>Date limite: ${formatDate(qcm.date_limite)}</span>
            </div>
            <div class="qcm-info-item">
              <i class="fas fa-stethoscope"></i>
              <span>${qcm.specialite}</span>
            </div>
          </div>
          <div class="qcm-action">
            ${isAvailable 
              ? `<a href="/qcm/${qcm.id}" class="btn-qcm">
                   Effectuer le test <i class="fas fa-arrow-right"></i>
                 </a>`
              : `<span style="color: var(--gray-dark);">Bientôt disponible</span>`
            }
          </div>
        </div>
      </div>
    `;
    
    container.insertAdjacentHTML('beforeend', card);
  });
}

// Formater une date
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

// Gestion des FAQ (accordéon)
function initFAQ() {
  const faqQuestions = document.querySelectorAll('.faq-question');
  
  faqQuestions.forEach(question => {
    question.addEventListener('click', () => {
      const answer = question.nextElementSibling;
      const isActive = answer.classList.contains('active');
      
      // Fermer toutes les réponses
      document.querySelectorAll('.faq-answer').forEach(a => {
        a.classList.remove('active');
      });
      
      // Ouvrir la réponse sélectionnée si elle était fermée
      if (!isActive) {
        answer.classList.add('active');
      }
      
      // Modifier l'icône
      const icon = question.querySelector('i');
      if (icon) {
        icon.className = isActive ? 'fas fa-chevron-down' : 'fas fa-chevron-up';
      }
    });
  });
}

// Variables globales pour le QCM en cours
let currentQCM = null;
let currentQuestions = [];
let userAnswers = {};

// Charger un QCM spécifique avec ses questions
async function loadQCM(qcmId) {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`/api/qcm/${qcmId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    
    if (response.ok) {
      currentQCM = data.qcm;
      currentQuestions = data.questions;
      userAnswers = {};
      displayQCM(data.qcm, data.questions);
    } else {
      showAlert(data.error || 'Erreur lors du chargement du QCM', 'error');
    }
  } catch (error) {
    console.error('Erreur:', error);
    showAlert('Une erreur est survenue', 'error');
  }
}

// Afficher un QCM avec ses questions
function displayQCM(qcm, questions) {
  const container = document.getElementById('qcm-content');
  if (!container) return;
  
  let html = `
    <div class="qcm-header-full">
      <h1>${qcm.titre}</h1>
      <p>${qcm.description || ''}</p>
      <div class="qcm-meta">
        <span><i class="fas fa-stethoscope"></i> ${qcm.specialite}</span>
        <span><i class="fas fa-question-circle"></i> ${questions.length} questions</span>
      </div>
    </div>
    <form id="qcm-form" onsubmit="submitQCM(event)">
      <div class="questions-container">
  `;
  
  questions.forEach((question, index) => {
    const inputType = question.question_type === 'multiple' ? 'checkbox' : 'radio';
    const isMultiple = question.question_type === 'multiple';
    
    html += `
      <div class="question-card" data-question-id="${question.id}">
        <div class="question-header">
          <span class="question-number">Question ${index + 1}</span>
          ${isMultiple ? '<span class="badge-multiple">Réponses multiples</span>' : ''}
        </div>
        <div class="question-body">
          <p class="question-text">${question.enonce}</p>
          <div class="options">
            <div class="option">
              <input type="${inputType}" name="question-${question.id}" id="q${question.id}-a" value="A" ${isMultiple ? 'class="question-checkbox"' : ''}>
              <label for="q${question.id}-a">A. ${question.option_a}</label>
            </div>
            <div class="option">
              <input type="${inputType}" name="question-${question.id}" id="q${question.id}-b" value="B" ${isMultiple ? 'class="question-checkbox"' : ''}>
              <label for="q${question.id}-b">B. ${question.option_b}</label>
            </div>
            <div class="option">
              <input type="${inputType}" name="question-${question.id}" id="q${question.id}-c" value="C" ${isMultiple ? 'class="question-checkbox"' : ''}>
              <label for="q${question.id}-c">C. ${question.option_c}</label>
            </div>
            <div class="option">
              <input type="${inputType}" name="question-${question.id}" id="q${question.id}-d" value="D" ${isMultiple ? 'class="question-checkbox"' : ''}>
              <label for="q${question.id}-d">D. ${question.option_d}</label>
            </div>
            ${question.option_e ? `
              <div class="option">
                <input type="${inputType}" name="question-${question.id}" id="q${question.id}-e" value="E" ${isMultiple ? 'class="question-checkbox"' : ''}>
                <label for="q${question.id}-e">E. ${question.option_e}</label>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  });
  
  html += `
      </div>
      <div style="text-align: center; margin: 2rem 0;">
        <button type="submit" class="btn-primary" style="width: auto; padding: 1rem 3rem; font-size: 1.1rem;">
          <i class="fas fa-check-circle"></i> Valider et voir ma note
        </button>
      </div>
    </form>
  `;
  
  container.innerHTML = html;
}

// Soumettre le QCM et calculer la note
function submitQCM(e) {
  e.preventDefault();
  
  let score = 0;
  let totalQuestions = currentQuestions.length;
  let results = [];
  
  currentQuestions.forEach((question, index) => {
    let userAnswer;
    let isCorrect = false;
    
    if (question.question_type === 'multiple') {
      // Récupérer toutes les réponses cochées
      const checked = Array.from(document.querySelectorAll(`input[name="question-${question.id}"]:checked`))
        .map(input => input.value);
      userAnswer = checked;
      
      // Comparer avec les bonnes réponses
      const correctAnswers = JSON.parse(question.reponses_correctes || '[]');
      isCorrect = arraysEqual(checked.sort(), correctAnswers.sort());
    } else {
      // Réponse unique
      const selectedInput = document.querySelector(`input[name="question-${question.id}"]:checked`);
      userAnswer = selectedInput ? selectedInput.value : null;
      isCorrect = userAnswer === question.reponse_correcte;
    }
    
    if (isCorrect) {
      score++;
    }
    
    results.push({
      questionNumber: index + 1,
      question: question,
      userAnswer: userAnswer,
      isCorrect: isCorrect
    });
    
    userAnswers[question.id] = {
      answer: userAnswer,
      isCorrect: isCorrect
    };
  });
  
  // Calculer le pourcentage
  const percentage = ((score / totalQuestions) * 100).toFixed(1);
  
  // Enregistrer le score dans la base de données
  saveQcmProgress(score, totalQuestions, percentage / 100);
  
  // Afficher les résultats
  displayResults(score, totalQuestions, percentage, results);
}

// Enregistrer la progression dans la base de données
async function saveQcmProgress(correctAnswers, totalQuestions, scoreDecimal) {
  const user = JSON.parse(localStorage.getItem('user'));
  
  if (!user || !currentQCM) {
    console.error('❌ Cannot save progress: user or currentQCM is missing', { user, currentQCM });
    return;
  }
  
  console.log('💾 Saving progress:', {
    user_id: user.id,
    qcm_id: currentQCM.id,
    score: scoreDecimal,
    total_questions: totalQuestions,
    correct_answers: correctAnswers
  });
  
  try {
    const response = await fetch('/api/qcm/save-progress', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        user_id: user.id,
        qcm_id: currentQCM.id,
        score: scoreDecimal,
        total_questions: totalQuestions,
        correct_answers: correctAnswers,
        completed: 1
      })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Progression enregistrée avec succès:', data);
    } else {
      console.error('❌ Erreur serveur lors de l\'enregistrement:', data);
    }
  } catch (error) {
    console.error('❌ Erreur réseau lors de l\'enregistrement:', error);
  }
}

// Comparer deux tableaux
function arraysEqual(arr1, arr2) {
  if (arr1.length !== arr2.length) return false;
  for (let i = 0; i < arr1.length; i++) {
    if (arr1[i] !== arr2[i]) return false;
  }
  return true;
}

// Afficher les résultats
function displayResults(score, total, percentage, results) {
  const container = document.getElementById('qcm-content');
  if (!container) return;
  
  let resultClass = 'result-good';
  let resultIcon = 'fa-check-circle';
  let resultMessage = 'Excellent travail !';
  
  if (percentage < 50) {
    resultClass = 'result-poor';
    resultIcon = 'fa-times-circle';
    resultMessage = 'Continuez à réviser !';
  } else if (percentage < 75) {
    resultClass = 'result-average';
    resultIcon = 'fa-exclamation-circle';
    resultMessage = 'Bon travail, encore un effort !';
  }
  
  let html = `
    <div class="results-container">
      <div class="results-header ${resultClass}">
        <div class="results-icon">
          <i class="fas ${resultIcon}"></i>
        </div>
        <h2>Résultats du QCM</h2>
        <div class="results-score">
          <div class="score-big">${score}/${total}</div>
          <div class="score-percentage">${percentage}%</div>
        </div>
        <p class="results-message">${resultMessage}</p>
      </div>
      
      <div class="results-details">
        <h3>Détails par question</h3>
  `;
  
  results.forEach(result => {
    const statusClass = result.isCorrect ? 'correct' : 'incorrect';
    const statusIcon = result.isCorrect ? 'fa-check' : 'fa-times';
    const question = result.question;
    
    let correctAnswerText;
    if (question.question_type === 'multiple') {
      const correctAnswers = JSON.parse(question.reponses_correctes || '[]');
      correctAnswerText = correctAnswers.join(', ');
    } else {
      correctAnswerText = question.reponse_correcte;
    }
    
    let userAnswerText;
    if (Array.isArray(result.userAnswer)) {
      userAnswerText = result.userAnswer.length > 0 ? result.userAnswer.join(', ') : 'Aucune réponse';
    } else {
      userAnswerText = result.userAnswer || 'Aucune réponse';
    }
    
    html += `
      <div class="result-item ${statusClass}">
        <div class="result-item-header">
          <span class="result-item-number">Question ${result.questionNumber}</span>
          <span class="result-item-status">
            <i class="fas ${statusIcon}"></i>
            ${result.isCorrect ? 'Correct' : 'Incorrect'}
          </span>
        </div>
        <p class="result-item-question">${question.enonce}</p>
        <div class="result-item-answers">
          <p><strong>Votre réponse :</strong> ${userAnswerText}</p>
          <p><strong>Réponse correcte :</strong> ${correctAnswerText}</p>
        </div>
        <div class="result-item-explanation">
          <strong>Explication :</strong> ${question.explication}
        </div>
      </div>
    `;
  });
  
  html += `
      </div>
      
      <div style="text-align: center; margin: 2rem 0;">
        <p style="color: #666; margin-bottom: 1rem;">
          <i class="fas fa-check-circle" style="color: #10b981;"></i>
          Votre progression a été enregistrée avec succès !
        </p>
        <a href="/espace-etudiant" class="btn-primary" style="display: inline-block; text-decoration: none; margin-right: 1rem;">
          <i class="fas fa-chart-line"></i> Voir mon dashboard
        </a>
        <a href="/qcm" class="btn-secondary" style="display: inline-block; text-decoration: none;">
          <i class="fas fa-arrow-left"></i> Retour aux QCM
        </a>
      </div>
    </div>
  `;
  
  container.innerHTML = html;
  
  // Scroll vers le haut
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Afficher la réponse d'une question (ancienne fonction, gardée pour compatibilité)
function showAnswer(questionId) {
  const questionCard = event.target.closest('.question-card');
  const answerSection = questionCard.querySelector('.answer-section');
  const button = questionCard.querySelector('.btn-show-answer');
  
  if (answerSection.style.display === 'none') {
    answerSection.style.display = 'block';
    button.textContent = 'Masquer la correction';
  } else {
    answerSection.style.display = 'none';
    button.textContent = 'Voir la correction';
  }
}

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
  // Initialiser les onglets
  initTabs();
  
  // Initialiser la FAQ
  initFAQ();
  
  // Charger les QCM sur la page QCM
  if (document.getElementById('qcm-list')) {
    loadQCMList();
  }
  
  // Gérer les formulaires de connexion/inscription
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }
  
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', handleRegister);
  }
  
  // Mettre à jour le header si l'utilisateur est connecté
  const user = checkAuth();
  if (user) {
    updateHeaderForLoggedInUser(user);
  }
});

// Mettre à jour le header pour un utilisateur connecté
function updateHeaderForLoggedInUser(user) {
  const connexionBtn = document.querySelector('.btn-connexion');
  if (connexionBtn && connexionBtn.parentElement) {
    // Créer le menu profil
    const profileHtml = `
      <div class="profile-container">
        <button class="btn-connexion" id="profile-btn">
          <i class="fas fa-user"></i> ${user.prenom}
        </button>
        <div class="profile-dropdown" id="profile-dropdown">
          <div class="profile-dropdown-header">
            <p>${user.prenom} ${user.nom}</p>
            <small>${user.role === 'teacher' ? 'Enseignant' : 'Étudiant'}</small>
          </div>
          <a href="${user.role === 'teacher' ? '/dashboard-enseignant' : '/espace-etudiant'}" class="profile-dropdown-item">
            <i class="fas fa-home"></i>
            <span>Mon espace</span>
          </a>
          <div class="profile-dropdown-divider"></div>
          <a href="#" onclick="logout(); return false;" class="profile-dropdown-item">
            <i class="fas fa-sign-out-alt"></i>
            <span>Déconnexion</span>
        </div>
      </div>
    `;
    
    connexionBtn.parentElement.innerHTML = profileHtml;
    
    // Gérer le clic sur le bouton profil
    const profileBtn = document.getElementById('profile-btn');
    const profileDropdown = document.getElementById('profile-dropdown');
    
    if (profileBtn && profileDropdown) {
      profileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        profileDropdown.classList.toggle('active');
      });
      
      // Fermer le dropdown en cliquant ailleurs
      document.addEventListener('click', (e) => {
        if (!profileDropdown.contains(e.target) && e.target !== profileBtn) {
          profileDropdown.classList.remove('active');
        }
      });
    }
  }
}
