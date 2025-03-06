/**
 * Swickr Push Notification Setup Script
 * 
 * This script helps set up the push notification system for Swickr by:
 * 1. Generating VAPID keys if they don't exist
 * 2. Adding the keys to the .env file
 * 3. Running the necessary database migrations
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Paths
const serverDir = path.join(__dirname, 'server');
const envPath = path.join(serverDir, '.env');
const generateVapidScript = path.join(serverDir, 'src', 'scripts', 'generate-vapid-keys.js');

// Function to ask a question and get user input
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Function to generate VAPID keys
async function generateVapidKeys() {
  console.log('\n📝 Generating VAPID keys...');
  
  try {
    // Check if the script exists
    if (!fs.existsSync(generateVapidScript)) {
      console.error('❌ VAPID key generation script not found!');
      console.error(`Expected at: ${generateVapidScript}`);
      return null;
    }
    
    // Run the script and capture output
    const output = execSync(`node "${generateVapidScript}"`, { cwd: serverDir }).toString();
    
    // Parse the output to extract keys
    const publicKeyMatch = output.match(/Public Key: (.+)/);
    const privateKeyMatch = output.match(/Private Key: (.+)/);
    
    if (!publicKeyMatch || !privateKeyMatch) {
      console.error('❌ Failed to parse VAPID keys from output');
      return null;
    }
    
    return {
      publicKey: publicKeyMatch[1].trim(),
      privateKey: privateKeyMatch[1].trim()
    };
  } catch (error) {
    console.error('❌ Error generating VAPID keys:', error.message);
    return null;
  }
}

// Function to update .env file
function updateEnvFile(keys, email) {
  console.log('\n📝 Updating .env file...');
  
  try {
    // Check if .env file exists
    if (!fs.existsSync(envPath)) {
      console.error(`❌ .env file not found at ${envPath}`);
      return false;
    }
    
    // Read current .env content
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Check if VAPID keys already exist
    const hasVapidPublicKey = envContent.includes('VAPID_PUBLIC_KEY=');
    const hasVapidPrivateKey = envContent.includes('VAPID_PRIVATE_KEY=');
    const hasVapidSubject = envContent.includes('VAPID_SUBJECT=');
    
    // Update or add VAPID keys
    if (hasVapidPublicKey) {
      envContent = envContent.replace(/VAPID_PUBLIC_KEY=.*/g, `VAPID_PUBLIC_KEY=${keys.publicKey}`);
    } else {
      envContent += `\nVAPID_PUBLIC_KEY=${keys.publicKey}`;
    }
    
    if (hasVapidPrivateKey) {
      envContent = envContent.replace(/VAPID_PRIVATE_KEY=.*/g, `VAPID_PRIVATE_KEY=${keys.privateKey}`);
    } else {
      envContent += `\nVAPID_PRIVATE_KEY=${keys.privateKey}`;
    }
    
    if (hasVapidSubject) {
      envContent = envContent.replace(/VAPID_SUBJECT=.*/g, `VAPID_SUBJECT=mailto:${email}`);
    } else {
      envContent += `\nVAPID_SUBJECT=mailto:${email}`;
    }
    
    // Write updated content back to .env
    fs.writeFileSync(envPath, envContent);
    
    console.log('✅ .env file updated successfully');
    return true;
  } catch (error) {
    console.error('❌ Error updating .env file:', error.message);
    return false;
  }
}

// Function to run database migrations
function runMigrations() {
  console.log('\n📝 Running database migrations...');
  
  try {
    execSync('npm run migrate', { cwd: serverDir, stdio: 'inherit' });
    console.log('✅ Database migrations completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Error running migrations:', error.message);
    return false;
  }
}

// Main function
async function setupPushNotifications() {
  console.log('🔔 Swickr Push Notification Setup');
  console.log('================================');
  
  // Ask for contact email
  const email = await askQuestion('\nEnter your contact email for VAPID (required for push notifications): ');
  
  if (!email || !email.includes('@')) {
    console.error('❌ Invalid email address. Please provide a valid email.');
    rl.close();
    return;
  }
  
  // Generate VAPID keys
  const keys = await generateVapidKeys();
  
  if (!keys) {
    console.error('❌ Failed to generate VAPID keys. Setup aborted.');
    rl.close();
    return;
  }
  
  console.log('✅ VAPID keys generated successfully');
  
  // Update .env file
  const envUpdated = updateEnvFile(keys, email);
  
  if (!envUpdated) {
    console.error('❌ Failed to update .env file. Setup aborted.');
    rl.close();
    return;
  }
  
  // Ask if user wants to run migrations
  const runMigrationsAnswer = await askQuestion('\nDo you want to run database migrations now? (y/n): ');
  
  if (runMigrationsAnswer.toLowerCase() === 'y') {
    const migrationsSuccessful = runMigrations();
    
    if (!migrationsSuccessful) {
      console.error('❌ Database migrations failed. You may need to run them manually.');
    }
  } else {
    console.log('\n⚠️ Skipping database migrations. Remember to run them manually with:');
    console.log('  cd server && npm run migrate');
  }
  
  console.log('\n🎉 Push notification setup completed!');
  console.log('\nNext steps:');
  console.log('1. Restart your server to apply the changes');
  console.log('2. Visit the notification settings page in the app to enable push notifications');
  console.log('3. Test the notifications using the test page or the provided scripts');
  console.log('\nFor more information, see PUSH_NOTIFICATIONS.md and TESTING_PUSH_NOTIFICATIONS.md');
  
  rl.close();
}

// Run the setup
setupPushNotifications();
