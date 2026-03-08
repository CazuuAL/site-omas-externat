// JavaScript pour le dashboard enseignant

console.log('🚀 teacher.js chargé - début de l\'exécution');

// Utilitaire pour formater les dates
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

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
    console.log('📥 Chargement QCM pour édition, ID:', qcmId);
    
    const response = await fetch(`/api/teacher/qcm/${qcmId}/details`);
    if (!response.ok) {
      throw new Error('QCM introuvable');
    }
    
    const data = await response.json();
    const qcm = data.qcm;
    const qcmQuestions = data.questions;
    
    console.log('📥 QCM chargé pour édition:', qcm);
    console.log('📥 Questions chargées:', qcmQuestions.length, 'questions');
    
    // Remplir le formulaire avec les données du QCM
    const titreInput = document.getElementById('titre');
    const specialiteSelect = document.getElementById('specialite');
    const semaineInput = document.getElementById('semaine');
    const descriptionInput = document.getElementById('description');
    const disponibleDebutInput = document.getElementById('disponible_debut');
    const disponibleFinInput = document.getElementById('disponible_fin');
    const dateLimiteInput = document.getElementById('date_limite');
    const isDPCheckbox = document.getElementById('is_dossier_progressif');
    const contexteInput = document.getElementById('contexte_initial');
    
    if (titreInput) titreInput.value = qcm.titre || '';
    if (specialiteSelect) specialiteSelect.value = qcm.specialite || '';
    if (semaineInput) semaineInput.value = qcm.semaine || '';
    if (descriptionInput) descriptionInput.value = qcm.description || '';
    if (disponibleDebutInput) disponibleDebutInput.value = qcm.disponible_debut || '';
    if (disponibleFinInput) disponibleFinInput.value = qcm.disponible_fin || '';
    if (dateLimiteInput) dateLimiteInput.value = qcm.date_limite || '';
    if (isDPCheckbox) {
      isDPCheckbox.checked = qcm.is_dossier_progressif === 1;
      // Déclencher l'événement pour afficher/masquer le champ contexte
      isDPCheckbox.dispatchEvent(new Event('change'));
    }
    if (contexteInput) contexteInput.value = qcm.contexte_initial || '';
    
    // Changer le titre et le bouton
    const pageTitle = document.querySelector('h1');
    if (pageTitle) pageTitle.textContent = 'Modifier le QCM';
    
    const submitBtn = document.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-save"></i> Enregistrer les modifications';
    
    // Vider les questions existantes dans l'interface
    const questionsContainer = document.getElementById('questions-container');
    if (questionsContainer) {
      questionsContainer.innerHTML = '';
    }
    questions = []; // Réinitialiser le tableau global
    
    // Ajouter les questions existantes
    qcmQuestions.forEach((q, index) => {
      console.log(`📝 Chargement question ${index + 1}:`, q.enonce.substring(0, 50) + '...');
      
      // Ajouter une nouvelle question vide d'abord
      addQuestion();
      
      // Attendre un court délai pour que les éléments soient créés
      setTimeout(() => {
        fillQuestionFields(index, q);
      }, 50 * (index + 1)); // Délai progressif pour éviter les conflits
    });
    
    // Modifier le formulaire pour envoyer une requête PUT au lieu de POST
    const form = document.getElementById('create-qcm-form');
    form.setAttribute('data-edit-id', qcmId);
    
    console.log('✅ QCM chargé avec succès pour édition');
    
  } catch (error) {
    console.error('Erreur lors du chargement du QCM:', error);
    showAlert('Erreur lors du chargement du QCM: ' + error.message, 'error');
  }
}

// Fonction pour remplir les champs d'une question spécifique
function fillQuestionFields(index, questionData) {
  try {
    console.log(`🔧 Remplissage question ${index + 1}:`, questionData.question_type);
    
    // Récupérer les éléments par leur ID
    const typeSelect = document.getElementById(`question_type_${index}`);
    const enonceInput = document.getElementById(`enonce_${index}`);
    const optionA = document.getElementById(`option_a_${index}`);
    const optionB = document.getElementById(`option_b_${index}`);
    const optionC = document.getElementById(`option_c_${index}`);
    const optionD = document.getElementById(`option_d_${index}`);
    const optionE = document.getElementById(`option_e_${index}`);
    const explicationsInput = document.getElementById(`explication_${index}`);
    
    // Remplir les champs de base
    if (typeSelect) {
      typeSelect.value = questionData.question_type || 'single';
      // Déclencher l'événement change pour mettre à jour l'interface
      typeSelect.dispatchEvent(new Event('change'));
    }
    
    if (enonceInput) enonceInput.value = questionData.enonce || '';
    if (optionA) optionA.value = questionData.option_a || '';
    if (optionB) optionB.value = questionData.option_b || '';
    if (optionC) optionC.value = questionData.option_c || '';
    if (optionD) optionD.value = questionData.option_d || '';
    if (optionE) optionE.value = questionData.option_e || '';
    if (explicationsInput) explicationsInput.value = questionData.explication || '';
    
    // Déclencher updateAnswerInputs pour créer les champs de réponse
    updateAnswerInputs(index);
    
    // Attendre que les champs de réponse soient créés, puis les remplir
    setTimeout(() => {
      const reponseInput = document.getElementById(`reponse_correcte_${index}`);
      if (reponseInput) {
        let reponseValue = '';
        
        if (questionData.question_type === 'multiple' && questionData.reponses_correctes) {
          // Gérer le format des réponses multiples
          try {
            // Essayer de parser comme JSON d'abord
            const correctAnswers = JSON.parse(questionData.reponses_correctes);
            if (Array.isArray(correctAnswers)) {
              reponseValue = correctAnswers.join(',');
            } else {
              reponseValue = questionData.reponses_correctes;
            }
          } catch (e) {
            // Si ce n'est pas du JSON, utiliser directement la valeur
            reponseValue = questionData.reponses_correctes;
          }
        } else if (questionData.question_type === 'qrp' && questionData.reponses_correctes) {
          // QRP utilise aussi reponses_correctes
          try {
            const correctAnswers = JSON.parse(questionData.reponses_correctes);
            if (Array.isArray(correctAnswers)) {
              reponseValue = correctAnswers.join(',');
            } else {
              reponseValue = questionData.reponses_correctes;
            }
          } catch (e) {
            reponseValue = questionData.reponses_correctes;
          }
        } else if (questionData.question_type === 'qroc' && questionData.reponse_attendue) {
          // QROC utilise reponse_attendue
          reponseValue = questionData.reponse_attendue;
        } else if (questionData.reponse_correcte) {
          // Types simples (QRU) utilisent reponse_correcte
          reponseValue = questionData.reponse_correcte;
        }
        
        reponseInput.value = reponseValue;
        console.log(`✅ Réponse remplie pour question ${index + 1}:`, reponseValue);
      }
      
      // Remplir les champs spéciaux selon le type
      if (questionData.question_type === 'qrp') {
        const nombreInput = document.getElementById(`nombre_reponses_${index}`);
        if (nombreInput && questionData.nombre_reponses_attendues) {
          nombreInput.value = questionData.nombre_reponses_attendues;
        }
        
        // Remplir les options QRP
        fillQRPOptions(index, questionData);
      }
      
      if (questionData.question_type === 'qzp') {
        const imageInput = document.getElementById(`image_url_${index}`);
        const zonesInput = document.getElementById(`zones_cliquables_${index}`);
        if (imageInput) imageInput.value = questionData.image_url || '';
        if (zonesInput) zonesInput.value = questionData.zones_cliquables || '';
      }
      
    }, 200); // Délai pour laisser le temps aux champs d'être créés
    
    console.log(`✅ Question ${index + 1} remplie avec succès`);
    
  } catch (error) {
    console.error(`❌ Erreur lors du remplissage de la question ${index + 1}:`, error);
  }
}

