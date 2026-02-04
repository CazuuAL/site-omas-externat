// JavaScript pour le dashboard enseignant

// Tableau pour stocker les questions du formulaire
let questions = [];

// Charger les QCM de l'enseignant
async function loadTeacherQCMs() {
  console.log('📚 loadTeacherQCMs() - Début du chargement');
  
  const user = checkAuth();
  console.log('👤 Utilisateur:', user);
  
  if (!user || user.role !== 'teacher') {
    console.error('❌ Utilisateur non enseignant ou non connecté');
    window.location.href = '/connexion';
    return;
  }

  try {
    console.log(`🌐 Appel API: /api/teacher/qcm/list/${user.id}`);
    const response = await fetch(`/api/teacher/qcm/list/${user.id}`);
    const data = await response.json();
    
    console.log('📦 Réponse API:', data);

    if (response.ok) {
      console.log(`✅ ${data.qcms.length} QCM(s) trouvé(s)`);
      displayTeacherQCMs(data.qcms);
    } else {
      console.error('❌ Erreur réponse:', response.status);
      showAlert('Erreur lors du chargement des QCM', 'error');
    }
  } catch (error) {
    console.error('❌ Erreur fetch:', error);
    showAlert('Une erreur est survenue', 'error');
  }
}

// Afficher la liste des QCM de l'enseignant
function displayTeacherQCMs(qcms) {
  const container = document.getElementById('teacher-qcm-list');
  if (!container) return;

  container.innerHTML = '';

  if (qcms.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 3rem;">
        <i class="fas fa-inbox" style="font-size: 3rem; color: var(--gray-medium); margin-bottom: 1rem;"></i>
        <p style="color: var(--gray-dark); font-size: 1.1rem;">Vous n'avez pas encore créé de QCM</p>
        <a href="/creer-qcm" class="btn-primary" style="display: inline-block; margin-top: 1.5rem; text-decoration: none; width: auto;">
          Créer mon premier QCM
        </a>
      </div>
    `;
    return;
  }

  qcms.forEach(qcm => {
    const card = `
      <div class="teacher-qcm-card">
        <div class="teacher-qcm-header">
          <div>
            <span class="qcm-badge">${qcm.specialite}</span>
            ${qcm.is_published ? '<span class="status-badge published">Publié</span>' : '<span class="status-badge draft">Brouillon</span>'}
          </div>
          <div class="qcm-actions">
            <button onclick="editQCM(${qcm.id})" class="btn-icon" title="Modifier">
              <i class="fas fa-edit"></i>
            </button>
            <button onclick="togglePublish(${qcm.id}, ${qcm.is_published})" class="btn-icon" title="${qcm.is_published ? 'Dépublier' : 'Publier'}">
              <i class="fas fa-${qcm.is_published ? 'eye-slash' : 'eye'}"></i>
            </button>
            <button onclick="deleteQCM(${qcm.id})" class="btn-icon btn-danger" title="Supprimer">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
        <div class="teacher-qcm-body">
          <h3 class="qcm-title">${qcm.titre}</h3>
          <p class="qcm-description">${qcm.description || ''}</p>
          <div class="qcm-meta">
            <span><i class="fas fa-calendar"></i> Semaine ${qcm.semaine}</span>
            <span><i class="fas fa-clock"></i> Date limite: ${formatDate(qcm.date_limite)}</span>
          </div>
        </div>
      </div>
    `;

    container.insertAdjacentHTML('beforeend', card);
  });
}

// Publier/Dépublier un QCM
async function togglePublish(qcmId, currentStatus) {
  const newStatus = !currentStatus;
  const confirmMsg = newStatus ? 
    'Voulez-vous publier ce QCM ? Il sera visible par tous les étudiants.' :
    'Voulez-vous dépublier ce QCM ? Il ne sera plus visible par les étudiants.';

  if (!confirm(confirmMsg)) return;

  try {
    const response = await fetch(`/api/teacher/qcm/${qcmId}/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ is_published: newStatus })
    });

    if (response.ok) {
      showAlert(newStatus ? 'QCM publié avec succès' : 'QCM dépublié avec succès', 'success');
      loadTeacherQCMs(); // Recharger la liste
    } else {
      showAlert('Erreur lors de la mise à jour', 'error');
    }
  } catch (error) {
    console.error('Erreur:', error);
    showAlert('Une erreur est survenue', 'error');
  }
}

