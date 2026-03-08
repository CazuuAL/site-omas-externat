// ===== OMAS EXTERNAT - Application JavaScript =====

// Variables globales
let currentUser = null;
let currentQCM = null;
let currentQuestions = [];
let userAnswers = {};

// ===== FONCTIONS D'AUTHENTIFICATION =====

function showAlert(message, type = 'info') {
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type}`;
  alertDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 20px;
    background: ${type === 'success' ? '#d4edda' : type === 'error' ? '#f8d7da' : '#d1ecf1'};
    color: ${type === 'success' ? '#155724' : type === 'error' ? '#721c24' : '#0c5460'};
    border: 1px solid ${type === 'success' ? '#c3e6cb' : type === 'error' ? '#f5c6cb' : '#bee5eb'};
    border-radius: 5px;
    z-index: 10000;
    max-width: 300px;
    font-size: 14px;
  `;
  alertDiv.textContent = message;
  
  document.body.appendChild(alertDiv);
  
  setTimeout(() => {
    alertDiv.remove();
  }, 5000);
}

function checkAuth() {
  const token = localStorage.getItem('omas_token');
  const user = localStorage.getItem('omas_user');
  
  if (token && user) {
    currentUser = JSON.parse(user);
    return currentUser;
  }
  return null;
}

function logout() {
  localStorage.removeItem('omas_token');
  localStorage.removeItem('omas_user');
  currentUser = null;
  window.location.href = '/';
}

// ===== FONCTIONS QCM =====