// === Fonction pour remplir les options QRP lors de l'édition ===
function fillQRPOptions(questionIndex, questionData) {
  try {
    console.log(`🔧 Remplissage options QRP pour question ${questionIndex + 1}:`, questionData);
    
    let options = [];
    
    // Essayer d'abord de parser options_json
    if (questionData.options_json && questionData.options_json !== 'null') {
      try {
        options = JSON.parse(questionData.options_json);
        console.log('📊 Options depuis JSON:', options);
      } catch (e) {
        console.warn('⚠️ Erreur parsing options_json:', e);
      }
    }
    
    // Si pas d'options JSON, utiliser les colonnes A-E classiques
    if (options.length === 0) {
      const stdOptions = [];
      if (questionData.option_a) stdOptions.push({ text: questionData.option_a, correction: 'vrai' });
      if (questionData.option_b) stdOptions.push({ text: questionData.option_b, correction: 'vrai' });
      if (questionData.option_c) stdOptions.push({ text: questionData.option_c, correction: 'vrai' });
      if (questionData.option_d) stdOptions.push({ text: questionData.option_d, correction: 'faux' });
      if (questionData.option_e) stdOptions.push({ text: questionData.option_e, correction: 'faux' });
      
      options = stdOptions;
      console.log('📝 Options depuis colonnes A-E:', options);
    }
    
    // Générer les options dans l'interface (par défaut 5, mais adapter si besoin)
    const optionCount = Math.max(5, options.length);
    generateQRPOptions(questionIndex, optionCount);
    
    // Remplir les champs créés avec les données
    options.forEach((option, i) => {
      const textInput = document.getElementById(`qrp_option_text_${i}_${questionIndex}`);
      const typeSelect = document.getElementById(`qrp_option_type_${i}_${questionIndex}`);
      
      if (textInput && typeSelect) {
        textInput.value = option.text || '';
        typeSelect.value = option.correction || 'vrai';
        console.log(`✅ Option ${i + 1} remplie: "${option.text}" (${option.correction})`);
      }
    });
    
    console.log(`✅ Options QRP remplies avec succès pour question ${questionIndex + 1}`);
    
  } catch (error) {
    console.error(`❌ Erreur lors du remplissage QRP question ${questionIndex + 1}:`, error);
  }
}

// Gestion du formulaire de création de QCM

function addQuestion() {
  console.log('🔧 addQuestion() appelée - Questions actuelles:', questions.length);
  console.log('🔍 Container questions:', document.getElementById('questions-container'));
  
  try {
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
      <select class="form-input" id="question_type_${questions.length}" name="question_type_${questions.length}" onchange="updateAnswerInputs(${questions.length})" required>
        <option value="single">QCU - Réponse unique (radio)</option>
        <option value="multiple">QCM - Réponses multiples (checkbox)</option>
        <option value="qrp">QRP - Questions à réponses précises (5+ options)</option>
        <option value="qroc">QROC - Réponse ouverte courte</option>
        <option value="qzp">QZP - Zones à pointer (image)</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Énoncé de la question *</label>
      <textarea class="form-input" id="enonce_${questions.length}" name="enonce_${questions.length}" rows="3" required
        placeholder="Ex: Quels sont les facteurs de risque cardiovasculaire modifiables ?"></textarea>
    </div>
    
    <!-- Champ infos d'étape pour les dossiers progressifs -->
    <div class="form-group infos-etape-group" id="infos-etape-group-${questions.length}" style="background: #f0f4f8; padding: 1rem; border-radius: 6px; border-left: 4px solid #7c3aed; display: none;">
      <label class="form-label">
        <i class="fas fa-info-circle" style="color: #7c3aed;"></i> 
        Informations révélées à cette étape
      </label>
      <textarea name="infos_etape_${questions.length}" class="form-input" rows="3"
                placeholder="Ex: L'ECG montre un sus-décalage en DII, DIII, aVF. La troponine est à 15 ng/mL..."></textarea>
      <small style="color: #666; font-style: italic;">
        Nouvelles informations cliniques, résultats d'examens, évolution...
      </small>
    </div>
    
    <div id="question-content-${questions.length}">
      <!-- Le contenu sera ajouté dynamiquement selon le type -->
    </div>
    <div class="form-group">
      <label class="form-label">Explication de la réponse *</label>
      <textarea class="form-input" id="explication_${questions.length}" name="explication_${questions.length}" rows="3" required
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
  
  // Vérifier si le mode DP est activé pour afficher le champ infos d'étape
  const isDPMode = document.getElementById('is_dossier_progressif');
  if (isDPMode && isDPMode.checked) {
    const infosEtapeGroup = document.getElementById(`infos-etape-group-${questions.length - 1}`);
    if (infosEtapeGroup) {
      infosEtapeGroup.style.display = 'block';
    }
  }
  
  // Initialiser le contenu selon le type par défaut (single)
  updateAnswerInputs(questions.length - 1);
  
  console.log('✅ Question ajoutée avec succès, total:', questions.length);
  
  } catch (error) {
    console.error('❌ Erreur dans addQuestion():', error);
    console.error('Stack trace:', error.stack);
  }
}

