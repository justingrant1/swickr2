/**
 * Media Sharing Integration Test
 * 
 * This test script validates the end-to-end functionality of media sharing in Swickr.
 * It tests uploading, sending, and retrieving media messages of various types.
 */

const request = require('supertest');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const app = require('../app');
const { pool } = require('../config/database');
const { generateToken } = require('../utils/auth');

// Test users
const testUser1 = {
  id: uuidv4(),
  username: 'mediatest1',
  email: 'mediatest1@example.com',
  password: 'Password123!'
};

const testUser2 = {
  id: uuidv4(),
  username: 'mediatest2',
  email: 'mediatest2@example.com',
  password: 'Password123!'
};

// Test conversation
let conversationId;
let accessToken1;
let accessToken2;

// Test media files
const testImagePath = path.join(__dirname, 'fixtures', 'test-image.jpg');
const testDocumentPath = path.join(__dirname, 'fixtures', 'test-document.pdf');

// Ensure test fixtures directory exists
const fixturesDir = path.join(__dirname, 'fixtures');
if (!fs.existsSync(fixturesDir)) {
  fs.mkdirSync(fixturesDir, { recursive: true });
}

// Create test image if it doesn't exist
if (!fs.existsSync(testImagePath)) {
  // Create a simple 100x100 pixel image
  const canvas = require('canvas');
  const { createCanvas } = canvas;
  const canvas = createCanvas(100, 100);
  const ctx = canvas.getContext('2d');
  
  // Draw a purple rectangle (Swickr brand color)
  ctx.fillStyle = '#6200ee';
  ctx.fillRect(0, 0, 100, 100);
  
  // Add some text
  ctx.fillStyle = 'white';
  ctx.font = '14px Arial';
  ctx.fillText('Swickr Test', 10, 50);
  
  // Save to file
  const buffer = canvas.toBuffer('image/jpeg');
  fs.writeFileSync(testImagePath, buffer);
}

// Create test document if it doesn't exist
if (!fs.existsSync(testDocumentPath)) {
  // Create a simple PDF document
  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument();
  doc.pipe(fs.createWriteStream(testDocumentPath));
  
  doc.fontSize(25).text('Swickr Test Document', 100, 100);
  doc.fontSize(12).text('This is a test document for media sharing functionality.', 100, 150);
  doc.end();
}

