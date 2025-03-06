const request = require('supertest');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const app = require('../src/app');
const { createUser, createConversation, addUserToConversation } = require('./testHelpers');
const Media = require('../src/models/Media');

describe('Media API', () => {
  let testUser;
  let testUser2;
  let testToken;
  let testToken2;
  let testConversation;
  let testImagePath;
  let testVideoPath;
  let testDocPath;
  
  beforeAll(async () => {
    // Create test users
    testUser = await createUser('mediatest@example.com', 'password123', 'Media Tester');
    testUser2 = await createUser('mediatest2@example.com', 'password123', 'Media Tester 2');
    
    // Get auth tokens
    const authResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: 'mediatest@example.com', password: 'password123' });
    testToken = authResponse.body.token;
    
    const authResponse2 = await request(app)
      .post('/api/auth/login')
      .send({ email: 'mediatest2@example.com', password: 'password123' });
    testToken2 = authResponse2.body.token;
    
    // Create test conversation
    testConversation = await createConversation(testUser.id, 'Media Test Conversation');
    await addUserToConversation(testConversation.id, testUser2.id);
    
    // Create test files
    testImagePath = path.join(__dirname, 'fixtures', 'test-image.jpg');
    testVideoPath = path.join(__dirname, 'fixtures', 'test-video.mp4');
    testDocPath = path.join(__dirname, 'fixtures', 'test-document.pdf');
    
    // Ensure test fixtures directory exists
    if (!fs.existsSync(path.join(__dirname, 'fixtures'))) {
      fs.mkdirSync(path.join(__dirname, 'fixtures'));
    }
    
    // Create a simple test image if it doesn't exist
    if (!fs.existsSync(testImagePath)) {
      // This creates a very small valid JPG file
      const minimalJpg = Buffer.from([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48, 
        0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x10, 
        0x00, 0x10, 0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01, 0xff, 0xc4, 0x00, 0x14, 
        0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 
        0x00, 0x03, 0xff, 0xc4, 0x00, 0x14, 0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0xda, 0x00, 0x0c, 0x03, 0x01, 0x00, 0x02, 
        0x11, 0x03, 0x11, 0x00, 0x3f, 0x00, 0xbf, 0x80, 0x01, 0xff, 0xd9
      ]);
      fs.writeFileSync(testImagePath, minimalJpg);
    }
    
    // Create a simple test video if it doesn't exist
    if (!fs.existsSync(testVideoPath)) {
      // Create a minimal MP4 file
      const minimalMp4 = Buffer.from([
        0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32, 0x00, 0x00, 0x00, 0x00,
        0x6d, 0x70, 0x34, 0x32, 0x69, 0x73, 0x6f, 0x6d, 0x00, 0x00, 0x00, 0x08, 0x66, 0x72, 0x65, 0x65
      ]);
      fs.writeFileSync(testVideoPath, minimalMp4);
    }
    
    // Create a simple test PDF if it doesn't exist
    if (!fs.existsSync(testDocPath)) {
      // Create a minimal PDF file
      const minimalPdf = Buffer.from(
        '%PDF-1.0\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 3 3]>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000010 00000 n\n0000000053 00000 n\n0000000102 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n149\n%%EOF\n'
      );
      fs.writeFileSync(testDocPath, minimalPdf);
    }
  });
  
  afterAll(async () => {
    // Clean up test files
    try {
      if (fs.existsSync(testImagePath)) fs.unlinkSync(testImagePath);
      if (fs.existsSync(testVideoPath)) fs.unlinkSync(testVideoPath);
      if (fs.existsSync(testDocPath)) fs.unlinkSync(testDocPath);
      
      // Clean up uploaded files
      const mediaItems = await Media.find({ conversationId: testConversation.id });
      for (const media of mediaItems) {
        const filePath = path.join(process.env.UPLOAD_DIR, media.mediaType, media.userId, media.filename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        
        if (media.thumbnailPath && fs.existsSync(media.thumbnailPath)) {
          fs.unlinkSync(media.thumbnailPath);
        }
      }
      
      // Clean up database
      await Media.deleteMany({ conversationId: testConversation.id });
    } catch (error) {
      console.error('Error cleaning up test files:', error);
    }
  });
  
  describe('Single File Upload', () => {
    test('should upload an image file successfully', async () => {
      const response = await request(app)
        .post('/api/media/upload')
        .set('Authorization', `Bearer ${testToken}`)
        .field('conversationId', testConversation.id)
        .attach('file', testImagePath);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.media).toBeDefined();
      expect(response.body.media.mediaType).toBe('image');
      expect(response.body.media.conversationId).toBe(testConversation.id);
      expect(response.body.media.userId).toBe(testUser.id);
      expect(response.body.media.metadata).toBeDefined();
    });
    
    test('should upload a video file successfully', async () => {
      const response = await request(app)
        .post('/api/media/upload')
        .set('Authorization', `Bearer ${testToken}`)
        .field('conversationId', testConversation.id)
        .attach('file', testVideoPath);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.media).toBeDefined();
      expect(response.body.media.mediaType).toBe('video');
    });
    
    test('should upload a document file successfully', async () => {
      const response = await request(app)
        .post('/api/media/upload')
        .set('Authorization', `Bearer ${testToken}`)
        .field('conversationId', testConversation.id)
        .attach('file', testDocPath);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.media).toBeDefined();
      expect(response.body.media.mediaType).toBe('document');
    });
    
    test('should fail when no file is provided', async () => {
      const response = await request(app)
        .post('/api/media/upload')
        .set('Authorization', `Bearer ${testToken}`)
        .field('conversationId', testConversation.id);
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
    
    test('should fail when conversation ID is missing', async () => {
      const response = await request(app)
        .post('/api/media/upload')
        .set('Authorization', `Bearer ${testToken}`)
        .attach('file', testImagePath);
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
    
    test('should fail when user is not in conversation', async () => {
      // Create a new conversation without testUser2
      const privateConversation = await createConversation(testUser.id, 'Private Conversation');
      
      const response = await request(app)
        .post('/api/media/upload')
        .set('Authorization', `Bearer ${testToken2}`)
        .field('conversationId', privateConversation.id)
        .attach('file', testImagePath);
      
      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('Batch File Upload', () => {
    test('should upload multiple files successfully', async () => {
      const response = await request(app)
        .post('/api/media/upload/batch')
        .set('Authorization', `Bearer ${testToken}`)
        .field('conversationId', testConversation.id)
        .attach('files', testImagePath)
        .attach('files', testVideoPath)
        .attach('files', testDocPath);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.media).toBeDefined();
      expect(Array.isArray(response.body.media)).toBe(true);
      expect(response.body.media.length).toBe(3);
      expect(response.body.total).toBe(3);
      
      // Check that we have one of each type
      const mediaTypes = response.body.media.map(m => m.mediaType);
      expect(mediaTypes).toContain('image');
      expect(mediaTypes).toContain('video');
      expect(mediaTypes).toContain('document');
    });
    
    test('should handle partial success with some invalid files', async () => {
      // Create an invalid file (empty file)
      const invalidFilePath = path.join(__dirname, 'fixtures', 'invalid-file.xyz');
      fs.writeFileSync(invalidFilePath, '');
      
      try {
        const response = await request(app)
          .post('/api/media/upload/batch')
          .set('Authorization', `Bearer ${testToken}`)
          .field('conversationId', testConversation.id)
          .attach('files', testImagePath)
          .attach('files', invalidFilePath);
        
        expect(response.status).toBe(207); // Multi-Status
        expect(response.body.success).toBe(true);
        expect(response.body.media).toBeDefined();
        expect(Array.isArray(response.body.media)).toBe(true);
        expect(response.body.media.length).toBe(1);
        expect(response.body.errors).toBeDefined();
        expect(Array.isArray(response.body.errors)).toBe(true);
        expect(response.body.errors.length).toBe(1);
        expect(response.body.total).toBe(2);
        expect(response.body.successful).toBe(1);
        expect(response.body.failed).toBe(1);
      } finally {
        // Clean up
        if (fs.existsSync(invalidFilePath)) fs.unlinkSync(invalidFilePath);
      }
    });
    
    test('should fail when no files are provided', async () => {
      const response = await request(app)
        .post('/api/media/upload/batch')
        .set('Authorization', `Bearer ${testToken}`)
        .field('conversationId', testConversation.id);
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
    
    test('should fail when conversation ID is missing', async () => {
      const response = await request(app)
        .post('/api/media/upload/batch')
        .set('Authorization', `Bearer ${testToken}`)
        .attach('files', testImagePath)
        .attach('files', testVideoPath);
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('Media Retrieval', () => {
    let testMediaId;
    
    beforeAll(async () => {
      // Upload a test image to use for retrieval tests
      const response = await request(app)
        .post('/api/media/upload')
        .set('Authorization', `Bearer ${testToken}`)
        .field('conversationId', testConversation.id)
        .attach('file', testImagePath);
      
      testMediaId = response.body.media.id;
    });
    
    test('should retrieve media by ID', async () => {
      const response = await request(app)
        .get(`/api/media/${testMediaId}`)
        .set('Authorization', `Bearer ${testToken}`);
      
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('image/jpeg');
    });
    
    test('should retrieve thumbnail by ID', async () => {
      const response = await request(app)
        .get(`/api/media/thumbnail/${testMediaId}`)
        .set('Authorization', `Bearer ${testToken}`);
      
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('image');
    });
    
    test('should retrieve media for a conversation', async () => {
      const response = await request(app)
        .get(`/api/media/conversation/${testConversation.id}`)
        .set('Authorization', `Bearer ${testToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.media).toBeDefined();
      expect(Array.isArray(response.body.media)).toBe(true);
      expect(response.body.media.length).toBeGreaterThan(0);
    });
    
    test('should fail when retrieving non-existent media', async () => {
      const fakeId = uuidv4();
      const response = await request(app)
        .get(`/api/media/${fakeId}`)
        .set('Authorization', `Bearer ${testToken}`);
      
      expect(response.status).toBe(404);
    });
    
    test('should fail when user is not in conversation', async () => {
      // Create a new user not in the conversation
      const outsiderUser = await createUser('outsider@example.com', 'password123', 'Outsider');
      const outsiderAuthResponse = await request(app)
        .post('/api/auth/login')
        .send({ email: 'outsider@example.com', password: 'password123' });
      const outsiderToken = outsiderAuthResponse.body.token;
      
      const response = await request(app)
        .get(`/api/media/conversation/${testConversation.id}`)
        .set('Authorization', `Bearer ${outsiderToken}`);
      
      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('Media Deletion', () => {
    let testMediaId;
    
    beforeEach(async () => {
      // Upload a test image to use for deletion test
      const response = await request(app)
        .post('/api/media/upload')
        .set('Authorization', `Bearer ${testToken}`)
        .field('conversationId', testConversation.id)
        .attach('file', testImagePath);
      
      testMediaId = response.body.media.id;
    });
    
    test('should delete media successfully', async () => {
      const response = await request(app)
        .delete(`/api/media/${testMediaId}`)
        .set('Authorization', `Bearer ${testToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      // Verify it's deleted
      const getResponse = await request(app)
        .get(`/api/media/${testMediaId}`)
        .set('Authorization', `Bearer ${testToken}`);
      
      expect(getResponse.status).toBe(404);
    });
    
    test('should fail when deleting non-existent media', async () => {
      const fakeId = uuidv4();
      const response = await request(app)
        .delete(`/api/media/${fakeId}`)
        .set('Authorization', `Bearer ${testToken}`);
      
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
    
    test('should fail when user is not the owner', async () => {
      // Upload media as testUser
      const uploadResponse = await request(app)
        .post('/api/media/upload')
        .set('Authorization', `Bearer ${testToken}`)
        .field('conversationId', testConversation.id)
        .attach('file', testImagePath);
      
      const mediaId = uploadResponse.body.media.id;
      
      // Try to delete as testUser2
      const deleteResponse = await request(app)
        .delete(`/api/media/${mediaId}`)
        .set('Authorization', `Bearer ${testToken2}`);
      
      expect(deleteResponse.status).toBe(403);
      expect(deleteResponse.body.success).toBe(false);
    });
  });
});
