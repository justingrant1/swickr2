const axios = require('axios');
const fs = require('fs');
const path = require('path');

// API base URL
const API_URL = 'http://localhost:3001/api';

// Test user credentials
const testUser = {
  username: 'apitestuser',
  password: 'password123'
};

// Helper function to log to file
function logToFile(message, data) {
  const logDir = path.join(__dirname, '..', '..', 'logs');
  
  // Create logs directory if it doesn't exist
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  const logFile = path.join(logDir, 'contacts-api-test.log');
  const timestamp = new Date().toISOString();
  
  let logMessage = `[${timestamp}] ${message}\n`;
  
  if (data) {
    logMessage += JSON.stringify(data, null, 2) + '\n';
  }
  
  fs.appendFileSync(logFile, logMessage + '\n');
  console.log(message);
}

// Main function
async function testContactsApi() {
  try {
    logToFile('=== Starting Contacts API Test ===');
    
    // Step 1: Login to get auth token
    logToFile('1. Logging in...');
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      username: testUser.username,
      password: testUser.password
    });
    
    logToFile('Login successful', { 
      status: loginResponse.status,
      user: loginResponse.data.user
    });
    
    // Extract user ID and token
    const userId = loginResponse.data.user.id;
    const authToken = loginResponse.data.tokens?.accessToken || loginResponse.data.token;
    
    logToFile('User ID and token', { 
      userId,
      tokenPreview: authToken.substring(0, 20) + '...'
    });
    
    // Step 2: Get current contacts
    logToFile('2. Getting current contacts...');
    
    try {
      const contactsResponse = await axios({
        method: 'get',
        url: `${API_URL}/contacts`,
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      logToFile('Current contacts', {
        status: contactsResponse.status,
        count: contactsResponse.data.length,
        contacts: contactsResponse.data
      });
    } catch (error) {
      logToFile('Error getting contacts', {
        message: error.message,
        response: error.response ? {
          status: error.response.status,
          data: error.response.data
        } : 'No response'
      });
    }
    
    // Step 3: Try to add a contact with a UUID
    logToFile('3. Adding contact with UUID...');
    
    // Generate a test UUID
    const testContactId = '00000000-0000-0000-0000-000000000001';
    
    try {
      const addContactResponse = await axios({
        method: 'post',
        url: `${API_URL}/contacts`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        data: { contactId: testContactId }
      });
      
      logToFile('Add contact response', {
        status: addContactResponse.status,
        data: addContactResponse.data
      });
    } catch (error) {
      logToFile('Error adding contact', {
        message: error.message,
        response: error.response ? {
          status: error.response.status,
          data: error.response.data
        } : 'No response',
        request: {
          url: `${API_URL}/contacts`,
          method: 'post',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken.substring(0, 20)}...`
          },
          data: { contactId: testContactId }
        }
      });
    }
    
    // Step 4: Try to add a contact with a username
    logToFile('4. Adding contact with username...');
    
    try {
      const addContactByUsernameResponse = await axios({
        method: 'post',
        url: `${API_URL}/contacts`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        data: { username: 'testuser' }
      });
      
      logToFile('Add contact by username response', {
        status: addContactByUsernameResponse.status,
        data: addContactByUsernameResponse.data
      });
    } catch (error) {
      logToFile('Error adding contact by username', {
        message: error.message,
        response: error.response ? {
          status: error.response.status,
          data: error.response.data
        } : 'No response',
        request: {
          url: `${API_URL}/contacts`,
          method: 'post',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken.substring(0, 20)}...`
          },
          data: { username: 'testuser' }
        }
      });
    }
    
    logToFile('=== Contacts API Test Complete ===');
    logToFile('Check the logs directory for detailed logs');
  } catch (error) {
    logToFile('Test failed', {
      message: error.message,
      stack: error.stack
    });
  }
}

// Run the test
testContactsApi();
