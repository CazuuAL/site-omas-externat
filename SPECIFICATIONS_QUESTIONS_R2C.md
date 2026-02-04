# Types de Questions - R2C ECNnf

## 📚 Référentiel R2C 2023

D'après le document officiel "Règles générales de notation" validé par le COSUI.

---

## 1. QRM - Questions à Réponses Multiples ✅ (Déjà implémenté)

**Caractéristiques** :
- 4 à 5 propositions
- Plusieurs réponses possibles
- Correction par "discordance"

**Types de réponses** :
- **Vrai** : Réponse correcte
- **Faux** : Réponse incorrecte  
- **Indispensable** : Si non cochée → 0 point
- **Inacceptable** : Si cochée → 0 point

**Barème** :
- 0 discordance → 1 point
- 1 discordance → 0.5 point
- 2 discordances → 0.2 point
- 3+ discordances → 0 point

---

## 2. QRU - Question à Réponse Unique ✅ (Partiellement implémenté)

**Caractéristiques** :
- 4 à 5 propositions
- UNE SEULE réponse correcte
- Correction binaire

**Types de réponses** :
- **Indispensable** : La seule bonne réponse (1 seule)
- **Inacceptable** : Toutes les autres

**Barème** :
- Bonne réponse unique cochée → 1 point
- Autre cas → 0 point

---

## 3. QRP - Question à Nombre de Réponses Précisé 🆕 (À implémenter)

**Caractéristiques** :
- 4 à 5 propositions
- Nombre de réponses attendues précisé (ex: "3 réponses attendues")
- L'étudiant DOIT cocher exactement N réponses

**Types de réponses** :
- **Vrai** : Réponse correcte
- **Faux** : Réponse incorrecte
- **Indispensable** : Si non cochée → 0 point
- **Inacceptable** : Si cochée → 0 point

**Barème** :
- Score = `x / n`
  - `x` = nombre de bonnes réponses cochées
  - `n` = nombre total de réponses attendues

**Exemple** :
```
Question : Quelles sont les voyelles (3 réponses attendues)
A. e (indispensable)
B. z (inacceptable)
C. y (vrai)
D. l (faux)
E. i (vrai)

Étudiant coche A, C, E → 3/3 = 1 point
Étudiant coche A, C, D → 2/3 = 0.66 point
Étudiant coche A, B, C → 0 point (inacceptable cochée)
Étudiant coche C, D, E → 0 point (indispensable non cochée)
```

---

## 4. QRP Longues - QRP avec 10 à 25 propositions 🆕 (À implémenter)

