const axios = require('axios');
const util = require('util');

// API base URL
const API_URL = 'http://localhost:3001/api';

// Test user credentials
const testUser = {
  username: 'contacttestuser',
  email: 'contacttest@example.com',
  password: 'password123',
  fullName: 'Contact Test User'
};

// Test contact user
const testContact = {
  username: 'contactuser',
  email: 'contact@example.com',
  password: 'password123',
  fullName: 'Contact User'
};

// Main function
async function testContactsWithRegistration() {
  try {
    console.log('=== Starting Contacts API Test with Registration ===');
    
    // Step 1: Register test users
    console.log('\n1. Registering test users...');
    
    let testUserId, testContactId;
    
    try {
      // Register main test user
      const registerResponse = await axios.post(`${API_URL}/auth/register`, testUser);
      
      console.log(`Main user registered with status: ${registerResponse.status}`);
      testUserId = registerResponse.data.user.id;
      console.log(`Test user ID: ${testUserId}`);
      
      // Register contact user
      const contactRegisterResponse = await axios.post(`${API_URL}/auth/register`, testContact);
      
      console.log(`Contact user registered with status: ${contactRegisterResponse.status}`);
      testContactId = contactRegisterResponse.data.user.id;
      console.log(`Test contact ID: ${testContactId}`);
    } catch (error) {
      // If registration fails due to user already existing, that's okay
      if (error.response && error.response.status === 409) {
        console.log('Users already exist, proceeding with login');
      } else {
        throw error;
      }
    }
    
    // Step 2: Login with test user
    console.log('\n2. Logging in with test user...');
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      username: testUser.username,
      password: testUser.password
    });
    
    console.log('Login successful');
    
    // Extract user ID and token
    testUserId = loginResponse.data.user.id;
    const authToken = loginResponse.data.tokens?.accessToken || loginResponse.data.token;
    
    console.log(`User ID: ${testUserId}`);
    console.log(`Auth token (first 20 chars): ${authToken.substring(0, 20)}...`);
    
    // Step 3: Get contact user ID if we don't have it yet
    if (!testContactId) {
      console.log('\n3. Getting contact user ID...');
      
      try {
        const searchResponse = await axios({
          method: 'get',
          url: `${API_URL}/contacts/search?query=${testContact.username}`,
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
        
        if (searchResponse.data && searchResponse.data.length > 0) {
          testContactId = searchResponse.data[0].id;
          console.log(`Found contact user ID: ${testContactId}`);
        } else {
          console.error('Contact user not found in search results');
          return;
        }
      } catch (error) {
        console.error('Error searching for contact user:', error.message);
        
        if (error.response) {
          console.error(`Response status: ${error.response.status}`);
          console.error(`Response data: ${util.inspect(error.response.data, { depth: null })}`);
        }
        return;
      }
    }
    
    // Step 4: Try to add a contact with the contact user ID
    console.log('\n4. Adding contact with contact user ID...');
    
    try {
      const response = await axios({
        method: 'post',
        url: `${API_URL}/contacts`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        data: { contactId: testContactId }
      });
      
      console.log(`Response status: ${response.status}`);
      console.log(`Response data: ${util.inspect(response.data, { depth: null })}`);
    } catch (error) {
      console.error(`Error: ${error.message}`);
      
      if (error.response) {
        console.error(`Response status: ${error.response.status}`);
        console.error(`Response data: ${util.inspect(error.response.data, { depth: null })}`);
      }
    }
    
    // Step 5: Try to add a contact with a username
    console.log('\n5. Adding contact with username...');
    
    try {
      const response = await axios({
        method: 'post',
        url: `${API_URL}/contacts`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        data: { username: testContact.username }
      });
      
      console.log(`Response status: ${response.status}`);
      console.log(`Response data: ${util.inspect(response.data, { depth: null })}`);
    } catch (error) {
      console.error(`Error: ${error.message}`);
      
      if (error.response) {
        console.error(`Response status: ${error.response.status}`);
        console.error(`Response data: ${util.inspect(error.response.data, { depth: null })}`);
      }
    }
    
    console.log('\n=== Contacts API Test Complete ===');
  } catch (error) {
    console.error(`Test failed: ${error.message}`);
    
    if (error.response) {
      console.error(`Response status: ${error.response.status}`);
      console.error(`Response data: ${util.inspect(error.response.data, { depth: null })}`);
    }
  }
}

// Run the test
testContactsWithRegistration();
