// Dashboard Étudiant - OMAS Externat

let radarChart = null;

// Charger les données au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
  const user = checkAuth();
  
  if (!user) {
    window.location.href = '/connexion';
    return;
  }
  
  if (user.role !== 'student') {
    showAlert('Accès réservé aux étudiants', 'error');
    window.location.href = '/';
    return;
  }
  
  // Afficher le nom de l'utilisateur dans le menu
  const userName = document.getElementById('user-name');
  if (userName) {
    userName.textContent = `${user.prenom}`;
  }
  
  // Le menu profil est géré par header-init.js
  
  // Charger les statistiques
  loadStudentStats(user.id);
});

// Charger les statistiques de l'étudiant
async function loadStudentStats(userId) {
  try {
    const response = await fetch(`/api/student/${userId}/stats`);
    
    if (!response.ok) {
      throw new Error('Erreur lors du chargement des statistiques');
    }
    
    const data = await response.json();
    
    // Afficher les stats globales
    displayGlobalStats(data.stats);
    
    // Créer le graphique radar
    createRadarChart(data.stats);
    
    // Afficher les QCM récents
    displayRecentQcms(data.recentQcms);
    
  } catch (error) {
    console.error('Erreur:', error);
    showAlert('Impossible de charger vos statistiques', 'error');
  }
}

// Afficher les statistiques globales
function displayGlobalStats(stats) {
  if (!stats || stats.length === 0) {
    document.getElementById('total-qcm').textContent = '0';
    document.getElementById('avg-score').textContent = '0%';
    document.getElementById('best-subject').textContent = 'Aucun';
    document.getElementById('weak-subject').textContent = 'Aucun';
    return;
  }
  
  // Total QCM complétés
  const totalQcm = stats.reduce((sum, stat) => sum + stat.nb_qcm_faits, 0);
  document.getElementById('total-qcm').textContent = totalQcm;
  
  // Score moyen global
  const totalCorrect = stats.reduce((sum, stat) => sum + (stat.total_correct || 0), 0);
  const totalQuestions = stats.reduce((sum, stat) => sum + (stat.total_questions || 0), 0);
  const avgScore = totalQuestions > 0 ? ((totalCorrect / totalQuestions) * 100).toFixed(1) : 0;
  document.getElementById('avg-score').textContent = avgScore + '%';
  
  // Meilleure matière et matière à améliorer
  const sortedByScore = [...stats].sort((a, b) => b.score_moyen - a.score_moyen);
  
  if (sortedByScore.length > 0) {
    document.getElementById('best-subject').textContent = sortedByScore[0].specialite;
    
    if (sortedByScore.length > 1) {
      document.getElementById('weak-subject').textContent = sortedByScore[sortedByScore.length - 1].specialite;
    } else {
      document.getElementById('weak-subject').textContent = '-';
    }
  }
}

// Créer le graphique radar
function createRadarChart(stats) {
  if (!stats || stats.length === 0) {
    document.querySelector('.chart-wrapper').innerHTML = `
      <div style="text-align: center; padding: 3rem; color: var(--text-medium);">
        <i class="fas fa-chart-radar" style="font-size: 3rem; opacity: 0.3; margin-bottom: 1rem;"></i>
        <p style="font-size: 1.1rem;">Aucune donnée disponible</p>
        <p style="font-size: 0.9rem; margin-top: 0.5rem;">Complétez des QCM pour voir vos statistiques</p>
      </div>
    `;
    return;
  }
  
  // Préparer les données pour le radar
  const labels = stats.map(stat => stat.specialite);
  const scores = stats.map(stat => {
    const percentage = (stat.score_moyen * 100).toFixed(1);
    return parseFloat(percentage);
  });
  
  const ctx = document.getElementById('radarChart');
  
  // Détruire le graphique existant si présent
  if (radarChart) {
    radarChart.destroy();
  }
  
  // Créer le nouveau graphique
  radarChart = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Score (%)',
        data: scores,
        fill: true,
        backgroundColor: 'rgba(15, 124, 140, 0.2)',
        borderColor: 'rgba(15, 124, 140, 1)',
        borderWidth: 2,
        pointBackgroundColor: 'rgba(15, 124, 140, 1)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(15, 124, 140, 1)',
        pointRadius: 5,
        pointHoverRadius: 7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        r: {
          beginAtZero: true,
          max: 100,
          min: 0,
          ticks: {
            stepSize: 20,
            callback: function(value) {
              return value + '%';
            },
            font: {
              size: 12
            }
          },
          pointLabels: {
            font: {
              size: 14,
              weight: 'bold'
            },
            color: '#2c3e50'
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.1)'
          },
          angleLines: {
            color: 'rgba(0, 0, 0, 0.1)'
          }
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return context.parsed.r.toFixed(1) + '%';
            }
          },
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 12,
          titleFont: {
            size: 14
          },
          bodyFont: {
            size: 13
          }
        }
      }
    }
  });
}

// Afficher les QCM récents
function displayRecentQcms(qcms) {
  const container = document.getElementById('recent-qcm-list');
  
  if (!qcms || qcms.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-clipboard-list"></i>
        <p>Vous n'avez pas encore complété de QCM</p>
        <a href="/qcm" class="btn-primary" style="margin-top: 1rem; display: inline-block;">
          <i class="fas fa-arrow-right"></i> Accéder aux QCM
        </a>
      </div>
    `;
    return;
  }
  
  let html = '<div class="qcm-history-grid">';
  
  qcms.forEach(qcm => {
    const score = ((qcm.correct_answers / qcm.total_questions) * 100).toFixed(1);
    const date = new Date(qcm.completed_at).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    
    let scoreClass = 'score-good';
    let scoreIcon = 'fa-check-circle';
    
    if (score < 50) {
      scoreClass = 'score-poor';
      scoreIcon = 'fa-times-circle';
    } else if (score < 75) {
      scoreClass = 'score-average';
      scoreIcon = 'fa-exclamation-circle';
    }
    
    html += `
      <div class="qcm-history-card">
        <div class="qcm-history-header">
          <span class="qcm-specialite-badge" style="background: var(--primary-color);">
            ${qcm.specialite}
          </span>
          <span class="qcm-semaine">Semaine ${qcm.semaine}</span>
        </div>
        <h3 class="qcm-history-title">${qcm.titre}</h3>
        <div class="qcm-history-score ${scoreClass}">
          <i class="fas ${scoreIcon}"></i>
          <span class="score-value">${qcm.correct_answers}/${qcm.total_questions}</span>
          <span class="score-percentage">(${score}%)</span>
        </div>
        <div class="qcm-history-date">
          <i class="fas fa-calendar"></i> ${date}
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  container.innerHTML = html;
}