describe('Media Sharing Functionality', () => {
  // Setup: Create test users and conversation
  beforeAll(async () => {
    // Register test users
    await request(app)
      .post('/api/auth/register')
      .send(testUser1);
      
    await request(app)
      .post('/api/auth/register')
      .send(testUser2);
    
    // Login and get tokens
    const loginResponse1 = await request(app)
      .post('/api/auth/login')
      .send({
        username: testUser1.username,
        password: testUser1.password
      });
    
    accessToken1 = loginResponse1.body.accessToken;
    
    const loginResponse2 = await request(app)
      .post('/api/auth/login')
      .send({
        username: testUser2.username,
        password: testUser2.password
      });
    
    accessToken2 = loginResponse2.body.accessToken;
    
    // Add users as contacts
    await request(app)
      .post('/api/contacts')
      .set('Authorization', `Bearer ${accessToken1}`)
      .send({ username: testUser2.username });
    
    // Create a conversation
    const conversationResponse = await request(app)
      .post('/api/conversations')
      .set('Authorization', `Bearer ${accessToken1}`)
      .send({
        participants: [testUser2.id],
        isGroup: false
      });
    
    conversationId = conversationResponse.body.id;
  });
  
  // Cleanup: Remove test users and data
  afterAll(async () => {
    // Clean up database
    if (pool) {
      const client = await pool.connect();
      try {
        // Delete test messages
        await client.query('DELETE FROM messages WHERE conversation_id = $1', [conversationId]);
        
        // Delete test conversation participants
        await client.query('DELETE FROM conversation_participants WHERE conversation_id = $1', [conversationId]);
        
        // Delete test conversation
        await client.query('DELETE FROM conversations WHERE id = $1', [conversationId]);
        
        // Delete test contacts
        await client.query('DELETE FROM contacts WHERE user_id = $1 OR contact_id = $1', [testUser1.id]);
        await client.query('DELETE FROM contacts WHERE user_id = $1 OR contact_id = $1', [testUser2.id]);
        
        // Delete test users
        await client.query('DELETE FROM users WHERE id = $1', [testUser1.id]);
        await client.query('DELETE FROM users WHERE id = $1', [testUser2.id]);
      } finally {
        client.release();
      }
    }
  });
  
  describe('Media Upload and Retrieval', () => {
    let imageMediaId;
    let documentMediaId;
    
    test('Should upload an image to a conversation', async () => {
      const response = await request(app)
        .post('/api/media/upload')
        .set('Authorization', `Bearer ${accessToken1}`)
        .field('conversationId', conversationId)
        .field('content', 'Test image message')
        .field('mediaType', 'image')
        .attach('file', testImagePath);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('mediaId');
      expect(response.body.data).toHaveProperty('mediaUrl');
      expect(response.body.data).toHaveProperty('messageId');
      
      imageMediaId = response.body.data.mediaId;
    });
    
    test('Should upload a document to a conversation', async () => {
      const response = await request(app)
        .post('/api/media/upload')
        .set('Authorization', `Bearer ${accessToken1}`)
        .field('conversationId', conversationId)
        .field('content', 'Test document message')
        .field('mediaType', 'document')
        .attach('file', testDocumentPath);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('mediaId');
      expect(response.body.data).toHaveProperty('mediaUrl');
      expect(response.body.data).toHaveProperty('messageId');
      
      documentMediaId = response.body.data.mediaId;
    });
    
    test('Should retrieve messages with media attachments', async () => {
      const response = await request(app)
        .get(`/api/messages/${conversationId}`)
        .set('Authorization', `Bearer ${accessToken1}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      // Check for image message
      const imageMessage = response.body.data.find(msg => 
        msg.mediaType === 'image' && msg.content === 'Test image message'
      );
      expect(imageMessage).toBeDefined();
      expect(imageMessage.mediaId).toBe(imageMediaId);
      
      // Check for document message
      const documentMessage = response.body.data.find(msg => 
        msg.mediaType === 'document' && msg.content === 'Test document message'
      );
      expect(documentMessage).toBeDefined();
      expect(documentMessage.mediaId).toBe(documentMediaId);
    });
    
    test('Should retrieve media file', async () => {
      // Get the image file
      const imageResponse = await request(app)
        .get(`/api/media/${testUser1.id}/image/${imageMediaId}`)
        .set('Authorization', `Bearer ${accessToken1}`);
      
      expect(imageResponse.status).toBe(200);
      expect(imageResponse.headers['content-type']).toContain('image/');
      
      // Get the document file
      const documentResponse = await request(app)
        .get(`/api/media/${testUser1.id}/document/${documentMediaId}`)
        .set('Authorization', `Bearer ${accessToken1}`);
      
      expect(documentResponse.status).toBe(200);
      expect(documentResponse.headers['content-type']).toContain('application/pdf');
    });
    
    test('Should deny access to media for unauthorized users', async () => {
      // Create an unauthorized token
      const unauthorizedToken = generateToken({ id: uuidv4(), username: 'unauthorized' });
      
      // Try to access image file with unauthorized token
      const response = await request(app)
        .get(`/api/media/${testUser1.id}/image/${imageMediaId}`)
        .set('Authorization', `Bearer ${unauthorizedToken}`);
      
      expect(response.status).toBe(403);
    });
  });
  
  describe('Media Message Functionality', () => {
    test('Should send and receive media messages in real-time', async () => {
      // This would typically be tested with WebSocket connections
      // For simplicity, we'll just verify the API endpoints work correctly
      
      // Send a message with media reference
      const messageResponse = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${accessToken1}`)
        .send({
          conversationId,
          content: 'Check out this media file',
          mediaId: 'test-media-id',
          mediaType: 'image',
          mediaUrl: '/api/media/test-user/image/test-media-id'
        });
      
      expect(messageResponse.status).toBe(200);
      expect(messageResponse.body.success).toBe(true);
      
      // Verify the message was saved
      const messagesResponse = await request(app)
        .get(`/api/messages/${conversationId}`)
        .set('Authorization', `Bearer ${accessToken2}`);
      
      const mediaMessage = messagesResponse.body.data.find(msg => 
        msg.content === 'Check out this media file' && msg.mediaType === 'image'
      );
      
      expect(mediaMessage).toBeDefined();
      expect(mediaMessage.mediaId).toBe('test-media-id');
    });
  });
  
  describe('Media Validation', () => {
    test('Should reject oversized files', async () => {
      // Create a temporary large file
      const largeTempFile = path.join(__dirname, 'fixtures', 'large-test-file.bin');
      
      // Create a file larger than the limit (e.g., 51MB if limit is 50MB)
      const maxFileSize = 50 * 1024 * 1024; // 50MB
      const buffer = Buffer.alloc(maxFileSize + 1024 * 1024); // 51MB
      
      try {
        fs.writeFileSync(largeTempFile, buffer);
        
        const response = await request(app)
          .post('/api/media/upload')
          .set('Authorization', `Bearer ${accessToken1}`)
          .field('conversationId', conversationId)
          .field('content', 'Large file test')
          .attach('file', largeTempFile);
        
        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('exceeds the size limit');
      } finally {
        // Clean up
        if (fs.existsSync(largeTempFile)) {
          fs.unlinkSync(largeTempFile);
        }
      }
    });
    
    test('Should reject invalid file types', async () => {
      // Create a temporary file with invalid extension
      const invalidFile = path.join(__dirname, 'fixtures', 'invalid-file.xyz');
      fs.writeFileSync(invalidFile, 'Invalid file content');
      
      try {
        const response = await request(app)
          .post('/api/media/upload')
          .set('Authorization', `Bearer ${accessToken1}`)
          .field('conversationId', conversationId)
          .field('content', 'Invalid file test')
          .attach('file', invalidFile);
        
        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('file type is not supported');
      } finally {
        // Clean up
        if (fs.existsSync(invalidFile)) {
          fs.unlinkSync(invalidFile);
        }
      }
    });
  });
});
