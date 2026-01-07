const fs = require('fs');
const path = require('path');

// List of required environment variables
const REQUIRED_ENV_VARS = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PAYMENT_LINK_STANDARD',
  'API_BASE_URL',
  'DIPLER_API_KEY',
  'DIPLER_AGENT_RECEPTIONIST',
  'QSTASH_TOKEN',
  'QSTASH_CURRENT_SIGNING_KEY',
  'QSTASH_NEXT_SIGNING_KEY',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_PHONE_NUMBER',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN'
];

function checkEnv() {
  console.log('🔍 Checking environment variables...');
  
  // Try to read .env file for local check (optional, as EAS uses its own secrets)
  // This is mostly for local dev or pre-push check
  const envPath = path.join(__dirname, '..', '.env');
  let envContent = '';
  
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }

  const missing = [];

  for (const key of REQUIRED_ENV_VARS) {
    // Check process.env first (CI/CD) then .env content
    const inProcess = process.env[key];
    const inEnvFile = envContent.includes(`${key}=`);
    
    // Note: We're doing a loose check here. 
    // In a real environment, you'd want to parse .env properly.
    // For this context, we just want to remind the user if they're missing something locally.
    
    if (!inProcess && !inEnvFile) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    console.warn('\n⚠️  WARNING: The following environment variables seem to be missing:');
    missing.forEach(key => console.warn(`   - ${key}`));
    console.warn('\nMake sure they are set in your .env file locally or in EAS Secrets for production.');
    console.warn('Run: eas secret:push --scope project --env-file .env\n');
    // We don't exit(1) because this might be running in an environment where vars are injected differently
    // and we don't want to block the build unnecessarily if the user knows what they are doing.
  } else {
    console.log('✅  All required environment variables appear to be set.');
  }
}

checkEnv();