// Supprimer un QCM
async function deleteQCM(qcmId) {
  if (!confirm('Êtes-vous sûr de vouloir supprimer ce QCM ? Cette action est irréversible.')) {
    return;
  }

  try {
    const response = await fetch(`/api/teacher/qcm/${qcmId}`, {
      method: 'DELETE'
    });

    if (response.ok) {
      showAlert('QCM supprimé avec succès', 'success');
      loadTeacherQCMs(); // Recharger la liste
    } else {
      showAlert('Erreur lors de la suppression', 'error');
    }
  } catch (error) {
    console.error('Erreur:', error);
    showAlert('Une erreur est survenue', 'error');
  }
}

// Éditer un QCM
function editQCM(qcmId) {
  window.location.href = `/creer-qcm?edit=${qcmId}`;
}

// Charger un QCM pour édition
async function loadQCMForEdit(qcmId) {
  try {
    const response = await fetch(`/api/teacher/qcm/${qcmId}/details`);
    if (!response.ok) {
      throw new Error('QCM introuvable');
    }
    
    const data = await response.json();
    const qcm = data.qcm;
    const qcmQuestions = data.questions;
    
    console.log('📥 QCM chargé pour édition:', qcm);
    console.log('📥 Questions:', qcmQuestions);
    
    // Remplir le formulaire avec les données du QCM
    const titreInput = document.getElementById('titre');
    const specialiteSelect = document.getElementById('specialite');
    const semaineInput = document.getElementById('semaine');
    const descriptionInput = document.getElementById('description');
    const disponibleDebutInput = document.getElementById('disponible_debut');
    const disponibleFinInput = document.getElementById('disponible_fin');
    const dateLimiteInput = document.getElementById('date_limite');
    
    if (titreInput) titreInput.value = qcm.titre;
    if (specialiteSelect) specialiteSelect.value = qcm.specialite;
    if (semaineInput) semaineInput.value = qcm.semaine;
    if (descriptionInput) descriptionInput.value = qcm.description || '';
    if (disponibleDebutInput) disponibleDebutInput.value = qcm.disponible_debut;
    if (disponibleFinInput) disponibleFinInput.value = qcm.disponible_fin;
    if (dateLimiteInput) dateLimiteInput.value = qcm.date_limite;
    
    // Changer le titre et le bouton
    const pageTitle = document.querySelector('h1');
    if (pageTitle) pageTitle.textContent = 'Modifier le QCM';
    
    const submitBtn = document.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-save"></i> Enregistrer les modifications';
    
    // Ajouter les questions existantes
    qcmQuestions.forEach((q, index) => {
      addQuestion();
      
      // Remplir les champs de la question
      const form = document.getElementById('create-qcm-form');
      form[`question_type_${index}`].value = q.question_type || 'single';
      form[`enonce_${index}`].value = q.enonce;
      form[`option_a_${index}`].value = q.option_a;
      form[`option_b_${index}`].value = q.option_b;
      form[`option_c_${index}`].value = q.option_c;
      form[`option_d_${index}`].value = q.option_d;
      if (q.option_e) form[`option_e_${index}`].value = q.option_e;
      
      // Déclencher updateAnswerInputs pour mettre à jour les champs de réponse
      updateAnswerInputs(index);
      
      // Remplir la réponse correcte
      setTimeout(() => {
        if (q.question_type === 'multiple' && q.reponses_correctes) {
          const correctAnswers = JSON.parse(q.reponses_correctes);
          form[`reponse_correcte_${index}`].value = correctAnswers.join(',');
        } else if (q.reponse_correcte) {
          form[`reponse_correcte_${index}`].value = q.reponse_correcte;
        }
        
        form[`explication_${index}`].value = q.explication || '';
      }, 100);
    });
    
    // Modifier le formulaire pour envoyer une requête PUT au lieu de POST
    const form = document.getElementById('create-qcm-form');
    form.setAttribute('data-edit-id', qcmId);
    
  } catch (error) {
    console.error('Erreur lors du chargement du QCM:', error);
    showAlert('Erreur lors du chargement du QCM', 'error');
  }
}

// Gestion du formulaire de création de QCM