// Mettre à jour les inputs de réponse selon le type de question
function updateAnswerInputs(index) {
  const typeSelect = document.querySelector(`[name="question_type_${index}"]`);
  const contentContainer = document.getElementById(`question-content-${index}`);
  
  if (!typeSelect || !contentContainer) return;
  
  const questionType = typeSelect.value;
  
  if (questionType === 'single' || questionType === 'multiple') {
    // QCU/QCM - Options A, B, C, D, E + réponse correcte
    contentContainer.innerHTML = `
      <div class="form-group">
        <label class="form-label">Réponse A *</label>
        <input type="text" class="form-input" id="option_a_${index}" name="option_a_${index}" required
          placeholder="Ex: Hypertension artérielle">
      </div>
      <div class="form-group">
        <label class="form-label">Réponse B *</label>
        <input type="text" class="form-input" id="option_b_${index}" name="option_b_${index}" required>
      </div>
      <div class="form-group">
        <label class="form-label">Réponse C *</label>
        <input type="text" class="form-input" id="option_c_${index}" name="option_c_${index}" required>
      </div>
      <div class="form-group">
        <label class="form-label">Réponse D *</label>
        <input type="text" class="form-input" id="option_d_${index}" name="option_d_${index}" required>
      </div>
      <div class="form-group">
        <label class="form-label">Réponse E (optionnelle)</label>
        <input type="text" class="form-input" id="option_e_${index}" name="option_e_${index}">
      </div>
      <div class="form-group">
        <label class="form-label">Réponse(s) correcte(s) *</label>
        <input type="text" class="form-input" id="reponse_correcte_${index}" name="reponse_correcte_${index}" required
          placeholder="${questionType === 'multiple' ? 'Ex: A,C,D (sans espaces)' : 'Ex: A'}" 
          pattern="^[A-E](,[A-E])*$"
          title="Entrez ${questionType === 'multiple' ? 'plusieurs lettres séparées par des virgules' : 'une seule lettre'}">
        <small class="form-help">${questionType === 'multiple' ? 'Entrez les lettres des réponses correctes séparées par des virgules (ex: A,C,D)' : 'Entrez la lettre de la réponse correcte (A, B, C, D ou E)'}</small>
      </div>
    `;
  } else if (questionType === 'qrp') {
    // QRP Unifié - Interface dynamique avec bouton +
    contentContainer.innerHTML = `
      <div class="qrp-info" style="background: var(--teal-light); padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
        <h4>Configuration QRP - Questions à Réponses Précises</h4>
        <p><strong>Instructions:</strong> Définissez les options avec leur type de correction</p>
        <p><strong>Types de correction:</strong></p>
        <ul style="margin: 0.5rem 0; padding-left: 1.5rem;">
          <li><strong>Indispensable:</strong> Obligatoire pour avoir des points</li>
          <li><strong>Inacceptable:</strong> Interdit, sinon 0 point total</li>
          <li><strong>Vrai:</strong> Compte positivement</li>
          <li><strong>Faux:</strong> N'apporte pas de points</li>
        </ul>
        <p><strong>Minimum:</strong> 4 options requises</p>
      </div>
      
      <div class="form-group">
        <label class="form-label">Nombre de réponses attendues *</label>
        <input type="number" class="form-input" name="nombre_reponses_attendues_${index}" 
          min="1" max="25" value="3" required onchange="validateExpectedAnswers(${index})">
        <small class="form-help">Nombre de bonnes réponses que l'étudiant doit sélectionner (≤ nombre total d'options)</small>
      </div>
      
      <div class="qrp-options-container" id="qrp-options-container-${index}">
        <!-- Options dynamiques générées par JavaScript -->
      </div>
      
      <div class="qrp-controls" style="margin-top: 1rem; display: flex; gap: 10px;">
        <button type="button" class="btn btn-secondary" onclick="addQRPOption(${index})" id="add-qrp-option-${index}">
          <i class="fas fa-plus"></i> Ajouter une option
        </button>
        <span class="qrp-counter" id="qrp-option-counter-${index}" style="padding: 0.5rem; color: #666;">
          Options : <span id="qrp-count-${index}">5</span>
        </span>
      </div>
    `;
    
    // Générer les 5 options par défaut
    generateQRPOptions(index, 5);
  } else if (questionType === 'qroc') {
    // QROC - Réponse ouverte courte (texte libre)
    contentContainer.innerHTML = `
      <div class="form-group">
        <label class="form-label">Réponse attendue *</label>
        <input type="text" class="form-input" name="reponse_attendue_${index}" required
          placeholder="Ex: Hypertension artérielle">
        <small class="form-help">La réponse que l'étudiant devra saisir (comparaison exacte)</small>
      </div>
      <div class="form-group">
        <label class="form-label">Variantes acceptées (optionnel)</label>
        <textarea class="form-input" name="variantes_${index}" rows="3"
          placeholder="Ex: HTA&#10;Hypertension&#10;Pression artérielle élevée"></textarea>
        <small class="form-help">Entrez les variantes de réponse acceptées, une par ligne</small>
      </div>
    `;
  } else if (questionType === 'qzp') {
    // QZP - Drag & Drop sur image (style Moodle ddimageortext)
    contentContainer.innerHTML = `
      <div class="qzp-info" style="background: var(--purple-light, #f3e5f5); padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
        <h4>Configuration QZP - Glisser-Déposer sur Image</h4>
        <p><strong>Principe:</strong> L'étudiant glisse des éléments textuels vers des zones prédéfinies sur l'image</p>
        <p><strong>Étapes:</strong></p>
        <ol style="margin: 0.5rem 0; padding-left: 1.5rem;">
          <li>Upload de l'image de fond</li>
          <li>Définition des zones de dépôt (rectangles sur l'image)</li>
          <li>Création des éléments à glisser (texte)</li>
          <li>Association zones ↔ éléments corrects</li>
        </ol>
      </div>
      
      <!-- 1. Upload de l'image -->
      <div class="form-group">
        <label class="form-label">Image de fond *</label>
        <input type="file" class="form-input" id="qzp_image_upload_${index}" accept="image/*" required
          onchange="handleQZPImageUpload(${index}, event)">
        <small class="form-help">Image sur laquelle seront définies les zones de dépôt</small>
        <div id="qzp_image_preview_${index}" style="margin-top: 1rem; display: none;">
          <img id="qzp_preview_img_${index}" style="max-width: 100%; border: 2px solid var(--gray-light); border-radius: 8px;" />
        </div>
      </div>
      
      <!-- 2. Définition des zones de drop -->
      <div class="form-group" id="qzp_zones_section_${index}" style="display: none;">
        <label class="form-label">Zones de dépôt</label>
        <div style="margin-bottom: 1rem;">
          <button type="button" class="btn btn-secondary" onclick="startDefiningQZPZone(${index})">
            <i class="fas fa-plus"></i> Ajouter une zone de dépôt
          </button>
          <small style="margin-left: 1rem; color: #666;">Cliquez puis tracez un rectangle sur l'image</small>
        </div>
        
        <!-- Canvas pour définir les zones -->
        <div id="qzp_canvas_container_${index}" style="position: relative; display: none; margin-bottom: 1rem;">
          <canvas id="qzp_canvas_${index}" style="border: 2px solid var(--teal-primary); border-radius: 8px; cursor: crosshair;"></canvas>
          <div id="qzp_zone_info_${index}" style="position: absolute; top: 10px; left: 10px; background: rgba(0,0,0,0.7); color: white; padding: 0.5rem; border-radius: 4px; font-size: 0.8rem;">
            Mode définition de zones - Tracez des rectangles sur l'image
          </div>
        </div>
        
        <!-- Liste des zones définies -->
        <div id="qzp_zones_list_${index}" style="margin-top: 1rem;">
          <!-- Zones générées dynamiquement -->
        </div>
      </div>
      
      <!-- 3. Éléments à glisser (drag items) -->
      <div class="form-group" id="qzp_items_section_${index}" style="display: none;">
        <label class="form-label">Éléments à glisser</label>
        <div style="margin-bottom: 1rem;">
          <button type="button" class="btn btn-secondary" onclick="addQZPDragItem(${index})">
            <i class="fas fa-plus"></i> Ajouter un élément
          </button>
          <small style="margin-left: 1rem; color: #666;">Minimum 3 éléments (dont distracteurs)</small>
        </div>
        
        <div id="qzp_drag_items_${index}">
          <!-- Éléments à glisser générés dynamiquement -->
        </div>
      </div>
      
      <!-- Données cachées -->
      <input type="hidden" name="qzp_image_url_${index}" id="qzp_image_url_${index}">
      <input type="hidden" name="qzp_zones_data_${index}" id="qzp_zones_data_${index}" value="[]">
      <input type="hidden" name="qzp_items_data_${index}" id="qzp_items_data_${index}" value="[]">
      <input type="hidden" name="qzp_mapping_data_${index}" id="qzp_mapping_data_${index}" value="{}">
    `;
  }
}

// Gestion de l'upload d'image pour les questions QZP
let questionImages = {}; // Stocker les images par index