async function loadQCM(qcmId) {
  try {
    const token = localStorage.getItem('omas_token');
    if (!token) {
      showAlert('Vous devez être connecté', 'error');
      return;
    }

    const response = await fetch(`/api/qcm/${qcmId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    console.log('QCM chargé:', data);

    if (data.error) {
      showAlert(data.error, 'error');
      return;
    }

    currentQCM = data.qcm;
    currentQuestions = data.questions || [];
    
    displayQCM(currentQCM, currentQuestions);
  } catch (error) {
    console.error('Erreur lors du chargement du QCM:', error);
    showAlert('Erreur lors du chargement du QCM', 'error');
  }
}

function displayQCM(qcm, questions) {
  const container = document.getElementById('qcm-container');
  if (!container) {
    console.error('Container QCM non trouvé');
    return;
  }

  console.log('Affichage QCM:', qcm);
  console.log('Questions:', questions);

  if (!qcm) {
    container.innerHTML = '<div class="alert alert-danger">QCM non trouvé</div>';
    return;
  }

  // Vérifier si c'est un dossier progressif
  if (qcm.is_dossier_progressif) {
    displayDossierProgressif(qcm, questions);
    return;
  }

  // Affichage QCM normal simple et clair
  let html = `
    <div class="qcm-header">
      <h1><i class="fas fa-clipboard-question"></i> ${qcm.titre || 'QCM'}</h1>
      <div class="qcm-info">
        <p><strong>Spécialité :</strong> ${qcm.specialite || 'Général'}</p>
        <p><strong>Semaine :</strong> ${qcm.semaine || '?'}</p>
        <p><strong>Questions :</strong> ${questions.length}</p>
      </div>
    </div>
  `;

  if (questions.length === 0) {
    html += '<div class="alert alert-info">Aucune question disponible pour ce QCM.</div>';
    container.innerHTML = html;
    return;
  }

  html += '<form id="qcm-form" onsubmit="submitQCM(event)">';
  
  questions.forEach((question, index) => {
    html += renderQuestion(question, index);
  });
  
  html += `
    <div class="qcm-submit-section">
      <button type="submit" class="btn-submit-qcm">
        <i class="fas fa-check"></i> Valider mes réponses
      </button>
    </div>
  </form>
  `;
  
  container.innerHTML = html;

  // Initialiser les systèmes interactifs pour chaque question
  questions.forEach((question) => {
    if (question.type === 'qzp' && question.image_url && question.zones_cliquables) {
      try {
        const zones = JSON.parse(question.zones_cliquables);
        initQZPClickSystem(question.id, zones);
      } catch (error) {
        console.error('Erreur parsing zones QZP:', error);
      }
    }
  });
}

function renderQuestion(question, index) {
  let html = `
    <div class="question-card">
      <div class="question-header">
        <div class="question-number">${index + 1}</div>
  `;

  // Badge selon le type
  switch (question.question_type) {
    case 'single':
      html += '<span class="question-type-badge badge-qcu">QCU</span>';
      break;
    case 'multiple':
      html += '<span class="question-type-badge badge-qcm">QCM</span>';
      break;
    case 'qrp':
      html += `<span class="question-type-badge badge-qrp">QRP - ${question.nombre_reponses_attendues || 3} réponses</span>`;
      break;
    case 'qrp_long':
      html += `<span class="question-type-badge badge-qrp">QRP Long - ${question.nombre_reponses_attendues || 4} réponses</span>`;
      break;
    case 'qroc':
      html += '<span class="question-type-badge badge-qroc">QROC</span>';
      break;
    case 'qzp':
      html += '<span class="question-type-badge badge-qzp">QZP</span>';
      break;
  }

  html += `
      </div>
      <div class="question-text">${question.enonce}</div>
  `;

  // Rendu selon le type de question
  if (question.question_type === 'single' || question.question_type === 'multiple') {
    html += renderQCUQCMOptions(question);
  } else if (question.question_type === 'qrp' || question.question_type === 'qrp_long') {
    html += renderQRPOptions(question);
  } else if (question.question_type === 'qroc') {
    html += renderQROCInput(question);
  } else if (question.question_type === 'qzp') {
    html += renderQZPInterface(question);
  }

  html += '</div>';
  return html;
}


function renderQCUQCMOptions(question) {
  let html = '<div class="options-container space-y-3">';
  
  const options = ['A', 'B', 'C', 'D', 'E'];
  const inputType = question.type === 'single' ? 'radio' : 'checkbox';
  
  options.forEach((letter, index) => {
    const optionKey = `option_${letter.toLowerCase()}`;
    const optionText = question[optionKey];
    
    if (optionText) {
      const inputId = `q${question.id}-${letter}`;
      html += `
        <label for="${inputId}" class="option-label flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
          <input type="${inputType}" 
                 id="${inputId}" 
                 name="question-${question.id}" 
                 value="${letter}" 
                 class="mr-3 text-blue-600 focus:ring-blue-500">
          <span class="option-letter bg-gray-100 text-gray-700 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold mr-3">
            ${letter}
          </span>
          <span class="option-text flex-1">${optionText}</span>
        </label>
      `;
    }
  });
  
  html += '</div>';
  return html;
}

function renderQRPOptions(question) {
  console.log('🔍 Rendu QRP pour question:', question.id, 'options_json:', question.options_json);
  
  let options = [];
  const nombreAttendu = question.nombre_reponses_attendues || 3;
  
  // Parser les options depuis options_json
  if (question.options_json) {
    try {
      options = JSON.parse(question.options_json);
      console.log('✅ Options QRP parsées:', options);
    } catch (error) {
      console.error('❌ Erreur parsing QRP options_json:', error, 'Données brutes:', question.options_json);
      
      // Fallback vers les options classiques
      const letters = ['a', 'b', 'c', 'd', 'e'];
      letters.forEach(letter => {
        const optionText = question[`option_${letter}`];
        if (optionText) {
          options.push({
            lettre: letter.toUpperCase(),
            texte: optionText,
            correction: 'vrai' // Par défaut
          });
        }
      });
      console.log('🔄 Options fallback générées:', options);
    }
  }

  if (options.length === 0) {
    return '<div class="alert alert-warning">Options QRP non disponibles</div>';
  }

  let html = `
    <div class="qrp-container">
      <div class="qrp-info bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
        <div class="flex items-center gap-2 text-orange-800">
          <i class="fas fa-info-circle"></i>
          <span class="font-medium">QRP - Question à Réponse Précise</span>
        </div>
        <p class="text-sm text-orange-700 mt-1">
          Sélectionnez exactement <strong>${nombreAttendu} réponses</strong> parmi les options proposées.
        </p>
        <div class="mt-2 text-sm">
          <span class="text-orange-600">Réponses sélectionnées : </span>
          <span id="qrp-counter-${question.id}" class="font-bold text-orange-800">0</span>
          <span class="text-orange-600"> / ${nombreAttendu}</span>
        </div>
      </div>
      
      <div class="qrp-options-container" data-max-selections="${nombreAttendu}" data-question-id="${question.id}">
  `;

  options.forEach((option, index) => {
    const inputId = `q${question.id}-qrp-${index}`;
    html += `
      <label for="${inputId}" class="qrp-option flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors mb-2">
        <input type="checkbox" 
               id="${inputId}" 
               name="question-${question.id}" 
               value="${index}" 
               onchange="updateQRPSelection(${question.id})"
               class="mr-3 text-orange-600 focus:ring-orange-500">
        <span class="option-letter bg-gray-100 text-gray-700 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold mr-3">
          ${option.lettre || String.fromCharCode(65 + index)}
        </span>
        <span class="option-text flex-1">${option.texte}</span>
      </label>
    `;
  });

  html += `
      </div>
      <div id="qrp-warning-${question.id}" class="qrp-warning bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg mt-3 hidden">
        <i class="fas fa-exclamation-triangle mr-2"></i>
        Vous devez sélectionner exactement ${nombreAttendu} réponses.
      </div>
    </div>
  `;

  return html;
}

function renderQROCInput(question) {
  return `
    <div class="qroc-container">
      <div class="qrp-info">
        <i class="fas fa-edit"></i>
        <strong>QROC - Question à Réponse Ouverte Courte</strong><br>
        Saisissez votre réponse dans le champ ci-dessous.
      </div>
      
      <input type="text" 
             name="question_${question.id}" 
             id="q${question.id}-qroc" 
             placeholder="Votre réponse..." 
             style="width: 100%; padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 1rem; margin-top: 1rem;">
    </div>
  `;
}

function renderQZPInterface(question) {
  if (!question.image_url || !question.zones_cliquables) {
    return '<div class="alert alert-warning">Image ou zones non disponibles pour cette question QZP</div>';
  }

  let zones = [];
  try {
    zones = JSON.parse(question.zones_cliquables);
  } catch (error) {
    console.error('Erreur parsing zones QZP:', error);
    return '<div class="alert alert-danger">Erreur dans les données des zones</div>';
  }

  let html = `
    <div class="qzp-container">
      <div class="qzp-info bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
        <div class="flex items-center gap-2 text-yellow-800">
          <i class="fas fa-mouse-pointer"></i>
          <span class="font-medium">QZP - Question à Zone de Pointage</span>
        </div>
        <p class="text-sm text-yellow-700 mt-1">
          Cliquez sur les éléments ci-dessous puis placez-les sur l'image.
        </p>
      </div>
      
      <div class="qzp-main grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="qzp-image-container lg:col-span-2">
          <div class="relative border border-gray-300 rounded-lg overflow-hidden bg-gray-50">
            <img id="qzp-image-${question.id}" 
                 src="${question.image_url}" 
                 alt="Image QZP" 
                 class="w-full h-auto"
                 onload="initQZPClickSystem(${question.id}, ${JSON.stringify(zones).replace(/"/g, '&quot;')})">
            <div id="qzp-overlay-${question.id}" class="absolute inset-0 pointer-events-none"></div>
          </div>
        </div>
        
        <div class="qzp-elements-panel bg-gray-50 rounded-lg p-4">
          <h4 class="font-semibold text-gray-800 mb-3">
            <i class="fas fa-layer-group mr-2"></i>Éléments à placer
          </h4>
          <div class="qzp-elements space-y-2">
  `;

  zones.forEach((zone, index) => {
    html += `
      <div class="qzp-source-element bg-white border border-gray-300 rounded-lg p-3 cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-colors"
           id="source-element-${question.id}-${index}"
           data-zone-index="${index}"
           data-zone-label="${zone.label}"
           onclick="spawnElement(${question.id}, ${index})">
        <div class="text-center">
          <div class="w-8 h-8 bg-blue-100 text-blue-800 rounded-full flex items-center justify-content center mx-auto mb-1 text-sm font-bold">
            ${String.fromCharCode(65 + index)}
          </div>
          <div class="text-sm text-gray-700">${zone.label}</div>
        </div>
      </div>
    `;
  });

  html += `
          </div>
          
          <div class="qzp-stats mt-4 p-3 bg-white rounded-lg border">
            <div class="text-sm text-gray-600">
              Éléments placés : <span id="qzp-placed-count-${question.id}">0</span> / ${zones.length}
            </div>
          </div>
        </div>
      </div>
      
      <div id="qzp-feedback-${question.id}" class="qzp-feedback mt-4 hidden"></div>
      <input type="hidden" name="question-${question.id}" id="q${question.id}-qzp-answer" value="">
    </div>
  `;

  return html;
}

// ===== FONCTIONS QRP =====

function updateQRPSelection(questionId) {
  const container = document.querySelector(`[data-question-id="${questionId}"]`);
  const maxSelections = parseInt(container.dataset.maxSelections);
  const checkboxes = container.querySelectorAll('input[type="checkbox"]');
  const counter = document.getElementById(`qrp-counter-${questionId}`);
  const warning = document.getElementById(`qrp-warning-${questionId}`);
  
  const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
  
  // Mettre à jour le compteur
  if (counter) {
    counter.textContent = checkedCount;
  }
  
  // Gérer la limite de sélection
  if (checkedCount >= maxSelections) {
    checkboxes.forEach(cb => {
      if (!cb.checked) {
        cb.disabled = true;
      }
    });
  } else {
    checkboxes.forEach(cb => {
      cb.disabled = false;
    });
  }
  
  // Gérer l'avertissement
  if (warning) {
    if (checkedCount > 0 && checkedCount !== maxSelections) {
      warning.classList.remove('hidden');
    } else {
      warning.classList.add('hidden');
    }
  }
}

// ===== FONCTIONS QZP =====

// Variables globales QZP
let qzpAnswers = {};

function initQZPClickSystem(questionId, zones) {
  console.log('🎯 Init QZP Click System pour question', questionId, 'avec', zones.length, 'zones');
  
  // Stocker les zones globalement
  window[`qzpZones_${questionId}`] = zones;
  
  // Initialiser le stockage des réponses
  if (!qzpAnswers[questionId]) {
    qzpAnswers[questionId] = {};
  }
  
  updateQZPCounter(questionId);
}

function spawnElement(questionId, zoneIndex) {
  const sourceElement = document.getElementById(`source-element-${questionId}-${zoneIndex}`);
  const overlay = document.getElementById(`qzp-overlay-${questionId}`);
  const zones = window[`qzpZones_${questionId}`];
  
  if (!sourceElement || !overlay || !zones || !zones[zoneIndex]) {
    console.error('Éléments QZP manquants', { sourceElement, overlay, zones, zoneIndex });
    return;
  }
  
  const zone = zones[zoneIndex];
  const zoneLabel = zone.label;
  
  console.log('🖱️ Spawn élément:', zoneLabel);
  
  // Vérifier si un élément existe déjà
  const existingElement = document.getElementById(`placed-element-${questionId}-${zoneIndex}`);
  if (existingElement) {
    showAlert(`"${zoneLabel}" est déjà placé sur l'image`, 'info');
    return;
  }
  
  // Créer l'élément sur l'image
  const placedElement = document.createElement('div');
  placedElement.id = `placed-element-${questionId}-${zoneIndex}`;
  placedElement.className = 'qzp-placed-element';
  placedElement.dataset.zoneIndex = zoneIndex;
  placedElement.dataset.zoneLabel = zoneLabel;
  
  placedElement.style.cssText = `
    position: absolute;
    left: 20px;
    top: 20px;
    width: 60px;
    height: 60px;
    background: rgba(255, 99, 71, 0.9);
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: move;
    user-select: none;
    box-shadow: 0 4px 12px rgba(255, 99, 71, 0.4);
    border: 2px solid rgba(255, 255, 255, 0.3);
    z-index: 100;
  `;
  
  placedElement.textContent = zoneLabel;
  
  // Ajouter un bouton de suppression
  const removeBtn = document.createElement('div');
  removeBtn.innerHTML = '<i class="fas fa-times"></i>';
  removeBtn.style.cssText = `
    position: absolute;
    top: -8px;
    right: -8px;
    width: 20px;
    height: 20px;
    background: #dc3545;
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    cursor: pointer;
  `;
  
  removeBtn.onclick = (e) => {
    e.stopPropagation();
    removeElementFromImage(questionId, zoneIndex);
  };
  
  placedElement.appendChild(removeBtn);
  overlay.appendChild(placedElement);
  
  // Rendre l'élément draggable
  makeElementDraggable(placedElement, questionId);
  
  // Feedback visuel sur la vignette source
  sourceElement.style.opacity = '0.5';
  sourceElement.style.transform = 'scale(0.9)';
  
  updateQZPCounter(questionId);
  showAlert(`✅ "${zoneLabel}" ajouté ! Déplacez-le vers la bonne zone.`, 'success');
}