function addQuestion() {
  console.log('🔧 addQuestion() appelée - Questions actuelles:', questions.length);
  
  const questionDiv = document.createElement('div');
  questionDiv.className = 'question-item';
  questionDiv.dataset.index = questions.length;
  
  console.log('📦 Création de la div question, index:', questions.length);

  questionDiv.innerHTML = `
    <div class="question-header">
      <h4>Question ${questions.length + 1}</h4>
      <button type="button" onclick="removeQuestion(${questions.length})" class="btn-icon btn-danger">
        <i class="fas fa-times"></i>
      </button>
    </div>
    <div class="form-group">
      <label class="form-label">Type de question *</label>
      <select class="form-input" name="question_type_${questions.length}" onchange="updateAnswerInputs(${questions.length})" required>
        <option value="single">QCU - Réponse unique (radio)</option>
        <option value="multiple">QCM - Réponses multiples (checkbox)</option>
        <option value="qrp">QRP - Réponse ouverte courte</option>
        <option value="qroc">QROC - Question à réponse ouverte courte</option>
        <option value="qzp">QZP - Zones à pointer (image)</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Énoncé de la question *</label>
      <textarea class="form-input" name="enonce_${questions.length}" rows="3" required
        placeholder="Ex: Quels sont les facteurs de risque cardiovasculaire modifiables ?"></textarea>
    </div>
    <div class="form-group">
      <label class="form-label">Réponse A *</label>
      <input type="text" class="form-input" name="option_a_${questions.length}" required
        placeholder="Ex: Hypertension artérielle">
    </div>
    <div class="form-group">
      <label class="form-label">Réponse B *</label>
      <input type="text" class="form-input" name="option_b_${questions.length}" required>
    </div>
    <div class="form-group">
      <label class="form-label">Réponse C *</label>
      <input type="text" class="form-input" name="option_c_${questions.length}" required>
    </div>
    <div class="form-group">
      <label class="form-label">Réponse D *</label>
      <input type="text" class="form-input" name="option_d_${questions.length}" required>
    </div>
    <div class="form-group">
      <label class="form-label">Réponse E (optionnelle)</label>
      <input type="text" class="form-input" name="option_e_${questions.length}">
    </div>
    <div class="form-group" id="answer-input-${questions.length}">
      <label class="form-label">Réponse(s) correcte(s) *</label>
      <input type="text" class="form-input" name="reponse_correcte_${questions.length}" required
        placeholder="Ex: A (unique) ou A,C,D (multiples)" 
        pattern="^[A-E](,[A-E])*$"
        title="Entrez une ou plusieurs lettres séparées par des virgules (ex: A ou A,C,D)">
      <small class="form-help">Pour réponse unique: tapez A, B, C, D ou E<br>Pour réponses multiples: tapez A,C ou B,D,E (sans espaces)</small>
    </div>
    <div class="form-group">
      <label class="form-label">Explication de la réponse *</label>
      <textarea class="form-input" name="explication_${questions.length}" rows="3" required
        placeholder="Expliquez pourquoi cette/ces réponse(s) est/sont correcte(s)..."></textarea>
    </div>
  `;

  const container = document.getElementById('questions-container');
  if (!container) {
    console.error('❌ Container "questions-container" introuvable !');
    return;
  }
  
  console.log('✅ Ajout de la question au container');
  container.appendChild(questionDiv);
  questions.push({});
  console.log('✅ Question ajoutée ! Total:', questions.length);
  updateQuestionNumbers();
}