function handleImageUpload(index, event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    const imageData = e.target.result;
    questionImages[index] = imageData;
    
    // Stocker dans le hidden input
    document.getElementById(`image_url_${index}`).value = imageData;
    
    // Afficher l'aperçu QZP
    const previewContainer = document.getElementById(`qzp_image_preview_${index}`);
    const previewImg = document.getElementById(`qzp_preview_img_${index}`);
    
    if (previewContainer && previewImg) {
      previewImg.src = imageData;
      previewContainer.style.display = 'block';
    }
    
    // Afficher la section des zones QZP
    const zonesSection = document.getElementById(`qzp_zones_section_${index}`);
    if (zonesSection) {
      zonesSection.style.display = 'block';
    }
    
    // Afficher la section des éléments QZP  
    const itemsSection = document.getElementById(`qzp_items_section_${index}`);
    if (itemsSection) {
      itemsSection.style.display = 'block';
    }
    if (addZoneBtn) {
      addZoneBtn.disabled = false;
      addZoneBtn.style.opacity = '1';
      addZoneBtn.style.cursor = 'pointer';
      addZoneBtn.innerHTML = '<i class="fas fa-plus"></i> Ajouter une zone';
    }
    
    console.log('✅ Image chargée pour la question', index);
  };
  reader.readAsDataURL(file);
}

// Toggle entre mode aperçu et mode dessin de zone
let canvasMode = {}; // Stocker l'état du mode canvas par index
let zones = {}; // Stocker les zones par index
let draggedZone = {}; // Zone en cours de déplacement par index

function toggleCanvasMode(index) {
  const canvas = document.getElementById(`canvas_${index}`);
  const previewImg = document.getElementById(`preview_img_${index}`);
  
  // Vérifier que l'image est bien uploadée
  if (!questionImages[index]) {
    alert('⚠️ Veuillez d\'abord uploader une image avant d\'ajouter des zones.');
    return;
  }
  
  if (!zones[index]) {
    zones[index] = [];
  }
  
  if (canvasMode[index]) {
    // Désactiver le mode canvas
    canvas.style.display = 'none';
    previewImg.style.display = 'block';
    canvasMode[index] = false;
  } else {
    // Activer le mode canvas
    canvas.style.display = 'block';
    previewImg.style.display = 'none';
    canvasMode[index] = true;
    
    // Initialiser le canvas avec l'image
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = function() {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      // Redessiner les zones existantes
      redrawZones(index);
    };
    img.src = questionImages[index];
    
    // Variables pour le drag & drop
    draggedZone[index] = null;
    let isDragging = false;
    
    // Fonction pour vérifier si un point est dans une zone
    function getZoneAtPosition(x, y) {
      for (let i = zones[index].length - 1; i >= 0; i--) {
        const zone = zones[index][i];
        const distance = Math.sqrt(Math.pow(x - zone.x, 2) + Math.pow(y - zone.y, 2));
        if (distance <= zone.radius) {
          return i;
        }
      }
      return -1;
    }
    
    // Mousedown: détecter si on clique sur une zone ou pas
    canvas.onmousedown = function(e) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      
      const zoneIndex = getZoneAtPosition(x, y);
      
      if (zoneIndex !== -1) {
        // On clique sur une zone existante → mode drag
        isDragging = true;
        draggedZone[index] = zoneIndex;
        canvas.style.cursor = 'grabbing';
        console.log('🖱️ Début du déplacement de la zone', zoneIndex + 1);
      } else {
        // On clique sur un espace vide → créer une nouvelle zone
        const zoneName = prompt('Nom de cette zone (ex: "Artère aorte") :');
        if (!zoneName) return;
        
        const zoneRadius = prompt('Rayon de la zone en pixels (défaut: 30) :') || 30;
        
        zones[index].push({
          x: Math.round(x),
          y: Math.round(y),
          radius: parseInt(zoneRadius),
          label: zoneName
        });
        
        document.getElementById(`zones_data_${index}`).value = JSON.stringify(zones[index]);
        redrawZones(index);
        updateZonesList(index);
        console.log('✅ Zone ajoutée:', zones[index][zones[index].length - 1]);
      }
    };
    
    // Mousemove: déplacer la zone si on est en mode drag
    canvas.onmousemove = function(e) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      
      if (isDragging && draggedZone[index] !== null) {
        // Déplacer la zone
        zones[index][draggedZone[index]].x = Math.round(x);
        zones[index][draggedZone[index]].y = Math.round(y);
        
        // Redessiner
        redrawZones(index);
      } else {
        // Changer le curseur si on survole une zone
        const zoneIndex = getZoneAtPosition(x, y);
        canvas.style.cursor = zoneIndex !== -1 ? 'grab' : 'crosshair';
      }
    };
    
    // Mouseup: arrêter le drag
    canvas.onmouseup = function() {
      if (isDragging) {
        isDragging = false;
        console.log('✅ Zone déplacée:', zones[index][draggedZone[index]]);
        
        // Sauvegarder
        document.getElementById(`zones_data_${index}`).value = JSON.stringify(zones[index]);
        updateZonesList(index);
        
        draggedZone[index] = null;
        canvas.style.cursor = 'crosshair';
      }
    };
    
    // Mouseleave: arrêter le drag si on sort du canvas
    canvas.onmouseleave = function() {
      if (isDragging) {
        isDragging = false;
        draggedZone[index] = null;
        canvas.style.cursor = 'crosshair';
      }
    };
  }
}

function redrawZones(index) {
  const canvas = document.getElementById(`canvas_${index}`);
  const ctx = canvas.getContext('2d');
  
  // Redessiner l'image
  const img = new Image();
  img.onload = function() {
    ctx.drawImage(img, 0, 0);
    
    // Dessiner toutes les zones
    zones[index].forEach((zone, i) => {
      const isBeingDragged = draggedZone[index] === i;
      
      ctx.beginPath();
      ctx.arc(zone.x, zone.y, zone.radius, 0, 2 * Math.PI);
      
      // Style différent si la zone est en cours de déplacement
      ctx.strokeStyle = isBeingDragged ? '#FF6B35' : '#008080';
      ctx.lineWidth = isBeingDragged ? 4 : 3;
      ctx.stroke();
      
      ctx.fillStyle = isBeingDragged ? 'rgba(255, 107, 53, 0.3)' : 'rgba(0, 128, 128, 0.2)';
      ctx.fill();
      
      // Numéro de la zone
      ctx.fillStyle = isBeingDragged ? '#FF6B35' : '#008080';
      ctx.font = 'bold 16px Arial';
      ctx.fillText((i + 1).toString(), zone.x - 8, zone.y + 5);
    });
  };
  img.src = questionImages[index];
}

function updateZonesList(index) {
  const zonesList = document.getElementById(`zones_list_${index}`);
  if (!zones[index] || zones[index].length === 0) {
    zonesList.innerHTML = '<p style="color: var(--gray-medium);">Aucune zone définie</p>';
    return;
  }
  
  zonesList.innerHTML = zones[index].map((zone, i) => `
    <div style="display: flex; align-items: center; gap: 1rem; padding: 0.5rem; background: var(--gray-light); border-radius: 4px; margin-bottom: 0.5rem;">
      <span style="font-weight: 600;">Zone ${i + 1}:</span>
      <span>${zone.label}</span>
      <span style="color: var(--gray-medium); font-size: 0.9rem;">(x:${zone.x}, y:${zone.y}, rayon:${zone.radius}px)</span>
      <button type="button" class="btn-icon btn-danger" onclick="removeZone(${index}, ${i})" style="margin-left: auto;">
        <i class="fas fa-trash"></i>
      </button>
    </div>
  `).join('');
}

