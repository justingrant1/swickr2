const axios = require('axios');
const logger = require('../utils/logger');

// API base URL
const API_URL = 'http://localhost:3001/api';

// Create an axios instance with base URL
const api = axios.create({
  baseURL: API_URL,
  timeout: 5000
});

// Test user credentials
const testUser = {
  username: 'apitestuser',
  password: 'password123'
};

// Main function
async function debugContacts() {
  try {
    console.log('=== Starting Contact API Debug ===');
    
    // Step 1: Login to get auth token
    console.log('\n1. Logging in...');
    const loginResponse = await api.post('/auth/login', {
      username: testUser.username,
      password: testUser.password
    });
    
    console.log('Login response status:', loginResponse.status);
    console.log('User data:', JSON.stringify(loginResponse.data.user, null, 2));
    
    // Extract user ID and token
    const userId = loginResponse.data.user.id;
    let authToken;
    
    if (loginResponse.data.tokens && loginResponse.data.tokens.accessToken) {
      authToken = loginResponse.data.tokens.accessToken;
      console.log('Token format: tokens.accessToken');
    } else if (loginResponse.data.token) {
      authToken = loginResponse.data.token;
      console.log('Token format: direct token');
    } else {
      throw new Error('No auth token found in response');
    }
    
    console.log('User ID:', userId);
    console.log('Auth token (first 20 chars):', authToken.substring(0, 20) + '...');
    
    // Set auth header for subsequent requests
    api.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
    
    // Step 2: Get user profile to verify auth works
    console.log('\n2. Getting user profile...');
    const profileResponse = await api.get('/users/profile');
    console.log('Profile response status:', profileResponse.status);
    console.log('Profile data:', JSON.stringify(profileResponse.data, null, 2));
    
    // Step 3: Get current contacts
    console.log('\n3. Getting current contacts...');
    const contactsResponse = await api.get('/contacts');
    console.log('Contacts response status:', contactsResponse.status);
    console.log('Number of contacts:', contactsResponse.data.length);
    
    // Step 4: Search for users to add as contacts
    console.log('\n4. Searching for users...');
    const searchResponse = await api.get('/users/search?query=test');
    console.log('Search response status:', searchResponse.status);
    
    let testContactId;
    if (searchResponse.data && searchResponse.data.length > 0) {
      // Find a user that is not the current user
      const otherUsers = searchResponse.data.filter(user => user.id !== userId);
      if (otherUsers.length > 0) {
        testContactId = otherUsers[0].id;
        console.log('Found test contact:', JSON.stringify(otherUsers[0], null, 2));
      }
    }
    
    // If no users found, create a new test user
    if (!testContactId) {
      console.log('\n5. No other users found, creating a new test user...');
      const registerResponse = await api.post('/auth/register', {
        username: `testuser_${Date.now()}`,
        password: 'password123',
        email: `testuser_${Date.now()}@example.com`,
        fullName: 'Test User'
      });
      
      if (registerResponse.status === 201) {
        testContactId = registerResponse.data.user.id;
        console.log('Created new test user with ID:', testContactId);
      }
    }
    
    // Step 6: Add contact
    if (testContactId) {
      console.log('\n6. Adding contact...');
      console.log('Request payload:', { contactId: testContactId });
      
      try {
        const addContactResponse = await api.post('/contacts', { contactId: testContactId }, {
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        console.log('Add contact response status:', addContactResponse.status);
        console.log('Add contact response data:', JSON.stringify(addContactResponse.data, null, 2));
      } catch (error) {
        console.error('Error adding contact:', error.message);
        
        if (error.response) {
          console.error('Response status:', error.response.status);
          console.error('Response data:', JSON.stringify(error.response.data, null, 2));
          console.error('Request data:', error.config.data);
          
          // Log request headers for debugging
          console.error('Request headers:', JSON.stringify(error.config.headers, null, 2));
          
          // Check if the error is due to the contact already existing
          if (error.response.status === 409) {
            console.log('Contact already exists, which is fine for testing');
          }
        }
      }
      
      // Step 7: Verify contacts after adding
      console.log('\n7. Verifying contacts after adding...');
      const updatedContactsResponse = await api.get('/contacts');
      console.log('Updated contacts response status:', updatedContactsResponse.status);
      console.log('Number of contacts after adding:', updatedContactsResponse.data.length);
      
      // Check if the contact was added
      const contactAdded = updatedContactsResponse.data.some(contact => contact.id === testContactId);
      console.log('Contact was added successfully:', contactAdded);
    } else {
      console.log('No test contact ID found, skipping add contact test');
    }
    
    console.log('\n=== Contact API Debug Complete ===');
  } catch (error) {
    console.error('Debug script failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Run the debug function
debugContacts();
