// Initialisation du header pour toutes les pages
(function() {
  'use strict';
  
  // Fonction pour vérifier l'authentification
  function checkAuth() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    if (token && user) {
      return JSON.parse(user);
    }
    return null;
  }
  
  // Fonction de déconnexion
  window.logout = function() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/connexion';
  };
  
  // Initialiser le header au chargement
  function initializeHeader() {
    const user = checkAuth();
    
    // Mettre à jour le bouton profil
    const userName = document.getElementById('user-name');
    const profileBtn = document.getElementById('profile-btn');
    const profileDropdown = document.getElementById('profile-dropdown');
    const chevronIcon = document.getElementById('chevron-icon');
    
    if (user && userName) {
      // Afficher le prénom de l'utilisateur
      userName.textContent = user.prenom || user.nom || 'Profil';
      
      // Mettre à jour le contenu du dropdown selon le rôle
      if (profileDropdown) {
        let dropdownContent = '';
        
        if (user.role === 'teacher') {
          dropdownContent = `
            <a href="/dashboard-enseignant" class="dropdown-item">
              <i class="fas fa-chalkboard-teacher"></i>
              <span>Dashboard</span>
            </a>
            <div class="dropdown-divider"></div>
            <a href="#" class="dropdown-item" onclick="logout(); return false;">
              <i class="fas fa-sign-out-alt"></i>
              <span>Déconnexion</span>
            </a>
          `;
        } else if (user.role === 'student') {
          dropdownContent = `
            <a href="/espace-etudiant" class="dropdown-item">
              <i class="fas fa-chart-line"></i>
              <span>Mon Espace</span>
            </a>
            <div class="dropdown-divider"></div>
            <a href="#" class="dropdown-item" onclick="logout(); return false;">
              <i class="fas fa-sign-out-alt"></i>
              <span>Déconnexion</span>
            </a>
          `;
        }
        
        profileDropdown.innerHTML = dropdownContent;
      }
    }
    
    // Initialiser le menu déroulant
    if (profileBtn && profileDropdown) {
      // Gérer le clic sur le bouton
      profileBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const isOpen = profileDropdown.classList.contains('show');
        
        // Fermer tous les autres dropdowns
        document.querySelectorAll('.profile-dropdown').forEach(dropdown => {
          if (dropdown !== profileDropdown) {
            dropdown.classList.remove('show');
          }
        });
        
        // Toggle ce dropdown
        profileDropdown.classList.toggle('show');
        
        // Animer le chevron
        if (chevronIcon) {
          chevronIcon.style.transform = profileDropdown.classList.contains('show') 
            ? 'rotate(180deg)' 
            : 'rotate(0deg)';
        }
      });
      
      // Fermer au clic à l'extérieur
      document.addEventListener('click', function(e) {
        if (!profileBtn.contains(e.target) && !profileDropdown.contains(e.target)) {
          profileDropdown.classList.remove('show');
          if (chevronIcon) {
            chevronIcon.style.transform = 'rotate(0deg)';
          }
        }
      });
      
      // Empêcher la fermeture lors du clic sur le dropdown lui-même
      profileDropdown.addEventListener('click', function(e) {
        e.stopPropagation();
      });
    }
  }
  
  // Initialiser au chargement du DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeHeader);
  } else {
    initializeHeader();
  }
})();