function removeZone(questionIndex, zoneIndex) {
  zones[questionIndex].splice(zoneIndex, 1);
  document.getElementById(`zones_data_${questionIndex}`).value = JSON.stringify(zones[questionIndex]);
  redrawZones(questionIndex);
  updateZonesList(questionIndex);
  console.log('✅ Zone supprimée');
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
    is_dossier_progressif: form.is_dossier_progressif ? form.is_dossier_progressif.checked : false,
    contexte_initial: form.contexte_initial ? form.contexte_initial.value : null,
    questions: []
  };

  // Collecter les questions
  const questionItems = document.querySelectorAll('.question-item');
  questionItems.forEach((item, index) => {
    const questionType = form[`question_type_${index}`].value;
    
    const question = {
      question_type: questionType,
      enonce: form[`enonce_${index}`].value,
      explication: form[`explication_${index}`].value,
      infos_etape: form[`infos_etape_${index}`] ? form[`infos_etape_${index}`].value : null,
      option_a: null,
      option_b: null,
      option_c: null,
      option_d: null,
      option_e: null,
      reponse_correcte: null,
      reponses_correctes: null,
      reponse_attendue: null,
      image_url: null,
      zones_cliquables: null,
      ordre: index + 1
    };
    
    if (questionType === 'single' || questionType === 'multiple') {
      // QCU/QCM - Options + réponse(s) correcte(s)
      question.option_a = form[`option_a_${index}`].value;
      question.option_b = form[`option_b_${index}`].value;
      question.option_c = form[`option_c_${index}`].value;
      question.option_d = form[`option_d_${index}`].value;
      question.option_e = form[`option_e_${index}`]?.value || null;
      
      const reponseInput = form[`reponse_correcte_${index}`].value.trim().toUpperCase();
      
      if (!reponseInput) {
        showAlert(`Question ${index + 1}: Vous devez entrer une réponse correcte`, 'error');
        throw new Error('Missing answer');
      }
      
      if (questionType === 'multiple') {
        const reponseCorrecte = reponseInput.split(',').map(r => r.trim()).filter(r => r);
        
        if (reponseCorrecte.length === 0) {
          showAlert(`Question ${index + 1}: Format invalide. Utilisez A,C,D pour plusieurs réponses`, 'error');
          throw new Error('Invalid format');
        }
        
        const validAnswers = ['A', 'B', 'C', 'D', 'E'];
        for (const r of reponseCorrecte) {
          if (!validAnswers.includes(r)) {
            showAlert(`Question ${index + 1}: Réponse invalide "${r}". Utilisez seulement A, B, C, D ou E`, 'error');
            throw new Error('Invalid answer');
          }
        }
        
        question.reponses_correctes = JSON.stringify(reponseCorrecte);
      } else {
        if (reponseInput.length !== 1 || !'ABCDE'.includes(reponseInput)) {
          showAlert(`Question ${index + 1}: Entrez une seule lettre (A, B, C, D ou E)`, 'error');
          throw new Error('Invalid answer');
        }
        question.reponse_correcte = reponseInput;
      }
    } else if (questionType === 'qrp') {
      // QRP Unifié - Questions à réponses précises
      const nombreReponses = parseInt(form[`nombre_reponses_attendues_${index}`]?.value || 3);
      
      if (!nombreReponses || nombreReponses < 1) {
        showAlert(`Question ${index + 1}: Nombre de réponses attendues invalide`, 'error');
        throw new Error('Invalid expected answers count');
      }
      
      const options = [];
      const optionLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y'];
      
      // Compter dynamiquement les options disponibles
      for (let i = 0; i < 25; i++) {
        const optionText = form[`qrp_option_text_${i}_${index}`]?.value?.trim();
        const optionType = form[`qrp_option_type_${i}_${index}`]?.value;
        
        if (optionText && optionType) {
          options.push({
            text: optionText,
            correction: optionType
          });
        } else if (optionText || optionType) {
          showAlert(`Question ${index + 1}, Option ${optionLabels[i]}: Veuillez remplir le texte ET le type de correction`, 'error');
          throw new Error('Incomplete option');
        }
      }
      
      // Validation: minimum 4 options
      if (options.length < 4) {
        showAlert(`Question ${index + 1}: Il faut au moins 4 options pour une question QRP`, 'error');
        throw new Error('Not enough options');
      }
      
      // Validation: nombre de réponses attendues ≤ nombre d'options
      if (nombreReponses > options.length) {
        showAlert(`Question ${index + 1}: Le nombre de réponses attendues (${nombreReponses}) ne peut pas dépasser le nombre d'options (${options.length})`, 'error');
        throw new Error('Too many expected answers');
      }
      
      // Validation: au moins une réponse indispensable ou inacceptable
      const hasIndispensable = options.some(opt => opt.correction === 'indispensable');
      const hasInacceptable = options.some(opt => opt.correction === 'inacceptable');
      
      if (!hasIndispensable && !hasInacceptable) {
        showAlert(`Question ${index + 1}: Une question QRP doit avoir au moins une réponse "indispensable" ou "inacceptable"`, 'error');
        throw new Error('Missing required correction types');
      }
      
      // Compter les bonnes réponses pour vérification
      const bonnesReponses = options.filter(opt => opt.correction === 'vrai' || opt.correction === 'indispensable').length;
      
      // Si le nombre de bonnes réponses ne correspond pas exactement au nombre attendu, avertir
      if (bonnesReponses !== nombreReponses) {
        console.warn(`Question ${index + 1}: Nombre de bonnes réponses (${bonnesReponses}) ≠ nombre attendu (${nombreReponses}). Cela peut affecter le score.`);
      }
      
      question.options_json = JSON.stringify(options);
      question.nombre_reponses_attendues = nombreReponses;
      question.types_correction = 'indispensable_inacceptable';
    } else if (questionType === 'qroc') {
      // QROC - Réponse attendue + variantes
      const reponseAttendue = form[`reponse_attendue_${index}`]?.value;
      
      if (!reponseAttendue) {
        showAlert(`Question ${index + 1}: Vous devez entrer une réponse attendue`, 'error');
        throw new Error('Missing answer');
      }
      
      question.reponse_attendue = reponseAttendue;
      
      // Ajouter les variantes si présentes
      const variantes = form[`variantes_${index}`]?.value;
      if (variantes) {
        const variantesArray = variantes.split('\n').map(v => v.trim()).filter(v => v);
        question.reponse_attendue = JSON.stringify({
          principale: reponseAttendue,
          variantes: variantesArray
        });
      }
    } else if (questionType === 'qzp') {
      // QZP - Drag & Drop sur image
      const imageUrl = form[`qzp_image_url_${index}`]?.value;
      const zonesData = form[`qzp_zones_data_${index}`]?.value;
      const itemsData = form[`qzp_items_data_${index}`]?.value;
      
      if (!imageUrl) {
        showAlert(`Question ${index + 1}: Vous devez uploader une image`, 'error');
        throw new Error('Missing image');
      }
      
      let zones = [];
      let items = [];
      
      try {
        zones = JSON.parse(zonesData || '[]');
        items = JSON.parse(itemsData || '[]');
      } catch(e) {
        showAlert(`Question ${index + 1}: Erreur dans les données QZP`, 'error');
        throw new Error('Invalid QZP data');
      }
      
      if (zones.length === 0) {
        showAlert(`Question ${index + 1}: Vous devez définir au moins une zone de dépôt`, 'error');
        throw new Error('Missing zones');
      }
      
      if (items.length < 3) {
        showAlert(`Question ${index + 1}: Vous devez créer au moins 3 éléments à glisser`, 'error');
        throw new Error('Missing items');
      }
      
      // Vérifier qu'il y a au moins un élément correct
      const correctItems = items.filter(item => item.isCorrect && item.targetZone);
      if (correctItems.length === 0) {
        showAlert(`Question ${index + 1}: Au moins un élément doit être associé à une zone`, 'error');
        throw new Error('No correct items');
      }
      
      // Vérifier que tous les textes sont remplis
      const emptyItems = items.filter(item => !item.text.trim());
      if (emptyItems.length > 0) {
        showAlert(`Question ${index + 1}: Tous les éléments doivent avoir un texte`, 'error');
        throw new Error('Empty items');
      }
      
      question.image_url = imageUrl;
      question.zones_cliquables = JSON.stringify({
        zones: zones,
        items: items,
        type: 'dragdrop'
      });
    }
    
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
  console.log('🔍 Recherche du bouton add-question-btn:', addQuestionBtn);
  
  if (addQuestionBtn) {
    console.log('✅ Bouton "Ajouter une question" détecté');
    addQuestionBtn.addEventListener('click', (e) => {
      console.log('🖱️ Clic sur le bouton "Ajouter une question"');
      console.log('📝 Nombre de questions actuel:', questions.length);
      console.log('🎯 Event object:', e);
      
      try {
        addQuestion();
        console.log('✅ addQuestion() exécutée avec succès');
      } catch (error) {
        console.error('❌ Erreur dans addQuestion():', error);
      }
    });
  } else {
    console.error('❌ Bouton "add-question-btn" non trouvé dans le DOM');
    console.log('🔍 Contenu du DOM:', document.body ? 'body présent' : 'body absent');
    console.log('🔍 Questions container:', document.getElementById('questions-container'));
  }
});

