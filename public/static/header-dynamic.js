/**
 * Gestion dynamique du header selon l'authentification
 */

(function() {
  'use strict';
  
  // Vérifier l'authentification
  function checkAuth() {
    const userStr = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (userStr && token) {
      return JSON.parse(userStr);
    }
    return null;
  }
  
  // Fonction de déconnexion globale
  window.logout = function() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/connexion';
  };
  
  // Mise à jour du header selon l'authentification
  function updateHeader() {
    const user = checkAuth();
    const navMenu = document.querySelector('.nav-menu');
    
    if (!navMenu) return;
    
    // Si l'utilisateur est connecté
    if (user) {
      // Trouver le bouton "Connexion" et le remplacer
      const connexionBtn = navMenu.querySelector('.btn-connexion');
      if (connexionBtn) {
        connexionBtn.remove();
      }
      
      // Vérifier si les éléments user sont déjà présents
      const existingUserDisplay = navMenu.querySelector('#user-name-display');
      if (existingUserDisplay) {
        // Mettre à jour le nom
        const userName = document.getElementById('user-name');
        if (userName) {
          userName.textContent = user.prenom || user.nom || 'Profil';
        }
        return; // Déjà configuré
      }
      
      // Ajouter le nom d'utilisateur
      const userDisplay = document.createElement('span');
      userDisplay.className = 'nav-link';
      userDisplay.id = 'user-name-display';
      userDisplay.style.cssText = 'color: var(--teal-primary); font-weight: 600; display: flex; align-items: center; gap: 0.3rem;';
      userDisplay.innerHTML = `
        <i class="fas fa-user-circle"></i> <span id="user-name">${user.prenom || user.nom || 'Profil'}</span>
      `;
      navMenu.appendChild(userDisplay);
      
      // Ajouter le bouton de déconnexion
      const logoutBtn = document.createElement('a');
      logoutBtn.href = '#';
      logoutBtn.className = 'nav-link';
      logoutBtn.style.cssText = 'display: flex; align-items: center; gap: 0.3rem; color: var(--red, #e74c3c); font-weight: 600;';
      logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Déconnexion';
      logoutBtn.onclick = function(e) {
        e.preventDefault();
        logout();
        return false;
      };
      navMenu.appendChild(logoutBtn);
      
      // Ajouter les liens spécifiques selon le rôle
      if (user.role === 'teacher') {
        // Vérifier si les liens sont déjà présents
        const mesQcmLink = Array.from(navMenu.querySelectorAll('a')).find(a => a.textContent === 'Mes QCM');
        if (!mesQcmLink) {
          const dashboardLink = document.createElement('a');
          dashboardLink.href = '/dashboard-enseignant';
          dashboardLink.className = 'nav-link';
          dashboardLink.textContent = 'Mes QCM';
          navMenu.insertBefore(dashboardLink, userDisplay);
          
          const createLink = document.createElement('a');
          createLink.href = '/creer-qcm';
          createLink.className = 'nav-link';
          createLink.textContent = 'Créer un QCM';
          navMenu.insertBefore(createLink, userDisplay);
        }
      } else if (user.role === 'student') {
        // Vérifier si le lien est déjà présent
        const espaceLink = Array.from(navMenu.querySelectorAll('a')).find(a => a.textContent === 'Mon Espace');
        if (!espaceLink) {
          const dashboardLink = document.createElement('a');
          dashboardLink.href = '/espace-etudiant';
          dashboardLink.className = 'nav-link';
          dashboardLink.textContent = 'Mon Espace';
          navMenu.insertBefore(dashboardLink, userDisplay);
        }
      }
    }
  }
  
  // Initialiser au chargement du DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateHeader);
  } else {
    updateHeader();
  }
})();
