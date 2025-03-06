/**
 * Start Demo Script
 * 
 * This script starts both the client and server for testing the Swickr application
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Set environment variables for testing
process.env.NODE_ENV = 'development';
process.env.USE_MOCK_DB = 'true';

console.log('🚀 Starting Swickr demo...');

// Start the server
const serverProcess = spawn('npm', ['run', 'start'], {
  cwd: path.join(__dirname, 'server'),
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    PORT: '3001',
    USE_MOCK_DB: 'true'
  }
});

console.log('📡 Starting server on port 3001...');

// Wait a bit before starting the client
setTimeout(() => {
  // Start the client
  const clientProcess = spawn('npm', ['start'], {
    cwd: path.join(__dirname, 'client'),
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      PORT: '3000',
      BROWSER: 'none' // Don't open browser automatically
    }
  });

  console.log('💻 Starting client on port 3000...');

  // Handle client process events
  clientProcess.on('error', (error) => {
    console.error('Client process error:', error);
  });

  clientProcess.on('close', (code) => {
    console.log(`Client process exited with code ${code}`);
    // Kill server when client exits
    serverProcess.kill();
  });
}, 3000);

// Handle server process events
serverProcess.on('error', (error) => {
  console.error('Server process error:', error);
});

serverProcess.on('close', (code) => {
  console.log(`Server process exited with code ${code}`);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('Shutting down...');
  serverProcess.kill();
  process.exit();
});

console.log('✨ Swickr demo starting...');
console.log('🌐 Once started, open http://localhost:3000/reactions-demo in your browser');