// === Fonctions QRP Dynamiques ===

function generateQRPOptions(questionIndex, count) {
  const container = document.getElementById(`qrp-options-container-${questionIndex}`);
  const optionLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y'];
  
  let optionsHtml = '';
  
  for (let i = 0; i < count; i++) {
    const required = i < 4 ? 'required' : ''; // Les 4 premières options sont obligatoires
    const canDelete = i >= 4; // On peut supprimer seulement à partir de E
    
    optionsHtml += `
      <div class="form-group qrp-option-item" id="qrp-option-item-${questionIndex}-${i}">
        <label class="form-label">Option ${optionLabels[i]} ${required ? '*' : '(optionnelle)'}</label>
        <div class="qrp-option-container" style="display: flex; gap: 10px; align-items: center;">
          <input type="text" class="form-input qrp-option-text" id="qrp_option_text_${i}_${questionIndex}" name="qrp_option_text_${i}_${questionIndex}" ${required}
            placeholder="Ex: Hypertension artérielle" style="flex: 1;">
          <select class="form-input qrp-option-type" id="qrp_option_type_${i}_${questionIndex}" name="qrp_option_type_${i}_${questionIndex}" style="width: 150px;" ${required}>
            <option value="">-- Type --</option>
            <option value="vrai">Vrai</option>
            <option value="faux">Faux</option>
            <option value="indispensable">Indispensable</option>
            <option value="inacceptable">Inacceptable</option>
          </select>
          ${canDelete ? `
            <button type="button" class="btn btn-sm btn-danger" onclick="removeQRPOption(${questionIndex}, ${i})" 
              title="Supprimer cette option" style="padding: 0.5rem;">
              <i class="fas fa-trash"></i>
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }
  
  container.innerHTML = optionsHtml;
  updateQRPCounter(questionIndex);
}

function addQRPOption(questionIndex) {
  const container = document.getElementById(`qrp-options-container-${questionIndex}`);
  const currentOptions = container.querySelectorAll('.qrp-option-item');
  const currentCount = currentOptions.length;
  
  if (currentCount >= 25) {
    showAlert('Maximum 25 options autorisées', 'warning');
    return;
  }
  
  const optionLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y'];
  const newIndex = currentCount;
  
  const newOptionHtml = `
    <div class="form-group qrp-option-item" id="qrp-option-item-${questionIndex}-${newIndex}">
      <label class="form-label">Option ${optionLabels[newIndex]} (optionnelle)</label>
      <div class="qrp-option-container" style="display: flex; gap: 10px; align-items: center;">
        <input type="text" class="form-input qrp-option-text" id="qrp_option_text_${newIndex}_${questionIndex}" name="qrp_option_text_${newIndex}_${questionIndex}"
          placeholder="Ex: Hypertension artérielle" style="flex: 1;">
        <select class="form-input qrp-option-type" id="qrp_option_type_${newIndex}_${questionIndex}" name="qrp_option_type_${newIndex}_${questionIndex}" style="width: 150px;">
          <option value="vrai">Vrai</option>
          <option value="faux">Faux</option>
          <option value="indispensable">Indispensable</option>
          <option value="inacceptable">Inacceptable</option>
        </select>
        <button type="button" class="btn btn-sm btn-danger" onclick="removeQRPOption(${questionIndex}, ${newIndex})" 
          title="Supprimer cette option" style="padding: 0.5rem;">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>
  `;
  
  container.insertAdjacentHTML('beforeend', newOptionHtml);
  updateQRPCounter(questionIndex);
  
  // Mettre à jour la limite max du nombre de réponses attendues
  const expectedAnswersInput = document.querySelector(`[name="nombre_reponses_attendues_${questionIndex}"]`);
  if (expectedAnswersInput) {
    expectedAnswersInput.setAttribute('max', currentCount + 1);
  }
}

function removeQRPOption(questionIndex, optionIndex) {
  const optionElement = document.getElementById(`qrp-option-item-${questionIndex}-${optionIndex}`);
  if (optionElement) {
    optionElement.remove();
    updateQRPCounter(questionIndex);
    
    // Réajuster les indices et noms des options suivantes
    reindexQRPOptions(questionIndex);
    
    // Mettre à jour la limite max du nombre de réponses attendues
    const container = document.getElementById(`qrp-options-container-${questionIndex}`);
    const remainingOptions = container.querySelectorAll('.qrp-option-item');
    const expectedAnswersInput = document.querySelector(`[name="nombre_reponses_attendues_${questionIndex}"]`);
    if (expectedAnswersInput) {
      expectedAnswersInput.setAttribute('max', remainingOptions.length);
      
      // Si la valeur actuelle dépasse le nouveau max, la réduire
      const currentValue = parseInt(expectedAnswersInput.value);
      if (currentValue > remainingOptions.length) {
        expectedAnswersInput.value = remainingOptions.length;
      }
    }
  }
}

// === Fonctions QZP Drag & Drop ===

// Variables globales pour QZP
let qzpCurrentQuestion = null;
let qzpIsDrawing = false;
let qzpStartX = 0;
let qzpStartY = 0;

function handleQZPImageUpload(questionIndex, event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    const imageUrl = e.target.result;
    
    // Stocker l'image dans la variable globale (pour compatibilité avec startDefiningQZPZone)
    if (typeof questionImages === 'undefined') {
      window.questionImages = {};
    }
    questionImages[questionIndex] = imageUrl;
    
    // Stocker l'image dans l'input hidden
    const imageUrlInput = document.getElementById(`qzp_image_url_${questionIndex}`);
    if (imageUrlInput) {
      imageUrlInput.value = imageUrl;
    }
    
    // Afficher l'image
    const preview = document.getElementById(`qzp_image_preview_${questionIndex}`);
    const img = document.getElementById(`qzp_preview_img_${questionIndex}`);
    
    if (img && preview) {
      img.src = imageUrl;
      img.onload = function() {
        preview.style.display = 'block';
        
        // Afficher la section zones
        const zonesSection = document.getElementById(`qzp_zones_section_${questionIndex}`);
        if (zonesSection) {
          zonesSection.style.display = 'block';
        }
        
        console.log('✅ Image QZP chargée et stockée pour question', questionIndex);
      };
    }
  };
  
  reader.readAsDataURL(file);
}