function makeElementDraggable(element, questionId) {
  let isDragging = false;
  let startX, startY, initialLeft, initialTop;
  
  element.addEventListener('mousedown', (e) => {
    if (e.target.tagName === 'I') return; // Ne pas dragger si on clique sur le bouton supprimer
    
    e.preventDefault();
    isDragging = true;
    
    startX = e.clientX;
    startY = e.clientY;
    initialLeft = parseInt(element.style.left) || 0;
    initialTop = parseInt(element.style.top) || 0;
    
    element.style.cursor = 'grabbing';
    element.style.zIndex = '1000';
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });
  
  function onMouseMove(e) {
    if (!isDragging) return;
    
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    
    element.style.left = (initialLeft + dx) + 'px';
    element.style.top = (initialTop + dy) + 'px';
  }
  
  function onMouseUp() {
    if (!isDragging) return;
    
    isDragging = false;
    element.style.cursor = 'move';
    element.style.zIndex = '100';
    
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    
    // Enregistrer la nouvelle position
    updateQZPAnswer(questionId);
  }
}

function removeElementFromImage(questionId, zoneIndex) {
  const placedElement = document.getElementById(`placed-element-${questionId}-${zoneIndex}`);
  const sourceElement = document.getElementById(`source-element-${questionId}-${zoneIndex}`);
  
  if (placedElement) {
    placedElement.remove();
  }
  
  if (sourceElement) {
    sourceElement.style.opacity = '1';
    sourceElement.style.transform = 'scale(1)';
  }
  
  // Supprimer de la réponse
  if (qzpAnswers[questionId] && qzpAnswers[questionId][zoneIndex]) {
    delete qzpAnswers[questionId][zoneIndex];
  }
  
  updateQZPCounter(questionId);
  updateQZPAnswer(questionId);
}

function updateQZPCounter(questionId) {
  const counter = document.getElementById(`qzp-placed-count-${questionId}`);
  if (counter) {
    const placedCount = Object.keys(qzpAnswers[questionId] || {}).length;
    counter.textContent = placedCount;
  }
}

function updateQZPAnswer(questionId) {
  const hiddenInput = document.getElementById(`q${questionId}-qzp-answer`);
  if (!hiddenInput) return;
  
  const placedElements = document.querySelectorAll(`[id^="placed-element-${questionId}-"]`);
  const img = document.getElementById(`qzp-image-${questionId}`);
  
  if (!img) return;
  
  const positions = {};
  const imgRect = img.getBoundingClientRect();
  
  placedElements.forEach(element => {
    const zoneIndex = element.dataset.zoneIndex;
    const elementRect = element.getBoundingClientRect();
    
    // Calculer la position relative en pourcentage
    const relativeX = ((elementRect.left - imgRect.left + elementRect.width / 2) / imgRect.width) * 100;
    const relativeY = ((elementRect.top - imgRect.top + elementRect.height / 2) / imgRect.height) * 100;
    
    positions[zoneIndex] = {
      x: Math.round(relativeX * 10) / 10,
      y: Math.round(relativeY * 10) / 10,
      label: element.dataset.zoneLabel
    };
  });
  
  qzpAnswers[questionId] = positions;
  hiddenInput.value = JSON.stringify(positions);
  
  console.log('QZP positions mise à jour:', positions);
}

// ===== SOUMISSION ET ÉVALUATION =====

async function submitQCM(e) {
  e.preventDefault();
  
  if (!currentQCM || !currentQuestions.length) {
    showAlert('Aucun QCM chargé', 'error');
    return;
  }
  
  const formData = new FormData(e.target);
  const answers = {};
  
  // Traitement des réponses par type de question
  currentQuestions.forEach(question => {
    const questionKey = `question-${question.id}`;
    
    if (question.type === 'single') {
      // QCU - une seule réponse
      answers[question.id] = formData.get(questionKey);
    } else if (question.type === 'multiple') {
      // QCM - réponses multiples
      answers[question.id] = formData.getAll(questionKey);
    } else if (question.type === 'qrp') {
      // QRP - réponses multiples avec validation
      const selectedOptions = formData.getAll(questionKey);
      answers[question.id] = selectedOptions;
      
      console.log(`QRP Question ${question.id}:`, {
        selected: selectedOptions,
        expected: question.nombre_reponses_attendues
      });
    } else if (question.type === 'qroc') {
      // QROC - réponse textuelle
      answers[question.id] = formData.get(questionKey);
    } else if (question.type === 'qzp') {
      // QZP - positions des éléments
      const qzpAnswer = formData.get(questionKey);
      try {
        answers[question.id] = qzpAnswer ? JSON.parse(qzpAnswer) : {};
      } catch (error) {
        console.error('Erreur parsing réponse QZP:', error);
        answers[question.id] = {};
      }
    }
  });
  
  console.log('Réponses collectées:', answers);
  
  // Évaluer les réponses
  let totalScore = 0;
  let maxScore = currentQuestions.length;
  const results = [];
  
  currentQuestions.forEach(question => {
    const userAnswer = answers[question.id];
    let result;
    
    switch (question.type) {
      case 'single':
      case 'multiple':
        result = evaluateQCUQCM(question, userAnswer);
        break;
      case 'qrp':
        result = evaluateQRP(question, userAnswer);
        break;
      case 'qroc':
        result = evaluateQROC(question, userAnswer);
        break;
      case 'qzp':
        result = evaluateQZP(question, userAnswer);
        break;
      default:
        result = { score: 0, isCorrect: false, details: 'Type de question non supporté' };
    }
    
    totalScore += result.score;
    results.push({
      questionId: question.id,
      userAnswer: userAnswer,
      ...result
    });
    
    console.log(`Question ${question.id} (${question.type}):`, result);
  });
  
  const percentage = Math.round((totalScore / maxScore) * 100);
  
  console.log('Score final:', {
    total: totalScore,
    max: maxScore,
    percentage: percentage
  });
  
  displayResults(totalScore, maxScore, percentage, results);
}