// Mettre à jour les inputs de réponse selon le type de question
function updateAnswerInputs(index) {
  const typeSelect = document.querySelector(`[name="question_type_${index}"]`);
  const answerContainer = document.getElementById(`answer-input-${index}`);
  
  if (!typeSelect || !answerContainer) return;
  
  const questionType = typeSelect.value;
  
  if (questionType === 'multiple') {
    // QCM - Réponses multiples
    answerContainer.innerHTML = `
      <label class="form-label">Réponses correctes * (plusieurs possibles)</label>
      <input type="text" class="form-input" name="reponse_correcte_${index}" required
        placeholder="Ex: A,C,D (sans espaces)" 
        pattern="^[A-E](,[A-E])*$"
        title="Entrez plusieurs lettres séparées par des virgules (ex: A,C,D)">
      <small class="form-help">Entrez les lettres des réponses correctes séparées par des virgules (ex: A,C ou B,D,E)</small>
    `;
  } else if (questionType === 'qrp' || questionType === 'qroc') {
    // QRP/QROC - Réponse ouverte courte
    answerContainer.innerHTML = `
      <label class="form-label">Réponse attendue *</label>
      <input type="text" class="form-input" name="reponse_attendue_${index}" required
        placeholder="Ex: Hypertension artérielle">
      <small class="form-help">La réponse de l'étudiant devra correspondre à cette réponse (comparaison exacte ou flexible)</small>
      <div class="form-group" style="margin-top: 1rem;">
        <label class="form-label">Variantes acceptées (optionnel)</label>
        <textarea class="form-input" name="variantes_${index}" rows="2"
          placeholder="Ex: HTA, Hypertension, Pression artérielle élevée (une par ligne)"></textarea>
        <small class="form-help">Entrez les variantes de réponse acceptées, une par ligne</small>
      </div>
    `;
  } else if (questionType === 'qzp') {
    // QZP - Zones à pointer sur image
    answerContainer.innerHTML = `
      <label class="form-label">URL de l'image *</label>
      <input type="url" class="form-input" name="image_url_${index}" required
        placeholder="Ex: https://example.com/image.jpg">
      <small class="form-help">Entrez l'URL de l'image sur laquelle l'étudiant devra cliquer</small>
      <div class="form-group" style="margin-top: 1rem;">
        <label class="form-label">Zones cliquables * (JSON)</label>
        <textarea class="form-input" name="zones_cliquables_${index}" rows="4" required
          placeholder='[{"x": 100, "y": 150, "width": 50, "height": 50, "label": "Zone 1"}]'></textarea>
        <small class="form-help">Format JSON: tableau d'objets avec x, y, width, height, label</small>
      </div>
    `;
  } else {
    // QCU - Réponse unique
    answerContainer.innerHTML = `
      <label class="form-label">Réponse correcte *</label>
      <input type="text" class="form-input" name="reponse_correcte_${index}" required
        placeholder="Ex: A" 
        pattern="^[A-E]$"
        title="Entrez une seule lettre (A, B, C, D ou E)">
      <small class="form-help">Entrez la lettre de la réponse correcte (A, B, C, D ou E)</small>
    `;
  }
}

function removeQuestion(index) {
  const questionItem = document.querySelector(`[data-index="${index}"]`);
  if (questionItem) {
    questionItem.remove();
    questions.splice(index, 1);
    updateQuestionNumbers();
  }
}

function updateQuestionNumbers() {
  const questionItems = document.querySelectorAll('.question-item');
  questionItems.forEach((item, index) => {
    item.dataset.index = index;
    item.querySelector('h4').textContent = `Question ${index + 1}`;
  });
}