function setupQZPCanvas(questionIndex, imgWidth, imgHeight) {
  const canvas = document.getElementById(`qzp_canvas_${questionIndex}`);
  const container = document.getElementById(`qzp_canvas_container_${questionIndex}`);
  const img = document.getElementById(`qzp_preview_img_${questionIndex}`);
  
  // Calculer les dimensions pour garder le ratio
  const containerWidth = img.offsetWidth;
  const containerHeight = img.offsetHeight;
  
  canvas.width = containerWidth;
  canvas.height = containerHeight;
  canvas.style.width = containerWidth + 'px';
  canvas.style.height = containerHeight + 'px';
  
  // Stocker les facteurs d'échelle pour conversion coordonnées
  canvas.dataset.scaleX = imgWidth / containerWidth;
  canvas.dataset.scaleY = imgHeight / containerHeight;
  canvas.dataset.originalWidth = imgWidth;
  canvas.dataset.originalHeight = imgHeight;
  
  container.style.display = 'none'; // Caché par défaut
}

function startDefiningQZPZone(questionIndex) {
  const container = document.getElementById(`qzp_canvas_container_${questionIndex}`);
  const canvas = document.getElementById(`qzp_canvas_${questionIndex}`);
  
  if (!questionImages[questionIndex]) {
    alert('⚠️ Veuillez d\'abord uploader une image avant de définir des zones.');
    return;
  }
  
  container.style.display = 'block';
  qzpCurrentQuestion = questionIndex;
  
  // Charger l'image dans le canvas
  const ctx = canvas.getContext('2d');
  const img = new Image();
  img.onload = function() {
    // Ajuster la taille du canvas à l'image
    const maxWidth = 800; // Largeur max pour l'interface
    const maxHeight = 600; // Hauteur max
    
    let { width, height } = img;
    
    // Redimensionner si nécessaire en gardant les proportions
    if (width > maxWidth) {
      height = (height * maxWidth) / width;
      width = maxWidth;
    }
    if (height > maxHeight) {
      width = (width * maxHeight) / height;
      height = maxHeight;
    }
    
    canvas.width = width;
    canvas.height = height;
    
    // Dessiner l'image
    ctx.drawImage(img, 0, 0, width, height);
    
    // Redessiner les zones existantes
    redrawExistingQZPZones(questionIndex);
    
    console.log('✅ Image chargée dans le canvas QZP', { width, height });
  };
  img.src = questionImages[questionIndex];
  
  // Ajouter les event listeners pour le dessin de rectangles
  canvas.addEventListener('mousedown', startQZPDrawing);
  canvas.addEventListener('mousemove', drawQZPRectangle);
  canvas.addEventListener('mouseup', finishQZPDrawing);
}

function startQZPDrawing(e) {
  if (qzpCurrentQuestion === null) return;
  
  qzpIsDrawing = true;
  const rect = e.target.getBoundingClientRect();
  qzpStartX = e.clientX - rect.left;
  qzpStartY = e.clientY - rect.top;
}

function drawQZPRectangle(e) {
  if (!qzpIsDrawing || qzpCurrentQuestion === null) return;
  
  const canvas = e.target;
  const ctx = canvas.getContext('2d');
  const rect = canvas.getBoundingClientRect();
  
  const currentX = e.clientX - rect.left;
  const currentY = e.clientY - rect.top;
  
  // Effacer et redessiner
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Dessiner toutes les zones existantes
  redrawExistingQZPZones(qzpCurrentQuestion);
  
  // Dessiner le rectangle en cours
  ctx.strokeStyle = '#2196F3';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.strokeRect(qzpStartX, qzpStartY, currentX - qzpStartX, currentY - qzpStartY);
}

function finishQZPDrawing(e) {
  if (!qzpIsDrawing || qzpCurrentQuestion === null) return;
  
  qzpIsDrawing = false;
  
  const canvas = e.target;
  const rect = canvas.getBoundingClientRect();
  
  const endX = e.clientX - rect.left;
  const endY = e.clientY - rect.top;
  
  // Calculer les coordonnées de la zone
  const x = Math.min(qzpStartX, endX);
  const y = Math.min(qzpStartY, endY);
  const width = Math.abs(endX - qzpStartX);
  const height = Math.abs(endY - qzpStartY);
  
  // Vérifier que la zone a une taille minimum
  if (width < 20 || height < 20) {
    showAlert('La zone doit avoir une taille minimum de 20x20 pixels', 'warning');
    return;
  }
  
  // Demander le label de la zone
  const label = prompt('Nom de cette zone (ex: "Cœur", "Foie") :');
  if (!label) return;
  
  const zone = {
    id: `zone_${Date.now()}`,
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
    label: label
  };
  
  // Ajouter la zone
  addQZPZone(qzpCurrentQuestion, zone);
  
  // Redessiner les zones
  redrawExistingQZPZones(qzpCurrentQuestion);
  
  console.log('✅ Zone ajoutée:', zone);
  
  // Nettoyer les event listeners
  canvas.removeEventListener('mousedown', startQZPDrawing);
  canvas.removeEventListener('mousemove', drawQZPRectangle);
  canvas.removeEventListener('mouseup', finishQZPDrawing);
  
  // Cacher le canvas
  const container = document.getElementById(`qzp_canvas_container_${qzpCurrentQuestion}`);
  container.style.display = 'none';
  
  qzpCurrentQuestion = null;
}

function redrawExistingQZPZones(questionIndex) {
  const canvas = document.getElementById(`qzp_canvas_${questionIndex}`);
  const ctx = canvas.getContext('2d');
  
  // D'abord redessiner l'image de fond
  if (questionImages[questionIndex]) {
    const img = new Image();
    img.onload = function() {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      // Puis dessiner les zones par-dessus
      const zones = getQZPZones(questionIndex);
      zones.forEach(zone => {
        // Dessiner le rectangle de la zone
        ctx.strokeStyle = '#4CAF50';
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(zone.x, zone.y, zone.width, zone.height);
        
        // Dessiner le label avec un fond
        ctx.fillStyle = 'rgba(76, 175, 80, 0.8)';
        ctx.fillRect(zone.x, zone.y - 25, ctx.measureText(zone.label).width + 10, 25);
        
        ctx.fillStyle = 'white';
        ctx.font = '14px Arial';
        ctx.fillText(zone.label, zone.x + 5, zone.y - 8);
      });
    };
    img.src = questionImages[questionIndex];
  }
}

function addQZPZone(questionIndex, zone) {
  const zones = getQZPZones(questionIndex);
  zones.push(zone);
  
  // Sauvegarder dans le hidden input
  const zonesInput = document.getElementById(`qzp_zones_data_${questionIndex}`);
  zonesInput.value = JSON.stringify(zones);
  
  // Mettre à jour l'affichage
  updateQZPZonesDisplay(questionIndex);
  
  // Afficher la section des éléments drag si pas encore visible
  const itemsSection = document.getElementById(`qzp_items_section_${questionIndex}`);
  if (itemsSection.style.display === 'none') {
    itemsSection.style.display = 'block';
    // Ajouter 3 éléments par défaut
    addQZPDragItem(questionIndex);
    addQZPDragItem(questionIndex);
    addQZPDragItem(questionIndex);
  }
}