**Caractéristiques** :
- 10 à 25 propositions
- 1 à 5 réponses attendues (précisé dans l'énoncé)
- Limite de sélection = nombre attendu

**Types de réponses** :
- **Vrai** : Réponse correcte
- **Faux** : Réponse incorrecte
- **PAS de réponses indispensables ou inacceptables**

**Barème** :
- Score = `x / n`
  - `x` = nombre de bonnes réponses cochées
  - `n` = nombre total de réponses attendues

**Exemple** :
```
Question : Quelles sont les voyelles (4 réponses attendues)
22 propositions présentées...

Étudiant coche 4 bonnes → 4/4 = 1 point
Étudiant coche 3 bonnes + 1 fausse → 3/4 = 0.75 point
Étudiant coche 2 bonnes + 2 fausses → 2/4 = 0.5 point
Étudiant coche 0 bonne → 0/4 = 0 point
```

---

## 5. QZP - Questions Zone à Pointer 🆕 (À implémenter)

**Caractéristiques** :
- Image avec zones cliquables
- Maximum 5 zones à pointer
- L'étudiant clique sur des zones de l'image

**Barème** :
- Score = `n / x`
  - `n` = nombre de bonnes zones pointées
  - `x` = nombre de zones attendues

**Implémentation technique** :
- Image avec map HTML ou SVG
- Coordonnées des zones cliquables
- Détection du clic dans une zone

---

## 6. QROC - Questions à Réponse Ouverte et Courte 🆕 (À implémenter)

**Caractéristiques** :
- Champ texte libre
- Maximum 5 mots
- Correction par catégories

**Types de réponses** :
- **Catégorie 1** (1 point) : Réponses exactes (liste fournie)
- **Catégorie 2** (0.5 point) : Réponses acceptables mais pas totalement exactes
- **Catégorie 3** (0 point) : Toutes les autres réponses

**Exemple** :
```
Question : Quelle est la capitale de la France ?

Catégorie 1 (1pt) : "Paris", "paris", "PARIS"
Catégorie 2 (0.5pt) : "La capitale c'est Paris", "Ville de Paris"
Catégorie 3 (0pt) : Tout le reste
```

---

## 7. TCS - Tests de Concordance de Scripts ⏳ (Futur - 2024)

Non inclus dans les examens 2023.

---

## 🔧 Implémentation Technique

### Migration Base de Données

```sql
-- Mise à jour de la table questions
ALTER TABLE questions ADD COLUMN question_subtype TEXT; -- QRM, QRU, QRP, QRP_LONG, QZP, QROC, TCS
ALTER TABLE questions ADD COLUMN expected_answers_count INTEGER; -- Pour QRP/QRP_LONG
ALTER TABLE questions ADD COLUMN answer_type_a TEXT; -- vrai/faux/indispensable/inacceptable
ALTER TABLE questions ADD COLUMN answer_type_b TEXT;
ALTER TABLE questions ADD COLUMN answer_type_c TEXT;
ALTER TABLE questions ADD COLUMN answer_type_d TEXT;
ALTER TABLE questions ADD COLUMN answer_type_e TEXT;
ALTER TABLE questions ADD COLUMN image_url TEXT; -- Pour QZP
ALTER TABLE questions ADD COLUMN zones_data TEXT; -- JSON pour QZP
ALTER TABLE questions ADD COLUMN category1_answers TEXT; -- JSON pour QROC
ALTER TABLE questions ADD COLUMN category2_answers TEXT; -- JSON pour QROC
```

### Interface Enseignant

**Sélection du type de question** :
```
Type de question *
[dropdown]
- QRM - Réponses multiples (discordance)
- QRU - Réponse unique (binaire)
- QRP - Nombre précisé (4-5 options)
- QRP Long - Nombre précisé (10-25 options)
- QZP - Zone à pointer (image)
- QROC - Réponse ouverte courte (texte)
```

**Champs conditionnels selon le type** :
- QRP/QRP_LONG → Champ "Nombre de réponses attendues"
- QZP → Upload d'image + définition des zones
- QROC → Définition catégories 1 et 2

**Type de réponse par proposition** :
```
Pour chaque option (A, B, C, D, E) :
[dropdown]
- Vrai
- Faux
- Indispensable
- Inacceptable
```

---

## 📊 Priorités d'Implémentation

### Phase 1 - Haute Priorité (1-2 jours)
1. ✅ QRM (déjà fait)
2. ✅ QRU (améliorer avec types indispensable/inacceptable)
3. 🆕 QRP (à implémenter)

### Phase 2 - Moyenne Priorité (2-3 jours)
4. 🆕 QRP Longues (10-25 options)
5. 🆕 QROC (texte libre)

### Phase 3 - Basse Priorité (3-5 jours)
6. 🆕 QZP (images cliquables)
7. ⏳ TCS (futur 2024)

---

## 🎯 Calcul des Scores

### Fonction générique de calcul

```javascript
function calculateScore(question, userAnswers) {
  const type = question.question_subtype;
  
  switch(type) {
    case 'QRM':
      return calculateQRMScore(question, userAnswers);
    case 'QRU':
      return calculateQRUScore(question, userAnswers);
    case 'QRP':
    case 'QRP_LONG':
      return calculateQRPScore(question, userAnswers);
    case 'QZP':
      return calculateQZPScore(question, userAnswers);
    case 'QROC':
      return calculateQROCScore(question, userAnswers);
    default:
      return 0;
  }
}
```

---

**Version** : Spécifications v1.0  
**Date** : 04 Février 2026  
**Source** : Document R2C officiel COSUI 2023
