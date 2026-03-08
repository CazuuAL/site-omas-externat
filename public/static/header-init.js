/**
 * Initialisation simple du header
 * Affiche le nom de l'utilisateur dans la barre de navigation
 */

if (!window.headerInitialized) {
  window.headerInitialized = true;
  
  // Fonction de déconnexion globale
  window.logout = function() {
    localStorage.removeItem('omas_token');
    localStorage.removeItem('omas_user');
    window.location.href = '/connexion';
  };
  
  // Initialiser le nom de l'utilisateur
  function initHeader() {
    const userStr = localStorage.getItem('omas_user');
    if (!userStr) return;
    
    const user = JSON.parse(userStr);
    const userName = document.getElementById('user-name');
    
    if (userName && user) {
      userName.textContent = user.prenom || user.nom || 'Profil';
    }
  }
  
  // Lancer l'initialisation
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHeader);
  } else {
    initHeader();
  }
}