function getQZPZones(questionIndex) {
  const zonesInput = document.getElementById(`qzp_zones_data_${questionIndex}`);
  try {
    return JSON.parse(zonesInput.value || '[]');
  } catch(e) {
    return [];
  }
}

function getQZPZonesCount(questionIndex) {
  return getQZPZones(questionIndex).length;
}

function updateQZPZonesDisplay(questionIndex) {
  const zones = getQZPZones(questionIndex);
  const container = document.getElementById(`qzp_zones_list_${questionIndex}`);
  
  let html = '';
  zones.forEach((zone, index) => {
    html += `
      <div class="qzp-zone-item" style="display: flex; align-items: center; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 0.5rem; background: #f9f9f9;">
        <div style="flex: 1;">
          <strong>${zone.label}</strong>
          <small style="color: #666; margin-left: 1rem;">
            Position: (${zone.x}, ${zone.y}) • Taille: ${zone.width}×${zone.height}px
          </small>
        </div>
        <button type="button" class="btn btn-sm btn-danger" onclick="removeQZPZone(${questionIndex}, ${index})" style="padding: 0.25rem 0.5rem;">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

function removeQZPZone(questionIndex, zoneIndex) {
  const zones = getQZPZones(questionIndex);
  zones.splice(zoneIndex, 1);
  
  // Sauvegarder
  const zonesInput = document.getElementById(`qzp_zones_data_${questionIndex}`);
  zonesInput.value = JSON.stringify(zones);
  
  // Mettre à jour l'affichage
  updateQZPZonesDisplay(questionIndex);
  
  // Cacher la section des éléments si plus de zones
  if (zones.length === 0) {
    const itemsSection = document.getElementById(`qzp_items_section_${questionIndex}`);
    itemsSection.style.display = 'none';
    
    // Vider les éléments drag
    const itemsInput = document.getElementById(`qzp_items_data_${questionIndex}`);
    itemsInput.value = '[]';
    updateQZPItemsDisplay(questionIndex);
  }
}

function addQZPDragItem(questionIndex) {
  const items = getQZPDragItems(questionIndex);
  const itemId = `item_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  
  const newItem = {
    id: itemId,
    text: '',
    isCorrect: false,
    targetZone: null
  };
  
  items.push(newItem);
  
  // Sauvegarder
  const itemsInput = document.getElementById(`qzp_items_data_${questionIndex}`);
  itemsInput.value = JSON.stringify(items);
  
  // Mettre à jour l'affichage
  updateQZPItemsDisplay(questionIndex);
}

function getQZPDragItems(questionIndex) {
  const itemsInput = document.getElementById(`qzp_items_data_${questionIndex}`);
  try {
    return JSON.parse(itemsInput.value || '[]');
  } catch(e) {
    return [];
  }
}

function updateQZPItemsDisplay(questionIndex) {
  const items = getQZPDragItems(questionIndex);
  const zones = getQZPZones(questionIndex);
  const container = document.getElementById(`qzp_drag_items_${questionIndex}`);
  
  let html = '';
  items.forEach((item, index) => {
    html += `
      <div class="qzp-item" style="display: flex; align-items: center; gap: 10px; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 0.5rem;">
        <div style="flex: 1;">
          <input type="text" class="form-input" placeholder="Texte à glisser (ex: Cœur)" value="${item.text}"
            onchange="updateQZPItemText(${questionIndex}, ${index}, this.value)" style="margin-bottom: 0.5rem;">
        </div>
        <div style="width: 200px;">
          <select class="form-input" onchange="updateQZPItemTarget(${questionIndex}, ${index}, this.value)">
            <option value="">Distracteur (pas de zone)</option>
            ${zones.map(zone => 
              `<option value="${zone.id}" ${item.targetZone === zone.id ? 'selected' : ''}>${zone.label}</option>`
            ).join('')}
          </select>
        </div>
        <button type="button" class="btn btn-sm btn-danger" onclick="removeQZPDragItem(${questionIndex}, ${index})">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

function updateQZPItemText(questionIndex, itemIndex, text) {
  const items = getQZPDragItems(questionIndex);
  items[itemIndex].text = text;
  
  const itemsInput = document.getElementById(`qzp_items_data_${questionIndex}`);
  itemsInput.value = JSON.stringify(items);
}

function updateQZPItemTarget(questionIndex, itemIndex, targetZone) {
  const items = getQZPDragItems(questionIndex);
  items[itemIndex].targetZone = targetZone || null;
  items[itemIndex].isCorrect = !!targetZone;
  
  const itemsInput = document.getElementById(`qzp_items_data_${questionIndex}`);
  itemsInput.value = JSON.stringify(items);
}

function removeQZPDragItem(questionIndex, itemIndex) {
  const items = getQZPDragItems(questionIndex);
  items.splice(itemIndex, 1);
  
  const itemsInput = document.getElementById(`qzp_items_data_${questionIndex}`);
  itemsInput.value = JSON.stringify(items);
  
  updateQZPItemsDisplay(questionIndex);
}

function reindexQRPOptions(questionIndex) {
  const container = document.getElementById(`qrp-options-container-${questionIndex}`);
  const options = container.querySelectorAll('.qrp-option-item');
  const optionLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y'];
  
  options.forEach((option, newIndex) => {
    // Mettre à jour l'ID
    option.id = `qrp-option-item-${questionIndex}-${newIndex}`;
    
    // Mettre à jour le label
    const label = option.querySelector('.form-label');
    const required = newIndex < 4 ? '*' : '(optionnelle)';
    label.textContent = `Option ${optionLabels[newIndex]} ${required}`;
    
    // Mettre à jour les noms des inputs
    const textInput = option.querySelector('.qrp-option-text');
    const typeSelect = option.querySelector('.qrp-option-type');
    const deleteButton = option.querySelector('.btn-danger');
    
    textInput.name = `qrp_option_text_${newIndex}_${questionIndex}`;
    typeSelect.name = `qrp_option_type_${newIndex}_${questionIndex}`;
    
    // Mettre à jour l'attribut required pour les 4 premières options
    if (newIndex < 4) {
      textInput.setAttribute('required', '');
      typeSelect.setAttribute('required', '');
    } else {
      textInput.removeAttribute('required');
      typeSelect.removeAttribute('required');
    }
    
    // Mettre à jour le onclick du bouton supprimer
    if (deleteButton && newIndex >= 4) {
      deleteButton.setAttribute('onclick', `removeQRPOption(${questionIndex}, ${newIndex})`);
    }
    
    // Supprimer le bouton de suppression pour les 4 premières options
    if (deleteButton && newIndex < 4) {
      deleteButton.remove();
    }
  });
}

function updateQRPCounter(questionIndex) {
  const container = document.getElementById(`qrp-options-container-${questionIndex}`);
  const options = container.querySelectorAll('.qrp-option-item');
  const counter = document.getElementById(`qrp-count-${questionIndex}`);
  
  if (counter) {
    counter.textContent = options.length;
  }
}

function validateExpectedAnswers(questionIndex) {
  const container = document.getElementById(`qrp-options-container-${questionIndex}`);
  const optionsCount = container.querySelectorAll('.qrp-option-item').length;
  const expectedAnswersInput = document.querySelector(`[name="nombre_reponses_attendues_${questionIndex}"]`);
  
  if (expectedAnswersInput) {
    const currentValue = parseInt(expectedAnswersInput.value);
    if (currentValue > optionsCount) {
      expectedAnswersInput.value = optionsCount;
      showAlert(`Le nombre de réponses attendues ne peut pas dépasser le nombre d'options (${optionsCount})`, 'warning');
    }
  }
}
