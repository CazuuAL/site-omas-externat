# Guide de Debugging - OMAS Externat v4.3

## 🐛 Problèmes Identifiés

### 1. Bouton "Ajouter une question" ne fonctionne pas
### 2. Chargement infini sur le dashboard enseignant

---

## 🔍 Logs de Debug Ajoutés

### Dans la Console du Navigateur

Ouvrez la console JavaScript (F12 → Onglet "Console") et vous verrez :

#### **Sur /creer-qcm** :
```
✅ Formulaire de création détecté
📝 Tableau questions initialisé: []
➕ Ajout de la première question par défaut
🔧 addQuestion() appelée - Questions actuelles: 0
📦 Création de la div question, index: 0
✅ Ajout de la question au container
✅ Question ajoutée ! Total: 1
✅ Bouton "Ajouter une question" détecté
```

**Si vous cliquez sur "Ajouter une question"** :
```
🖱️ Clic sur le bouton "Ajouter une question"
📝 Nombre de questions actuel: 1
🔧 addQuestion() appelée - Questions actuelles: 1
📦 Création de la div question, index: 1
✅ Ajout de la question au container
✅ Question ajoutée ! Total: 2
```

**Si RIEN ne s'affiche** :
```
❌ Bouton "add-question-btn" introuvable !
```
ou
```
❌ Container "questions-container" introuvable !
```

---

#### **Sur /dashboard-enseignant** :
```
✅ Vérification de l'authentification et mise à jour du header
👤 Utilisateur: {id: 3, nom: "Dupont", prenom: "Marie", email: "enseignant@exemple.fr", role: "teacher"}
📚 loadTeacherQCMs() - Début du chargement
👤 Utilisateur: {id: 3, nom: "Dupont", prenom: "Marie", ...}
🌐 Appel API: /api/teacher/qcm/list/3
📦 Réponse API: {qcms: []}
✅ 0 QCM(s) trouvé(s)
```

**Si l'API échoue** :
```
❌ Erreur réponse: 500
```
ou
```
❌ Erreur fetch: TypeError: Failed to fetch
```

---

## 🧪 Tests à Effectuer

### Test 1 : Création de Question

1. Se connecter en tant qu'enseignant :
   - Email : `enseignant@exemple.fr`
   - Mot de passe : `password123`

2. Aller sur `/creer-qcm`

3. **Ouvrir la console JavaScript (F12)**

4. Vérifier les logs :
   - ✅ Si vous voyez "✅ Question ajoutée ! Total: 1" → **FONCTIONNE**
   - ❌ Si aucun log → Problème de chargement du script
   - ❌ Si "❌ Container introuvable" → Problème HTML

5. Cliquer sur "Ajouter une question"
   - ✅ Si vous voyez "🖱️ Clic sur le bouton" → Le clic est détecté
   - ✅ Si une nouvelle question s'affiche → **FONCTIONNE**
   - ❌ Si rien ne se passe → Problème dans addQuestion()

---

### Test 2 : Dashboard Enseignant

1. Se connecter en tant qu'enseignant

2. Aller sur `/dashboard-enseignant`

3. **Ouvrir la console JavaScript (F12)**

4. Vérifier les logs :
   - ✅ Si vous voyez "📦 Réponse API" → L'API répond
   - ✅ Si vous voyez "✅ 0 QCM(s) trouvé(s)" et le message "Vous n'avez pas encore créé de QCM" → **FONCTIONNE**
   - ❌ Si le spinner tourne à l'infini → L'API ne répond pas ou checkAuth() échoue
   - ❌ Si "❌ Utilisateur non enseignant" → Problème d'authentification

---

## 🔧 Solutions Possibles

### Problème 1 : Script teacher.js ne se charge pas

**Symptôme** : Aucun log dans la console

**Solution** :
```bash
# Vérifier que le fichier existe
ls -la /home/user/webapp/public/static/teacher.js

# Vérifier qu'il est servi correctement
curl -I http://localhost:3000/static/teacher.js
```

**Si 404** : Le fichier n'est pas copié dans dist/
```bash
cd /home/user/webapp
npm run build
pm2 restart omas-externat
```

---

### Problème 2 : checkAuth() retourne null

**Symptôme** : Logs montrent "👤 Utilisateur: null"

**Solution** :
1. Vérifier le localStorage :
   - Console → `localStorage.getItem('user')`
   - Console → `localStorage.getItem('token')`

2. Si vide, se reconnecter

---

### Problème 3 : Container questions-container introuvable

**Symptôme** : Log "❌ Container introuvable"

**Solution** : Vérifier le HTML de /creer-qcm
```bash
curl http://localhost:3000/creer-qcm | grep "questions-container"
```

Si aucun résultat : Le HTML ne contient pas le container
→ Vérifier src/index.tsx ligne ~1418

---

### Problème 4 : API ne répond pas

**Symptôme** : Spinner infini, logs montrent une erreur fetch

**Solution** :
```bash
# Tester l'API directement
curl http://localhost:3000/api/teacher/qcm/list/3

# Si erreur 500 : Vérifier les logs du serveur
pm2 logs omas-externat --lines 50
```

---

## 📋 Checklist de Dépannage

### Avant de tester :
- [ ] `npm run build` exécuté
- [ ] `pm2 restart omas-externat` exécuté
- [ ] Console JavaScript ouverte (F12)
- [ ] Connecté en tant qu'enseignant

### Si le bouton "Ajouter une question" ne marche pas :
- [ ] Vérifier les logs dans la console
- [ ] Vérifier que teacher.js est chargé (Network tab)
- [ ] Vérifier que `questions` est défini (console: `questions`)
- [ ] Essayer `addQuestion()` manuellement dans la console

### Si le dashboard reste en chargement :
- [ ] Vérifier les logs dans la console
- [ ] Vérifier `checkAuth()` (console: `checkAuth()`)
- [ ] Tester l'API manuellement avec curl
- [ ] Vérifier les logs PM2

---

## 🎯 Tests Manuels dans la Console

### Test 1 : Vérifier l'authentification
```javascript
checkAuth()
// Doit retourner: {id: 3, nom: "Dupont", prenom: "Marie", email: "enseignant@exemple.fr", role: "teacher"}
```

### Test 2 : Vérifier le tableau questions
```javascript
questions
// Doit retourner: [] ou [{}, {}] si des questions ont été ajoutées
```

### Test 3 : Ajouter une question manuellement
```javascript
addQuestion()
// Doit ajouter visuellement une nouvelle question
```

### Test 4 : Tester l'API directement
```javascript
fetch('/api/teacher/qcm/list/3').then(r => r.json()).then(console.log)
// Doit afficher: {qcms: []}
```

---

## 📞 Informations de Debug à Fournir

Si les problèmes persistent, fournissez-moi :

1. **Logs de la console** (copier-coller tout ce qui s'affiche)
2. **Network tab** (filtrer par "teacher.js" et "api/teacher")
3. **Logs PM2** : `pm2 logs omas-externat --lines 50`
4. **Test manuel** : Résultat de `checkAuth()` dans la console

---

**Version** : Debug Guide v1.0  
**Date** : 04 Février 2026  
**Statut** : Logs de debug actifs