function evaluateQCUQCM(question, userAnswer) {
  const correctAnswers = question.correction_attendue ? question.correction_attendue.split(',') : [];
  
  if (question.type === 'single') {
    const isCorrect = correctAnswers.includes(userAnswer);
    return {
      score: isCorrect ? 1 : 0,
      isCorrect: isCorrect,
      details: isCorrect ? 'Bonne réponse' : `Réponse incorrecte (attendue: ${correctAnswers.join(', ')})`
    };
  } else {
    // QCM multiple
    const userAnswersArray = Array.isArray(userAnswer) ? userAnswer : [];
    const correctCount = userAnswersArray.filter(ans => correctAnswers.includes(ans)).length;
    const incorrectCount = userAnswersArray.filter(ans => !correctAnswers.includes(ans)).length;
    
    const score = Math.max(0, (correctCount - incorrectCount) / correctAnswers.length);
    
    return {
      score: score,
      isCorrect: score === 1,
      details: `${correctCount} bonnes réponses, ${incorrectCount} erreurs`
    };
  }
}

function evaluateQRP(question, userAnswer) {
  console.log('🔍 Évaluation QRP question:', question.id);
  console.log('Réponse utilisateur:', userAnswer);
  console.log('Options JSON:', question.options_json);
  
  const nombreAttendu = question.nombre_reponses_attendues || 3;
  
  // Parser les options
  let options = [];
  try {
    options = JSON.parse(question.options_json || '[]');
  } catch (error) {
    console.error('Erreur parsing options QRP:', error);
    return { 
      score: 0, 
      isCorrect: false, 
      details: 'Erreur dans les données de la question' 
    };
  }
  
  if (!Array.isArray(userAnswer)) {
    userAnswer = [];
  }
  
  // Convertir les indices en nombres
  const userIndices = userAnswer.map(idx => parseInt(idx));
  
  // Vérifier le nombre de réponses
  if (userIndices.length !== nombreAttendu) {
    return {
      score: 0,
      isCorrect: false,
      details: `Nombre de réponses incorrect (${userIndices.length}/${nombreAttendu})`
    };
  }
  
  // Vérifier les réponses inacceptables
  let hasInacceptable = false;
  let hasIndispensable = false;
  let bonnesReponses = 0;
  
  userIndices.forEach(idx => {
    if (options[idx]) {
      const correction = options[idx].correction;
      if (correction === 'inacceptable') {
        hasInacceptable = true;
      }
      if (correction === 'indispensable') {
        hasIndispensable = true;
      }
      if (correction === 'vrai' || correction === 'indispensable') {
        bonnesReponses++;
      }
    }
  });
  
  // Si réponse inacceptable sélectionnée = 0 point
  if (hasInacceptable) {
    return { 
      score: 0, 
      isCorrect: false, 
      details: 'Réponse inacceptable sélectionnée - 0 point' 
    };
  }
  
  // Vérifier si une réponse indispensable est manquante
  const indispensableOptions = options.filter(opt => opt.correction === 'indispensable');
  if (indispensableOptions.length > 0 && !hasIndispensable) {
    return { 
      score: 0, 
      isCorrect: false, 
      details: 'Réponse indispensable manquante - 0 point' 
    };
  }
  
  // Score proportionnel basé sur les bonnes réponses
  const score = Math.min(1, bonnesReponses / nombreAttendu);
  
  return {
    score: score,
    isCorrect: score === 1,
    details: `${bonnesReponses}/${nombreAttendu} bonnes réponses (${Math.round(score * 100)}%)`
  };
}

function evaluateQROC(question, userAnswer) {
  // Logique d'évaluation QROC simple
  const expectedAnswer = question.reponse_attendue || '';
  const isCorrect = userAnswer && userAnswer.toLowerCase().trim() === expectedAnswer.toLowerCase().trim();
  
  return {
    score: isCorrect ? 1 : 0,
    isCorrect: isCorrect,
    details: isCorrect ? 'Bonne réponse' : `Réponse incorrecte (attendue: ${expectedAnswer})`
  };
}

function evaluateQZP(question, userAnswer) {
  // Logique d'évaluation QZP basique
  const placedCount = Object.keys(userAnswer || {}).length;
  const zones = JSON.parse(question.zones_cliquables || '[]');
  
  return {
    score: placedCount > 0 ? 0.5 : 0, // Score partiel pour l'instant
    isCorrect: placedCount === zones.length,
    details: `${placedCount}/${zones.length} éléments placés`
  };
}

function displayResults(totalScore, maxScore, percentage, results) {
  const container = document.getElementById('qcm-container');
  
  let html = `
    <div class="results-container bg-white rounded-lg shadow-lg p-6">
      <div class="results-header text-center mb-6">
        <h2 class="text-2xl font-bold mb-4">
          <i class="fas fa-trophy text-yellow-500 mr-2"></i>
          Résultats du QCM
        </h2>
        <div class="score-display bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg p-6 mb-4">
          <div class="text-4xl font-bold">${totalScore}/${maxScore}</div>
          <div class="text-xl">${percentage}%</div>
        </div>
      </div>
      
      <div class="results-details space-y-4">
  `;
  
  results.forEach((result, index) => {
    const question = currentQuestions.find(q => q.id === result.questionId);
    const statusClass = result.isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200';
    const statusIcon = result.isCorrect ? 'fa-check-circle text-green-600' : 'fa-times-circle text-red-600';
    
    html += `
      <div class="result-item ${statusClass} border rounded-lg p-4">
        <div class="flex items-center justify-between mb-2">
          <span class="font-semibold">Question ${index + 1}</span>
          <div class="flex items-center gap-2">
            <i class="fas ${statusIcon}"></i>
            <span class="font-medium">${result.score}/${1} point</span>
          </div>
        </div>
        <div class="text-sm text-gray-600 mb-2">${question.enonce}</div>
        <div class="text-sm">${result.details}</div>
      </div>
    `;
  });
  
  html += `
      </div>
      
      <div class="text-center mt-6">
        <button onclick="window.location.reload()" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg">
          <i class="fas fa-redo mr-2"></i>Reprendre le QCM
        </button>
      </div>
    </div>
  `;
  
  container.innerHTML = html;
}

// ===== FONCTIONS LISTE QCM =====

// Charger et afficher la liste des QCM disponibles
async function loadQCMList() {
  console.log('🚀 loadQCMList() appelée');
  console.log('📍 Pathname actuel:', window.location.pathname);
  console.log('📄 Document ready state:', document.readyState);
  
  const container = document.getElementById('qcm-list');
  console.log('🔍 Container qcm-list:', container);
  
  if (!container) {
    console.error('❌ Container QCM non trouvé');
    console.log('🔍 Tous les éléments avec ID:', Array.from(document.querySelectorAll('[id]')).map(el => el.id));
    return;
  }

  try {
    console.log('🔄 Chargement de la liste des QCM...');
    
    const response = await fetch('/api/qcm/list');
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('✅ QCM chargés:', data);
    
    displayQCMList(data.qcms, container);
    
  } catch (error) {
    console.error('❌ Erreur chargement QCM:', error);
    container.innerHTML = `
      <div style="text-align: center; padding: 2rem; grid-column: 1/-1;">
        <i class="fas fa-exclamation-triangle" style="font-size: 2rem; color: #e74c3c; margin-bottom: 1rem;"></i>
        <p style="color: #e74c3c;">Erreur lors du chargement des QCM</p>
        <button onclick="loadQCMList()" class="btn-secondary" style="margin-top: 1rem;">Réessayer</button>
      </div>
    `;
  }
}

// Fonction utilitaire pour forcer le chargement (debug)
window.forceLoadQCM = function() {
  console.log('🔧 Force reload QCM appelé manuellement');
  loadQCMList();
};

// Version avec retry automatique
async function loadQCMListWithRetry(maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    console.log(`🔄 Tentative ${i + 1}/${maxRetries}`);
    
    const container = document.getElementById('qcm-list');
    if (container) {
      console.log('✅ Container trouvé, chargement des QCM');
      return loadQCMList();
    }
    
    console.log('⏳ Container non trouvé, attente...');
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  console.error('❌ Container qcm-list non trouvé après', maxRetries, 'tentatives');
}

