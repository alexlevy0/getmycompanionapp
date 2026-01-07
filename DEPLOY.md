# Guide de Déploiement - MyCompanion V2

Ce guide décrit les étapes pour déployer l'API (backend) et l'Application Mobile en production sur l'infrastructure Expo (EAS).

## 1. Pré-requis

Assurez-vous d'avoir les outils suivants installés et configurés :
- **EAS CLI** : `npm install -g eas-cli`
- **Compte Expo** : Connectez-vous avec `eas login`

## 2. Configuration des Variables d'Environnement (Secrets)

L'application repose sur des APIs externes. Vous devez copier vos clés locales (`.env`) vers les serveurs de build d'Expo.

1.  Assurez-vous que votre fichier `.env` local est complet (voir `.env.example`).
2.  Envoyez les secrets vers EAS :

```bash
eas secret:push --scope project --env-file .env
```

> **Note :** Si vous modifiez une variable (ex: URL du webhook), vous devez relancer cette commande puis redéployer.

## 3. Déploiement de l'API (Backend)

L'API est hébergée via **Expo Router API Routes** (mode serverless).

1.  Lancer le déploiement :

```bash
npm run deploy:api
```

2.  Une fois terminé, EAS vous fournira une URL (ex: `https://mycompanion-api.expo.app`).
3.  **IMPORTANT :** Mettez à jour la variable `API_BASE_URL` dans votre `.env` local avec cette nouvelle URL, puis renvoyez les secrets :

```bash
# Dans .env : API_BASE_URL=https://votre-nouvelle-url.expo.app
eas secret:push --scope project --env-file .env
```

## 4. Configuration des Webhooks

Une fois l'API en ligne, connectez les services externes :

### Stripe
- Dashboard > Developers > Webhooks
- Endpoint URL : `https://votre-url-api.expo.app/api/webhook/stripe`
- Events à écouter :
  - `checkout.session.completed`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`

### Dipler
- Dashboard Dipler > Agents
- Webhook URL : `https://votre-url-api.expo.app/api/webhook/dipler`

## 5. Construction de l'Application Mobile (Build)

Pour générer l'APK (Android) ou l'IPA (iOS) :

```bash
eas build --profile production --platform all
```

- EAS va construire l'application dans le cloud.
- Une fois terminé, vous recevrez un lien pour télécharger les binaires ou les soumettre aux stores.

## 6. Mises à jour Over-The-Air (OTA)

Pour mettre à jour le code JS/React de l'application (sans toucher au code natif) :

```bash
eas update --branch production
```

## Résolution de problèmes

### L'app crashe au démarrage
- Vérifiez les logs avec `eas logs`.
- Assurez-vous que `API_BASE_URL` est correcte dans les secrets.

### Les appels ne se lancent pas
- Vérifiez les webhooks Stripe (ont-ils bien reçu le succès ?).
- Vérifiez les logs QStash dans le dashboard Upstash pour voir si les tâches sont délivrées.
