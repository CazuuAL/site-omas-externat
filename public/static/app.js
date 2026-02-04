// Frontend JavaScript pour OMAS Externat

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
      
      // Rediriger vers l'espace étudiant
      window.location.href = '/espace-etudiant';
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
      body: JSON.stringify({ nom, prenom, email, password })
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

// Charger les QCM hebdomadaires
async function loadQCMList() {
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
                   Voir la correction <i class="fas fa-arrow-right"></i>
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
      <p>${qcm.description}</p>
      <div class="qcm-meta">
        <span><i class="fas fa-stethoscope"></i> ${qcm.specialite}</span>
        <span><i class="fas fa-question-circle"></i> ${questions.length} questions</span>
      </div>
    </div>
    <div class="questions-container">
  `;
  
  questions.forEach((question, index) => {
    html += `
      <div class="question-card">
        <div class="question-header">
          <span class="question-number">Question ${index + 1}</span>
        </div>
        <div class="question-body">
          <p class="question-text">${question.enonce}</p>
          <div class="options">
            <div class="option">
              <input type="radio" name="question-${question.id}" id="q${question.id}-a" value="A">
              <label for="q${question.id}-a">A. ${question.option_a}</label>
            </div>
            <div class="option">
              <input type="radio" name="question-${question.id}" id="q${question.id}-b" value="B">
              <label for="q${question.id}-b">B. ${question.option_b}</label>
            </div>
            <div class="option">
              <input type="radio" name="question-${question.id}" id="q${question.id}-c" value="C">
              <label for="q${question.id}-c">C. ${question.option_c}</label>
            </div>
            <div class="option">
              <input type="radio" name="question-${question.id}" id="q${question.id}-d" value="D">
              <label for="q${question.id}-d">D. ${question.option_d}</label>
            </div>
            ${question.option_e ? `
              <div class="option">
                <input type="radio" name="question-${question.id}" id="q${question.id}-e" value="E">
                <label for="q${question.id}-e">E. ${question.option_e}</label>
              </div>
            ` : ''}
          </div>
          <div class="answer-section" style="display: none;">
            <div class="correct-answer">
              <strong>Réponse correcte:</strong> ${question.reponse_correcte}
            </div>
            <div class="explanation">
              <strong>Explication:</strong> ${question.explication}
            </div>
          </div>
          <button class="btn-show-answer" onclick="showAnswer(${question.id})">
            Voir la correction
          </button>
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  container.innerHTML = html;
}

// Afficher la réponse d'une question
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
  if (connexionBtn) {
    connexionBtn.textContent = user.prenom;
    connexionBtn.href = '/espace-etudiant';
  }
}