// Afficher la liste des QCM dans le container
function displayQCMList(qcms, container) {
  console.log('🎨 displayQCMList() appelée avec:', { qcms, container });
  
  if (!qcms || qcms.length === 0) {
    console.log('📭 Aucun QCM à afficher');
    container.innerHTML = `
      <div style="text-align: center; padding: 3rem; grid-column: 1/-1;">
        <i class="fas fa-clipboard-list" style="font-size: 3rem; color: var(--gray-medium); margin-bottom: 1rem;"></i>
        <p style="color: var(--gray-dark); font-size: 1.1rem;">Aucun QCM disponible pour le moment</p>
        <p style="color: var(--gray-medium); font-size: 0.9rem;">Revenez bientôt pour de nouveaux QCM !</p>
      </div>
    `;
    return;
  }

  console.log('📋 Génération HTML pour', qcms.length, 'QCM');
  let html = '';
  
  qcms.forEach((qcm, index) => {
    console.log(`🔧 Traitement QCM ${index + 1}:`, qcm.titre);
    
    // Calculer le statut du QCM
    const now = new Date();
    const debut = new Date(qcm.disponible_debut);
    const fin = new Date(qcm.disponible_fin);
    const limite = new Date(qcm.date_limite);
    
    let status = '';
    let statusClass = '';
    let clickable = true;
    
    if (now < debut) {
      status = 'Bientôt disponible';
      statusClass = 'status-upcoming';
      clickable = false;
    } else if (now > fin) {
      status = 'Terminé';
      statusClass = 'status-ended';
      clickable = false;
    } else if (now > limite) {
      status = 'Hors délai';
      statusClass = 'status-late';
    } else {
      status = 'Disponible';
      statusClass = 'status-available';
    }
    
    console.log(`📊 QCM ${qcm.titre} - Status: ${status}, Clickable: ${clickable}`);
    
    const cardClass = clickable ? 'qcm-card clickable' : 'qcm-card disabled';
    const onclick = clickable ? `onclick="window.location.href='/qcm/${qcm.id}'"` : '';
    
    try {
      html += `
        <div class="${cardClass}" ${onclick}>
          <div class="qcm-header">
            <span class="qcm-specialite">${qcm.specialite}</span>
            <span class="qcm-status ${statusClass}">${status}</span>
          </div>
          <div class="qcm-content">
            <h3 class="qcm-title">${qcm.titre}</h3>
            <p class="qcm-description">${qcm.description || ''}</p>
            <div class="qcm-meta">
              <div class="qcm-meta-item">
                <i class="fas fa-calendar-week"></i>
                <span>Semaine ${qcm.semaine}</span>
              </div>
              <div class="qcm-meta-item">
                <i class="fas fa-clock"></i>
                <span>Limite: ${formatDateSimple(qcm.date_limite)}</span>
              </div>
            </div>
          </div>
          ${clickable ? '<div class="qcm-action"><i class="fas fa-play-circle"></i> Commencer</div>' : ''}
        </div>
      `;
      console.log(`✅ HTML généré pour QCM ${qcm.titre}`);
    } catch (error) {
      console.error(`❌ Erreur génération HTML pour QCM ${qcm.titre}:`, error);
    }
  });
  
  console.log('🖊️ Mise à jour du container avec HTML généré');
  console.log('📏 Longueur HTML:', html.length);
  
  try {
    container.innerHTML = html;
    console.log('✅ Container mis à jour avec succès');
  } catch (error) {
    console.error('❌ Erreur mise à jour container:', error);
  }
}

