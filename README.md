# MyCompanion (V2)

Application compagnon IA "Voice-First" qui vous appelle quotidiennement pour prendre des nouvelles, vous motiver ou vous coacher.

## Stack Technique

- **Frontend/Mobile**: Expo (React Native), Expo Router
- **Backend**: API Routes (Expo/Node.js)
- **Base de données**: Aucune ! (Utilise Stripe Metadata comme Source of Truth)
- **IA Vocale**: Dipler
- **Paiements**: Stripe
- **Scheduling**: Upstash QStash
- **Rate Limiting**: Upstash Redis
- **SMS**: Twilio

## Pré-requis

- Node.js 18+
- Compte Stripe
- Compte Dipler
- Compte Upstash (Redis & QStash)
- Compte Twilio
- Expo CLI (`npm install -g eas-cli`)

## Installation

```bash
npm install
```

## Configuration

Copiez `.env.example` vers `.env` et remplissez les variables :

```bash
cp .env.example .env
```

### Variables Requises

```env
# App
API_BASE_URL=https://votre-app.com

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PAYMENT_LINK_STANDARD=https://buy.stripe.com/...

# Dipler
DIPLER_API_KEY=...
DIPLER_AGENT_RECEPTIONIST=...

# QStash
QSTASH_TOKEN=...
QSTASH_CURRENT_SIGNING_KEY=...
QSTASH_NEXT_SIGNING_KEY=...

# Twilio
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=...

# Ratelimit (Upstash Redis)
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

## Développement Local

```bash
npx expo start
```

### Webhooks en Local

Pour tester les webhooks (Stripe/Dipler) en local, utilisez `ngrok` ou `localtunnel` pour exposer votre port local, et mettez à jour les URLs dans les dashboards respectifs.

## Déploiement (Production)

L'application est configurée pour être déployée via **EAS (Expo Application Services)**.

### 1. Configurer les secrets EAS

```bash
eas secret:push --scope project --env-file .env
```

### 2. Lancer le build

```bash
eas build --profile production --platform all
```

### 3. Déployer les mises à jour (OTA)

```bash
eas update --branch production
```

## Webhooks

### Stripe
Configurez un endpoint webhook pointant vers : `https://votre-domaine.com/api/webhook/stripe`
Écoutez les événements :
- `checkout.session.completed`
- `customer.subscription.deleted`
- `invoice.payment_failed`

### Dipler
Dans les paramètres de vos agents Dipler, configurez l'URL de webhook :
`https://votre-domaine.com/api/webhook/dipler`

## Sécurité

- **Rate Limiting**: Activé sur `/api/start-trial` (3/h) et `/api/user-status` (60/m).
- **Authentification**: Token basé (stocké dans Stripe Metadata, échangé via Bearer Token).
