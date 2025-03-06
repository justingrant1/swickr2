/**
 * Generate VAPID keys for Web Push Notifications
 * 
 * This script generates a pair of public and private VAPID keys
 * that are required for sending push notifications.
 * 
 * Run with: node generateVapidKeys.js
 */

const webpush = require('web-push');
const fs = require('fs');
const path = require('path');

// Generate VAPID keys
const vapidKeys = webpush.generateVAPIDKeys();

console.log('\n=== VAPID Keys Generated ===');
console.log('Public Key:', vapidKeys.publicKey);
console.log('Private Key:', vapidKeys.privateKey);

// Create a .env file with the keys
const envPath = path.join(__dirname, '../../.env');
let envContent = '';

// Read existing .env file if it exists
if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, 'utf8');
}

// Check if VAPID keys are already in the .env file
if (!envContent.includes('VAPID_PUBLIC_KEY=')) {
  envContent += `\n# Push Notification VAPID Keys\nVAPID_PUBLIC_KEY=${vapidKeys.publicKey}\n`;
}

if (!envContent.includes('VAPID_PRIVATE_KEY=')) {
  envContent += `VAPID_PRIVATE_KEY=${vapidKeys.privateKey}\n`;
}

if (!envContent.includes('VAPID_SUBJECT=')) {
  envContent += `VAPID_SUBJECT=mailto:support@swickr.com\n`;
}

// Write the updated .env file
fs.writeFileSync(envPath, envContent);

console.log('\nVAPID keys have been added to your .env file.');
console.log('Make sure to restart your server for the changes to take effect.');
console.log('\nFor production, ensure these keys are securely stored and not committed to version control.');