// Formater une date de façon simple pour l'affichage QCM
function formatDateSimple(dateString) {
  if (!dateString) return 'N/A';
  
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

// ===== INITIALISATION =====

document.addEventListener('DOMContentLoaded', function() {
  console.log('🚀 DOMContentLoaded - Initialisation app.js');
  console.log('📍 Pathname:', window.location.pathname);
  
  // Initialiser l'authentification
  checkAuth();
  
  // Charger la liste des QCM si on est sur /qcm
  if (window.location.pathname === '/qcm') {
    console.log('🎯 Page QCM détectée - chargement de la liste');
    // Utiliser la version avec retry
    loadQCMListWithRetry();
  } else {
    console.log('📄 Autre page détectée:', window.location.pathname);
  }
  
  // Charger le QCM si on est sur une page QCM spécifique
  const qcmMatch = window.location.pathname.match(/^\/qcm\/(\d+)$/);
  if (qcmMatch) {
    const qcmId = qcmMatch[1];
    console.log('🎯 QCM spécifique détecté, ID:', qcmId);
    loadQCM(qcmId);
  }
});

/**
 * SYSTÈME COMPLET DE QUESTIONS - OMAS EXTERNAT
 * Compatible Moodle avec Dossier Progressif intégré
 * Types supportés: QRU, QRM, QRP, QROC, QZP
 */

// =========================
// CONFIGURATION GLOBALE
// =========================
const QUESTION_SYSTEM = {
  currentMode: 'normal', // 'normal' ou 'progressive'
  progressiveState: null,
  responses: {},
  lockedQuestions: new Set()
};

// =========================
// SYSTÈME DE RENDU PRINCIPAL
// =========================

/**
 * Affiche un QCM normal ou lance le mode progressif
 */
function displayQCM(qcm, questions) {
  console.log('🎯 Affichage QCM:', qcm.titre, 'Questions:', questions.length);
  
  const container = document.getElementById('qcm-container');
  if (!container) {
    console.error('❌ Container QCM introuvable');
    return;
  }

  // Réinitialiser le système
  QUESTION_SYSTEM.responses = {};
  QUESTION_SYSTEM.lockedQuestions.clear();

  if (qcm.is_dossier_progressif) {
    QUESTION_SYSTEM.currentMode = 'progressive';
    initializeProgressiveFolder(qcm, questions);
  } else {
    QUESTION_SYSTEM.currentMode = 'normal';
    displayNormalQCM(qcm, questions);
  }
}

/**
 * Affichage QCM normal (toutes questions visibles)
 */
function displayNormalQCM(qcm, questions) {
  const container = document.getElementById('qcm-container');
  
  let html = `
    <div class="qcm-header">
      <h1><i class="fas fa-clipboard-list"></i> ${qcm.titre}</h1>
      <div class="qcm-meta">
        <span><strong>Spécialité :</strong> ${qcm.specialite}</span>
        <span><strong>Semaine :</strong> ${qcm.semaine}</span>
        <span><strong>Questions :</strong> ${questions.length}</span>
      </div>
    </div>
    
    <div class="qcm-description">
      ${qcm.description || ''}
    </div>
    
    <form id="qcm-form" class="qcm-form">
  `;

  questions.forEach((question, index) => {
    html += renderQuestionCard(question, index, false);
  });

  html += `
      <div class="submit-section">
        <button type="button" class="btn-validate-all" onclick="validateAllAnswers()">
          <i class="fas fa-check-circle"></i>
          Valider mes réponses
        </button>
      </div>
    </form>
  `;

  container.innerHTML = html;
  
  // Initialiser les interactions
  initializeQuestionInteractions();
}

// =========================
// SYSTÈME DOSSIER PROGRESSIF
// =========================

/**
 * Initialise un dossier progressif
 */
function initializeProgressiveFolder(qcm, questions) {
  console.log('📁 Initialisation Dossier Progressif');
  
  QUESTION_SYSTEM.progressiveState = {
    qcm: qcm,
    questions: questions,
    currentIndex: 0,
    responses: {},
    initialStatement: (qcm.contexte_initial && qcm.contexte_initial !== 'null') ? qcm.contexte_initial : (qcm.description || 'Énoncé du dossier progressif non disponible.'),
    isCompleted: false
  };

  displayProgressiveIntroduction();
}

/**
 * Affiche l'énoncé initial du dossier progressif
 */
function displayProgressiveIntroduction() {
  const container = document.getElementById('qcm-container');
  const state = QUESTION_SYSTEM.progressiveState;
  
  const html = `
    <div class="dp-container">
      <div class="dp-header">
        <h1><i class="fas fa-folder-open"></i> ${state.qcm.titre}</h1>
        <div class="dp-badge">Dossier Progressif</div>
      </div>
      
      <div class="dp-progress">
        <div class="progress-label">Énoncé initial</div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: 0%"></div>
        </div>
        <div class="progress-text">0 / ${state.questions.length} questions</div>
      </div>
      
      <div class="dp-statement">
        <div class="statement-header">
          <i class="fas fa-clipboard"></i>
          <h3>Énoncé du cas clinique</h3>
        </div>
        <div class="statement-content">
          ${state.initialStatement}
        </div>
      </div>
      
      <div class="dp-actions">
        <button type="button" class="btn-start-dp" onclick="startProgressiveQuestions()">
          <i class="fas fa-play"></i>
          Commencer le dossier
        </button>
      </div>
    </div>
  `;
  
  container.innerHTML = html;
}

/**
 * Lance les questions du dossier progressif
 */
function startProgressiveQuestions() {
  console.log('▶️ Début des questions progressives');
  
  // Initialiser le state d'abord
  if (!QUESTION_SYSTEM.progressiveState) {
    console.log('📁 Initialisation du state progressif...');
    QUESTION_SYSTEM.progressiveState = {
      qcm: currentQCM,
      questions: currentQuestions,
      currentIndex: 0,
      responses: {},
      initialStatement: (currentQCM?.contexte_initial && currentQCM.contexte_initial !== 'null') ? currentQCM.contexte_initial : (currentQCM?.description || 'Énoncé du dossier progressif non disponible.'),
      isCompleted: false
    };
  }
  
  displayProgressiveQuestion(0);
}

/**
 * Affiche une question spécifique du dossier progressif
 */
function displayProgressiveQuestion(questionIndex) {
  const container = document.getElementById('qcm-container');
  const state = QUESTION_SYSTEM.progressiveState;
  
  if (questionIndex >= state.questions.length) {
    displayProgressiveResults();
    return;
  }
  
  const question = state.questions[questionIndex];
  const progressPercent = ((questionIndex + 1) / state.questions.length) * 100;
  const isLastQuestion = questionIndex === state.questions.length - 1;
  
  let html = `
    <div class="dp-container">
      <div class="dp-header">
        <h1><i class="fas fa-folder-open"></i> ${state.qcm.titre}</h1>
        <div class="dp-badge">Question ${questionIndex + 1}/${state.questions.length}</div>
      </div>
      
      <div class="dp-progress">
        <div class="progress-label">Question ${questionIndex + 1}</div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${progressPercent}%"></div>
        </div>
        <div class="progress-text">${questionIndex + 1} / ${state.questions.length} questions</div>
      </div>
      
      <div class="dp-question-wrapper">
        ${renderQuestionCard(question, questionIndex, true)}
      </div>
      
      <div class="dp-navigation">
  `;
  
  if (questionIndex > 0) {
    html += `
      <button type="button" class="btn-nav btn-previous" onclick="navigateProgressiveQuestion(${questionIndex - 1})">
        <i class="fas fa-chevron-left"></i>
        Précédent
      </button>
    `;
  }
  
  html += `
        <button type="button" class="btn-validate-question" 
                onclick="validateProgressiveQuestion(${questionIndex})"
                data-question-id="${question.id}">
          <i class="fas fa-check"></i>
          ${isLastQuestion ? 'Terminer le dossier' : 'Valider et continuer'}
        </button>
      </div>
    </div>
  `;
  
  container.innerHTML = html;
  
  // Restaurer la réponse précédente si elle existe
  restoreProgressiveResponse(question, questionIndex);
  
  // Initialiser les interactions
  initializeQuestionInteractions();
  
  // Mettre à jour l'état
  state.currentIndex = questionIndex;
}

/**
 * Navigue vers une question précédente (si déverrouillée)
 */
function navigateProgressiveQuestion(questionIndex) {
  const state = QUESTION_SYSTEM.progressiveState;
  
  // Vérifier si on peut revenir en arrière (questions déjà validées)
  if (questionIndex >= 0 && questionIndex < state.currentIndex) {
    displayProgressiveQuestion(questionIndex);
  }
}

/**
 * Valide une question du dossier progressif
 */
function validateProgressiveQuestion(questionIndex) {
  const state = QUESTION_SYSTEM.progressiveState;
  const question = state.questions[questionIndex];
  
  // Collecter la réponse
  const response = collectQuestionResponse(question);
  
  if (!response) {
    showAlert('Veuillez répondre à la question avant de continuer.', 'warning');
    return;
  }
  
  // Sauvegarder la réponse
  state.responses[question.id] = response;
  QUESTION_SYSTEM.responses[question.id] = response;
  
  // Verrouiller la question
  QUESTION_SYSTEM.lockedQuestions.add(question.id);
  
  console.log('✅ Question validée:', question.id, 'Réponse:', response);
  
  // Passer à la question suivante ou terminer
  if (questionIndex === state.questions.length - 1) {
    displayProgressiveResults();
  } else {
    displayProgressiveQuestion(questionIndex + 1);
  }
}

/**
 * Affiche les résultats finaux du dossier progressif
 */
function displayProgressiveResults() {
  const container = document.getElementById('qcm-container');
  const state = QUESTION_SYSTEM.progressiveState;
  
  let html = `
    <div class="dp-container">
      <div class="dp-header completed">
        <h1><i class="fas fa-check-circle"></i> Dossier Progressif Terminé</h1>
        <div class="dp-badge completed">Complété</div>
      </div>
      
      <div class="dp-summary">
        <h3>Récapitulatif de vos réponses</h3>
        <div class="responses-list">
  `;
  
  state.questions.forEach((question, index) => {
    const response = state.responses[question.id];
    html += `
      <div class="response-item">
        <div class="response-header">
          <span class="question-number">Q${index + 1}</span>
          <span class="question-type">${getQuestionTypeLabel(question.question_type)}</span>
        </div>
        <div class="response-content">
          <p class="question-text">${question.enonce.substring(0, 100)}...</p>
          <p class="user-response"><strong>Votre réponse :</strong> ${formatResponseForDisplay(response, question)}</p>
        </div>
      </div>
    `;
  });
  
  html += `
        </div>
      </div>
      
      <div class="dp-final-actions">
        <button type="button" class="btn-submit-dp" onclick="submitProgressiveFolder()">
          <i class="fas fa-paper-plane"></i>
          Soumettre le dossier
        </button>
        <button type="button" class="btn-review" onclick="displayProgressiveQuestion(0)">
          <i class="fas fa-eye"></i>
          Revoir les questions
        </button>
      </div>
    </div>
  `;
  
  container.innerHTML = html;
}

// =========================
// RENDU DES QUESTIONS
// =========================

/**
 * Rendu d'une carte de question
 */
function renderQuestionCard(question, index, isProgressive = false) {
  const isLocked = QUESTION_SYSTEM.lockedQuestions.has(question.id);
  const lockClass = isLocked ? ' locked' : '';
  
  let html = `
    <div class="question-card${lockClass}" data-question-id="${question.id}">
      <div class="question-header">
        <div class="question-number">${index + 1}</div>
        <div class="question-type-badge ${getQuestionTypeBadgeClass(question.question_type)}">
          ${getQuestionTypeLabel(question.question_type)}
        </div>
  `;
  
  if (isLocked) {
    html += '<div class="locked-indicator"><i class="fas fa-lock"></i> Verrouillé</div>';
  }
  
  html += `
      </div>
      <div class="question-content">
        <div class="question-text">${question.enonce}</div>
        <div class="question-options">
          ${renderQuestionOptions(question, isLocked)}
        </div>
      </div>
    </div>
  `;
  
  return html;
}

/**
 * Rendu des options selon le type de question
 */
function renderQuestionOptions(question, isLocked = false) {
  const disabledAttr = isLocked ? 'disabled' : '';
  
  switch (question.question_type) {
    case 'qru':
    case 'single':
      return renderQRUOptions(question, disabledAttr);
      
    case 'qrm':
    case 'multiple':
      return renderQRMOptions(question, disabledAttr);
      
    case 'qrp':
      return renderQRPOptions(question, disabledAttr);
      
    case 'qroc':
      return renderQROCInput(question, disabledAttr);
      
    case 'qzp':
      return renderQZPInterface(question, disabledAttr);
      
    default:
      return '<div class="error">Type de question non reconnu</div>';
  }
}

/**
 * QRU - Question à Réponse Unique (radio buttons)
 */
function renderQRUOptions(question, disabledAttr = '') {
  let html = `
    <div class="qru-container">
      <div class="question-instructions">
        <i class="fas fa-dot-circle"></i>
        Une seule réponse possible
      </div>
      <div class="options-list">
  `;
  
  const options = ['option_a', 'option_b', 'option_c', 'option_d', 'option_e'];
  options.forEach((opt, index) => {
    if (question[opt]) {
      const letter = String.fromCharCode(65 + index);
      html += `
        <div class="option-item">
          <input type="radio" 
                 name="question_${question.id}" 
                 value="${letter}" 
                 id="q${question.id}_${letter}"
                 ${disabledAttr}>
          <label for="q${question.id}_${letter}">
            <span class="option-letter">${letter}</span>
            <span class="option-text">${question[opt]}</span>
          </label>
        </div>
      `;
    }
  });
  
  html += `
      </div>
    </div>
  `;
  
  return html;
}

/**
 * QRM - Question à Réponses Multiples (checkboxes)
 */
function renderQRMOptions(question, disabledAttr = '') {
  let html = `
    <div class="qrm-container">
      <div class="question-instructions">
        <i class="fas fa-check-square"></i>
        Plusieurs réponses possibles
      </div>
      <div class="options-list">
  `;
  
  const options = ['option_a', 'option_b', 'option_c', 'option_d', 'option_e'];
  options.forEach((opt, index) => {
    if (question[opt]) {
      const letter = String.fromCharCode(65 + index);
      html += `
        <div class="option-item">
          <input type="checkbox" 
                 name="question_${question.id}[]" 
                 value="${letter}" 
                 id="q${question.id}_${letter}"
                 ${disabledAttr}>
          <label for="q${question.id}_${letter}">
            <span class="option-letter">${letter}</span>
            <span class="option-text">${question[opt]}</span>
          </label>
        </div>
      `;
    }
  });
  
  html += `
      </div>
    </div>
  `;
  
  return html;
}

/**
 * QRP - Question à Réponses Prédéterminées
 */
function renderQRPOptions(question, disabledAttr = '') {
  const expectedCount = question.nombre_reponses_attendues || 3;
  
  let html = `
    <div class="qrp-container">
      <div class="question-instructions">
        <i class="fas fa-list-ol"></i>
        ${expectedCount} réponse(s) attendue(s)
      </div>
      <div class="options-list">
  `;
  
  const options = ['option_a', 'option_b', 'option_c', 'option_d', 'option_e'];
  options.forEach((opt, index) => {
    if (question[opt]) {
      const letter = String.fromCharCode(65 + index);
      html += `
        <div class="option-item">
          <input type="checkbox" 
                 name="question_${question.id}[]" 
                 value="${letter}" 
                 id="q${question.id}_${letter}"
                 class="qrp-checkbox"
                 data-max-selection="${expectedCount}"
                 ${disabledAttr}>
          <label for="q${question.id}_${letter}">
            <span class="option-letter">${letter}</span>
            <span class="option-text">${question[opt]}</span>
          </label>
        </div>
      `;
    }
  });
  
  html += `
      </div>
      <div class="selection-counter">
        <span id="counter_${question.id}">0</span> / ${expectedCount} sélectionnée(s)
      </div>
    </div>
  `;
  
  return html;
}

/**
 * QROC - Question à Réponse Ouverte Courte
 */
function renderQROCInput(question, disabledAttr = '') {
  return `
    <div class="qroc-container">
      <div class="question-instructions">
        <i class="fas fa-edit"></i>
        Réponse courte attendue
      </div>
      <div class="input-wrapper">
        <input type="text" 
               name="question_${question.id}" 
               id="q${question.id}_input"
               placeholder="Saisissez votre réponse..."
               class="qroc-input"
               ${disabledAttr}>
        <div class="input-hint">
          Réponse courte, précise et sans abréviation
        </div>
      </div>
    </div>
  `;
}

/**
 * QZP - Question à Zone de Pointage
 */
function renderQZPInterface(question, disabledAttr = '') {
  if (!question.image_url || !question.zones_cliquables) {
    return `
      <div class="qzp-error">
        <i class="fas fa-exclamation-triangle"></i>
        Image ou zones cliquables non disponibles
      </div>
    `;
  }
  
  let zones = [];
  try {
    zones = JSON.parse(question.zones_cliquables);
  } catch (error) {
    console.error('Erreur parsing zones QZP:', error);
    return `
      <div class="qzp-error">
        <i class="fas fa-exclamation-triangle"></i>
        Erreur dans la configuration des zones
      </div>
    `;
  }
  
  let html = `
    <div class="qzp-container">
      <div class="question-instructions">
        <i class="fas fa-mouse-pointer"></i>
        Cliquez sur les éléments puis placez-les sur l'image
      </div>
      
      <div class="qzp-workspace">
        <div class="qzp-elements">
          <div class="elements-title">Éléments à placer :</div>
          <div class="elements-list" id="qzp_elements_${question.id}">
  `;
  
  zones.forEach((zone, index) => {
    html += `
      <div class="qzp-element" 
           draggable="true" 
           data-zone-id="${zone.id}" 
           data-question-id="${question.id}"
           ${disabledAttr}>
        <i class="fas fa-grip-vertical"></i>
        ${zone.nom}
      </div>
    `;
  });
  
  html += `
          </div>
        </div>
        
        <div class="qzp-image-container">
          <div class="image-wrapper" id="qzp_image_${question.id}">
            <img src="${question.image_url}" 
                 alt="Image QZP" 
                 class="qzp-image"
                 id="qzp_img_${question.id}">
            <div class="qzp-overlay" id="qzp_overlay_${question.id}"></div>
          </div>
        </div>
      </div>
      
      <div class="qzp-placements" id="qzp_placements_${question.id}">
        <!-- Les placements seront ajoutés ici -->
      </div>
    </div>
  `;
  
  return html;
}

// =========================
// UTILITAIRES
// =========================

function getQuestionTypeLabel(type) {
  const labels = {
    'qru': 'QRU',
    'single': 'QRU',
    'qrm': 'QRM', 
    'multiple': 'QRM',
    'qrp': 'QRP',
    'qroc': 'QROC',
    'qzp': 'QZP'
  };
  return labels[type] || type.toUpperCase();
}

function getQuestionTypeBadgeClass(type) {
  const classes = {
    'qru': 'badge-qru',
    'single': 'badge-qru',
    'qrm': 'badge-qrm',
    'multiple': 'badge-qrm', 
    'qrp': 'badge-qrp',
    'qroc': 'badge-qroc',
    'qzp': 'badge-qzp'
  };
  return classes[type] || 'badge-default';
}

/**
 * Collecte la réponse d'une question
 */
function collectQuestionResponse(question) {
  const questionId = question.id;
  
  switch (question.question_type) {
    case 'qru':
    case 'single':
      const radioChecked = document.querySelector(`input[name="question_${questionId}"]:checked`);
      return radioChecked ? radioChecked.value : null;
      
    case 'qrm':
    case 'multiple':
    case 'qrp':
      const checkboxesChecked = document.querySelectorAll(`input[name="question_${questionId}[]"]:checked`);
      return checkboxesChecked.length > 0 ? Array.from(checkboxesChecked).map(cb => cb.value) : null;
      
    case 'qroc':
      const textInput = document.querySelector(`input[name="question_${questionId}"]`);
      return textInput && textInput.value.trim() ? textInput.value.trim() : null;
      
    case 'qzp':
      // Logique de collecte des placements QZP
      const placements = collectQZPPlacements(questionId);
      return placements.length > 0 ? placements : null;
      
    default:
      return null;
  }
}

/**
 * Restaure une réponse dans une question progressive
 */
function restoreProgressiveResponse(question, questionIndex) {
  const state = QUESTION_SYSTEM.progressiveState;
  const savedResponse = state.responses[question.id];
  
  if (!savedResponse) return;
  
  console.log('🔄 Restauration réponse:', question.id, savedResponse);
  
  setTimeout(() => {
    switch (question.question_type) {
      case 'qru':
      case 'single':
        if (typeof savedResponse === 'string') {
          const radio = document.querySelector(`input[name="question_${question.id}"][value="${savedResponse}"]`);
          if (radio) radio.checked = true;
        }
        break;
        
      case 'qrm':
      case 'multiple':
      case 'qrp':
        if (Array.isArray(savedResponse)) {
          savedResponse.forEach(value => {
            const checkbox = document.querySelector(`input[name="question_${question.id}[]"][value="${value}"]`);
            if (checkbox) checkbox.checked = true;
          });
        }
        break;
        
      case 'qroc':
        const input = document.querySelector(`input[name="question_${question.id}"]`);
        if (input) input.value = savedResponse;
        break;
        
      case 'qzp':
        // Restaurer les placements QZP
        if (Array.isArray(savedResponse)) {
          restoreQZPPlacements(question.id, savedResponse);
        }
        break;
    }
  }, 100);
}

/**
 * Formate une réponse pour l'affichage
 */
function formatResponseForDisplay(response, question) {
  if (!response) return 'Aucune réponse';
  
  switch (question.question_type) {
    case 'qru':
    case 'single':
      return `Réponse ${response}`;
      
    case 'qrm':
    case 'multiple':
    case 'qrp':
      return Array.isArray(response) ? `Réponses: ${response.join(', ')}` : response;
      
    case 'qroc':
      return `"${response}"`;
      
    case 'qzp':
      return Array.isArray(response) ? `${response.length} placement(s)` : 'Placements effectués';
      
    default:
      return String(response);
  }
}

// =========================
// INITIALISATION
// =========================

/**
 * Initialise les interactions des questions
 */
function initializeQuestionInteractions() {
  // Gestion des QRP avec limite de sélection
  document.querySelectorAll('.qrp-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', handleQRPSelection);
  });
  
  // Gestion du drag & drop pour QZP
  document.querySelectorAll('.qzp-element').forEach(element => {
    element.addEventListener('dragstart', handleQZPDragStart);
  });
  
  document.querySelectorAll('.qzp-image-container').forEach(container => {
    container.addEventListener('dragover', handleQZPDragOver);
    container.addEventListener('drop', handleQZPDrop);
  });
}

