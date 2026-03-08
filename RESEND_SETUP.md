# Configuration Email avec Resend

## 📧 Envoi d'emails GRATUIT avec Resend

### **1. Créer un compte Resend (GRATUIT)**
- Aller sur : https://resend.com
- S'inscrire gratuitement
- **Limite gratuite** : 3000 emails/mois, 100 emails/jour

### **2. Obtenir la clé API**
1. Se connecter sur https://resend.com/api-keys
2. Cliquer "Create API Key"
3. Nom : `OMAS Externat`
4. Permissions : `Send emails`
5. Copier la clé (format : `re_xxxxxxxxxx`)

### **3. Configuration locale (développement)**
```bash
# Éditer le fichier .dev.vars
RESEND_API_KEY=re_votre_cle_ici
```

### **4. Configuration production (Cloudflare)**
```bash
# Ajouter le secret Cloudflare
npx wrangler secret put RESEND_API_KEY
# Coller votre clé API quand demandé
```

### **5. Domaine personnalisé (optionnel)**
- Par défaut : emails envoyés depuis `onboarding@resend.dev`
- Domaine custom : configurer DNS sur Resend pour `votredomaine.com`

### **6. Test du système**
- ✅ **Sans clé API** : Emails simulés dans les logs
- ✅ **Avec clé API** : Vrais emails envoyés via Resend

## 🎯 **État actuel :**
- **Mode développement** : Simulation (console.log)
- **Mode production** : Prêt pour Resend
- **Fallback intelligent** : Fonctionne avec ou sans clé API