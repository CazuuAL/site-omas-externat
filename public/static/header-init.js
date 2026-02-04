/**
 * Initialisation SIMPLE et UNIQUE du menu profil
 * Ce script gère le menu déroulant sur TOUTES les pages
 */

// S'exécute une seule fois
if (!window.profileMenuInitialized) {
  window.profileMenuInitialized = true;
  
  console.log('🔧 Initialisation du menu profil...');
  
  // Fonction de déconnexion globale
  window.logout = function() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/connexion';
  };
  
  // Initialiser dès que le DOM est prêt
  function initProfileMenu() {
    // Récupérer l'utilisateur connecté
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      console.log('❌ Pas d\'utilisateur connecté');
      return;
    }
    
    const user = JSON.parse(userStr);
    console.log('✅ Utilisateur:', user.prenom, '(' + user.role + ')');
    
    // Récupérer les éléments
    const profileBtn = document.getElementById('profile-btn');
    const profileDropdown = document.getElementById('profile-dropdown');
    const chevronIcon = document.getElementById('chevron-icon');
    const userName = document.getElementById('user-name');
    
    if (!profileBtn || !profileDropdown) {
      console.log('⚠️ Éléments du menu non trouvés sur cette page');
      return;
    }
    
    console.log('✅ Éléments trouvés, initialisation...');
    
    // 1. Afficher le nom de l'utilisateur
    if (userName) {
      userName.textContent = user.prenom || user.nom || 'Profil';
    }
    
    // 2. Générer le contenu du dropdown selon le rôle
    let dropdownHTML = '';
    
    if (user.role === 'teacher') {
      dropdownHTML = `
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
      dropdownHTML = `
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
    
    profileDropdown.innerHTML = dropdownHTML;
    
    // 3. Gérer le clic sur le bouton (UNE SEULE FOIS)
    profileBtn.onclick = function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      const isOpen = profileDropdown.classList.contains('show');
      
      // Toggle
      profileDropdown.classList.toggle('show');
      
      // Animation du chevron
      if (chevronIcon) {
        chevronIcon.style.transform = profileDropdown.classList.contains('show') 
          ? 'rotate(180deg)' 
          : 'rotate(0deg)';
      }
      
      console.log('🖱️ Menu', profileDropdown.classList.contains('show') ? 'ouvert' : 'fermé');
    };
    
    // 4. Fermer au clic extérieur (UNE SEULE FOIS)
    document.addEventListener('click', function(e) {
      if (!profileBtn.contains(e.target) && !profileDropdown.contains(e.target)) {
        profileDropdown.classList.remove('show');
        if (chevronIcon) {
          chevronIcon.style.transform = 'rotate(0deg)';
        }
      }
    }, { once: false });
    
    // 5. Empêcher la fermeture lors du clic sur le dropdown
    profileDropdown.addEventListener('click', function(e) {
      e.stopPropagation();
    });
    
    console.log('✅ Menu profil initialisé avec succès');
  }
  
  // Lancer l'initialisation
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initProfileMenu);
  } else {
    initProfileMenu();
  }
}