/**
 * Gestion de la sélection QRP
 */
function handleQRPSelection(event) {
  const checkbox = event.target;
  const questionId = checkbox.name.match(/question_(\d+)/)[1];
  const maxSelection = parseInt(checkbox.dataset.maxSelection);
  
  const checked = document.querySelectorAll(`input[name="question_${questionId}[]"]:checked`);
  const counter = document.getElementById(`counter_${questionId}`);
  
  if (counter) {
    counter.textContent = checked.length;
  }
  
  // Désactiver les autres checkboxes si limite atteinte
  if (checked.length >= maxSelection) {
    document.querySelectorAll(`input[name="question_${questionId}[]"]:not(:checked)`).forEach(cb => {
      cb.disabled = true;
    });
  } else {
    document.querySelectorAll(`input[name="question_${questionId}[]"]`).forEach(cb => {
      cb.disabled = false;
    });
  }
}

// =========================
// FONCTIONS QZP
// =========================

let qzpDraggedElement = null;

function handleQZPDragStart(event) {
  qzpDraggedElement = event.target;
  event.dataTransfer.effectAllowed = 'move';
}

function handleQZPDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
}

function handleQZPDrop(event) {
  event.preventDefault();
  
  if (!qzpDraggedElement) return;
  
  const rect = event.currentTarget.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  
  const questionId = qzpDraggedElement.dataset.questionId;
  const zoneId = qzpDraggedElement.dataset.zoneId;
  
  // Créer le placement
  createQZPPlacement(questionId, zoneId, x, y, qzpDraggedElement.textContent);
  
  // Masquer l'élément déplacé
  qzpDraggedElement.style.opacity = '0.5';
  qzpDraggedElement.draggable = false;
  
  qzpDraggedElement = null;
}