// Soumettre le formulaire de création de QCM
async function handleCreateQCM(e) {
  e.preventDefault();

  const user = checkAuth();
  if (!user || user.role !== 'teacher') {
    showAlert('Vous devez être connecté en tant qu\'enseignant', 'error');
    return;
  }

  const form = e.target;
  const formData = {
    titre: form.titre.value,
    specialite: form.specialite.value,
    semaine: parseInt(form.semaine.value),
    description: form.description.value,
    disponible_debut: form.disponible_debut.value,
    disponible_fin: form.disponible_fin.value,
    date_limite: form.date_limite.value,
    created_by: user.id,
    questions: []
  };

  // Collecter les questions
  const questionItems = document.querySelectorAll('.question-item');
  questionItems.forEach((item, index) => {
    const questionType = form[`question_type_${index}`].value;
    const reponseInput = form[`reponse_correcte_${index}`].value.trim().toUpperCase();
    
    if (!reponseInput) {
      showAlert(`Question ${index + 1}: Vous devez entrer une réponse correcte`, 'error');
      throw new Error('Missing answer');
    }
    
    let reponseCorrecte;
    
    if (questionType === 'multiple') {
      // Pour réponses multiples, split par virgule et trim
      reponseCorrecte = reponseInput.split(',').map(r => r.trim()).filter(r => r);
      
      if (reponseCorrecte.length === 0) {
        showAlert(`Question ${index + 1}: Format invalide. Utilisez A,C,D pour plusieurs réponses`, 'error');
        throw new Error('Invalid format');
      }
      
      // Valider que toutes les réponses sont A-E
      const validAnswers = ['A', 'B', 'C', 'D', 'E'];
      for (const r of reponseCorrecte) {
        if (!validAnswers.includes(r)) {
          showAlert(`Question ${index + 1}: Réponse invalide "${r}". Utilisez seulement A, B, C, D ou E`, 'error');
          throw new Error('Invalid answer');
        }
      }
    } else {
      // Pour réponse unique, vérifier qu'il n'y a qu'une lettre
      if (reponseInput.length !== 1 || !'ABCDE'.includes(reponseInput)) {
        showAlert(`Question ${index + 1}: Entrez une seule lettre (A, B, C, D ou E)`, 'error');
        throw new Error('Invalid answer');
      }
      reponseCorrecte = reponseInput;
    }
    
    const question = {
      question_type: questionType,
      enonce: form[`enonce_${index}`].value,
      option_a: form[`option_a_${index}`].value,
      option_b: form[`option_b_${index}`].value,
      option_c: form[`option_c_${index}`].value,
      option_d: form[`option_d_${index}`].value,
      option_e: form[`option_e_${index}`]?.value || null,
      reponse_correcte: questionType === 'single' ? reponseCorrecte : null,
      reponses_correctes: questionType === 'multiple' ? JSON.stringify(reponseCorrecte) : null,
      explication: form[`explication_${index}`].value
    };
    formData.questions.push(question);
  });

  if (formData.questions.length === 0) {
    showAlert('Vous devez ajouter au moins une question', 'error');
    return;
  }

  console.log('📤 Données à envoyer:', formData);
  console.log('📊 Nombre de questions:', formData.questions.length);
  console.log('📋 Questions détaillées:', JSON.stringify(formData.questions, null, 2));

  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  
  // Vérifier si on est en mode édition
  const editId = form.getAttribute('data-edit-id');
  const isEditing = !!editId;
  
  submitBtn.textContent = isEditing ? 'Modification en cours...' : 'Création en cours...';

  try {
    const url = isEditing ? `/api/teacher/qcm/${editId}` : '/api/teacher/qcm/create';
    const method = isEditing ? 'PUT' : 'POST';
    
    const response = await fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData)
    });

    console.log('📥 Réponse serveur - Status:', response.status);
    const data = await response.json();
    console.log('📥 Réponse serveur - Data:', data);

    if (response.ok) {
      showAlert(isEditing ? 'QCM modifié avec succès !' : 'QCM créé avec succès !', 'success');
      setTimeout(() => {
        window.location.href = '/dashboard-enseignant';
      }, 1500);
    } else {
      showAlert(data.error || `Erreur lors de ${isEditing ? 'la modification' : 'la création'} du QCM`, 'error');
    }
  } catch (error) {
    console.error('Erreur:', error);
    showAlert('Une erreur est survenue', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
  // Vérifier l'authentification et mettre à jour le header
  const user = checkAuth();
  if (user && user.role === 'teacher') {
    // Mettre à jour le nom dans le menu
    const userName = document.getElementById('user-name');
    if (userName) {
      userName.textContent = user.prenom;
    }
    
    // Initialiser le menu déroulant
    // Le menu profil est maintenant géré par header-init.js
  }
  
  // Dashboard enseignant
  if (document.getElementById('teacher-qcm-list')) {
    loadTeacherQCMs();
  }

  // Page de création de QCM
  if (document.getElementById('create-qcm-form')) {
    console.log('✅ Formulaire de création détecté');
    console.log('📝 Tableau questions initialisé:', questions);
    
    const form = document.getElementById('create-qcm-form');
    form.addEventListener('submit', handleCreateQCM);

    // Vérifier si on est en mode édition
    const urlParams = new URLSearchParams(window.location.search);
    const editId = urlParams.get('edit');
    
    if (editId) {
      console.log('✏️ Mode édition détecté pour le QCM ID:', editId);
      loadQCMForEdit(editId);
    } else {
      // Ajouter une première question par défaut uniquement en mode création
      console.log('➕ Ajout de la première question par défaut');
      addQuestion();
    }
  }

  // Bouton d'ajout de question
  const addQuestionBtn = document.getElementById('add-question-btn');
  if (addQuestionBtn) {
    console.log('✅ Bouton "Ajouter une question" détecté');
    addQuestionBtn.addEventListener('click', () => {
      console.log('🖱️ Clic sur le bouton "Ajouter une question"');
      console.log('📝 Nombre de questions actuel:', questions.length);
      addQuestion();
    });
  } else {
    console.error('❌ Bouton "add-question-btn" introuvable !');
  }
});
