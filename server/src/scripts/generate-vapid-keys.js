/**
 * Script to generate VAPID keys for push notifications
 * 
 * Run with: node generate-vapid-keys.js
 * 
 * The generated keys should be added to your .env file:
 * VAPID_PUBLIC_KEY=<public key>
 * VAPID_PRIVATE_KEY=<private key>
 * VAPID_SUBJECT=mailto:support@swickr.com
 */

const webpush = require('web-push');

// Generate VAPID keys
const vapidKeys = webpush.generateVAPIDKeys();

console.log('VAPID Keys generated successfully!');
console.log('\nAdd the following to your .env file:');
console.log(`VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log('VAPID_SUBJECT=mailto:support@swickr.com');