function createQZPPlacement(questionId, zoneId, x, y, zoneName) {
  const overlay = document.getElementById(`qzp_overlay_${questionId}`);
  if (!overlay) return;
  
  const placement = document.createElement('div');
  placement.className = 'qzp-placement';
  placement.style.left = x + 'px';
  placement.style.top = y + 'px';
  placement.dataset.zoneId = zoneId;
  placement.innerHTML = `
    <span class="placement-label">${zoneName}</span>
    <button class="placement-remove" onclick="removeQZPPlacement(this, '${questionId}', '${zoneId}')">
      <i class="fas fa-times"></i>
    </button>
  `;
  
  overlay.appendChild(placement);
  
  console.log('📍 Placement QZP créé:', { questionId, zoneId, x, y });
}

function removeQZPPlacement(button, questionId, zoneId) {
  // Supprimer le placement
  button.parentElement.remove();
  
  // Restaurer l'élément dans la liste
  const element = document.querySelector(`[data-question-id="${questionId}"][data-zone-id="${zoneId}"]`);
  if (element) {
    element.style.opacity = '1';
    element.draggable = true;
  }
}

function collectQZPPlacements(questionId) {
  const placements = [];
  const overlay = document.getElementById(`qzp_overlay_${questionId}`);
  
  if (overlay) {
    overlay.querySelectorAll('.qzp-placement').forEach(placement => {
      const rect = placement.getBoundingClientRect();
      const overlayRect = overlay.getBoundingClientRect();
      
      placements.push({
        zoneId: placement.dataset.zoneId,
        x: rect.left - overlayRect.left,
        y: rect.top - overlayRect.top
      });
    });
  }
  
  return placements;
}

function restoreQZPPlacements(questionId, placements) {
  placements.forEach(placement => {
    const element = document.querySelector(`[data-question-id="${questionId}"][data-zone-id="${placement.zoneId}"]`);
    if (element) {
      createQZPPlacement(questionId, placement.zoneId, placement.x, placement.y, element.textContent);
      element.style.opacity = '0.5';
      element.draggable = false;
    }
  });
}

// =========================
// VALIDATION ET SOUMISSION
// =========================

/**
 * Valide toutes les réponses (mode normal)
 */
function validateAllAnswers() {
  console.log('✅ Validation de toutes les réponses');
  
  // Collecter toutes les réponses
  const allQuestions = document.querySelectorAll('.question-card');
  const responses = {};
  
  allQuestions.forEach(card => {
    const questionId = card.dataset.questionId;
    // Trouver la question correspondante
    // Cette logique doit être adaptée selon votre structure de données
  });
  
  // Soumission au serveur
  submitResponses(responses);
}

/**
 * Soumet un dossier progressif complet
 */
function submitProgressiveFolder() {
  const state = QUESTION_SYSTEM.progressiveState;
  console.log('📤 Soumission dossier progressif:', state.responses);
  
  // Soumission au serveur
  submitResponses(state.responses, true);
}

/**
 * Soumet les réponses au serveur
 */
function submitResponses(responses, isProgressive = false) {
  console.log('📡 Soumission des réponses:', responses);
  
  // Ici, ajouter la logique d'envoi au serveur
  showAlert('Réponses soumises avec succès!', 'success');
}

console.log('✅ Système de questions complet chargé');