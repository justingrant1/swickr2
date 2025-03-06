/**
 * Media Integration Tests
 * 
 * Tests the end-to-end functionality of media sharing in Swickr
 */

const request = require('supertest');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const app = require('../app');
const { createTestUser, createTestConversation, cleanupTestUsers } = require('./test-utils');

// Test configuration
const TEST_IMAGE_PATH = path.join(__dirname, 'fixtures', 'test-image.jpg');
const TEST_DOCUMENT_PATH = path.join(__dirname, 'fixtures', 'test-document.pdf');
const TEST_AUDIO_PATH = path.join(__dirname, 'fixtures', 'test-audio.mp3');
const TEST_VIDEO_PATH = path.join(__dirname, 'fixtures', 'test-video.mp4');

// Create test fixtures directory if it doesn't exist
const fixturesDir = path.join(__dirname, 'fixtures');
if (!fs.existsSync(fixturesDir)) {
  fs.mkdirSync(fixturesDir, { recursive: true });
}

// Create test files if they don't exist
if (!fs.existsSync(TEST_IMAGE_PATH)) {
  // Create a simple test image (1x1 pixel)
  const imageData = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  fs.writeFileSync(TEST_IMAGE_PATH, imageData);
}

if (!fs.existsSync(TEST_DOCUMENT_PATH)) {
  // Create a simple PDF file
  const pdfData = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 3 3]>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000010 00000 n\n0000000053 00000 n\n0000000102 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n149\n%%EOF\n', 'utf-8');
  fs.writeFileSync(TEST_DOCUMENT_PATH, pdfData);
}

if (!fs.existsSync(TEST_AUDIO_PATH)) {
  // Create a simple MP3 file header
  const mp3Data = Buffer.from('ID3\x03\x00\x00\x00\x00\x00\x00', 'binary');
  fs.writeFileSync(TEST_AUDIO_PATH, mp3Data);
}

if (!fs.existsSync(TEST_VIDEO_PATH)) {
  // Create a simple MP4 file header
  const mp4Data = Buffer.from('\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42mp41\x00\x00\x00\x00', 'binary');
  fs.writeFileSync(TEST_VIDEO_PATH, mp4Data);
}

describe('Media Sharing Integration Tests', () => {
  let testUser1, testUser2;
  let authToken1, authToken2;
  let conversationId;
  let uploadedMediaIds = [];

  // Setup test users and conversation
  beforeAll(async () => {
    // Create test users
    testUser1 = await createTestUser();
    testUser2 = await createTestUser();

    // Login to get auth tokens
    const loginResponse1 = await request(app)
      .post('/api/auth/login')
      .send({
        username: testUser1.username,
        password: testUser1.password
      });
    
    const loginResponse2 = await request(app)
      .post('/api/auth/login')
      .send({
        username: testUser2.username,
        password: testUser2.password
      });
    
    authToken1 = loginResponse1.body.token;
    authToken2 = loginResponse2.body.token;

    // Create a conversation between the two users
    const conversation = await createTestConversation(testUser1.id, testUser2.id);
    conversationId = conversation.id;
  }, 30000);

  // Clean up after tests
  afterAll(async () => {
    // Delete uploaded media files
    for (const mediaId of uploadedMediaIds) {
      try {
        await request(app)
          .delete(`/api/media/${mediaId}`)
          .set('Authorization', `Bearer ${authToken1}`);
      } catch (error) {
        console.error(`Failed to delete media ${mediaId}:`, error);
      }
    }

    // Clean up test users
    await cleanupTestUsers([testUser1.id, testUser2.id]);
  }, 30000);

  describe('Media Upload', () => {
    test('Should upload an image file', async () => {
      const response = await request(app)
        .post('/api/media/upload')
        .set('Authorization', `Bearer ${authToken1}`)
        .attach('file', TEST_IMAGE_PATH);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('mediaId');
      expect(response.body).toHaveProperty('mediaUrl');
      expect(response.body).toHaveProperty('mediaType', 'image');
      
      uploadedMediaIds.push(response.body.mediaId);
    });

    test('Should upload a document file', async () => {
      const response = await request(app)
        .post('/api/media/upload')
        .set('Authorization', `Bearer ${authToken1}`)
        .attach('file', TEST_DOCUMENT_PATH);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('mediaId');
      expect(response.body).toHaveProperty('mediaUrl');
      expect(response.body).toHaveProperty('mediaType', 'document');
      
      uploadedMediaIds.push(response.body.mediaId);
    });

    test('Should upload an audio file', async () => {
      const response = await request(app)
        .post('/api/media/upload')
        .set('Authorization', `Bearer ${authToken1}`)
        .attach('file', TEST_AUDIO_PATH);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('mediaId');
      expect(response.body).toHaveProperty('mediaUrl');
      expect(response.body).toHaveProperty('mediaType', 'audio');
      
      uploadedMediaIds.push(response.body.mediaId);
    });

    test('Should upload a video file', async () => {
      const response = await request(app)
        .post('/api/media/upload')
        .set('Authorization', `Bearer ${authToken1}`)
        .attach('file', TEST_VIDEO_PATH);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('mediaId');
      expect(response.body).toHaveProperty('mediaUrl');
      expect(response.body).toHaveProperty('mediaType', 'video');
      
      uploadedMediaIds.push(response.body.mediaId);
    });

    test('Should reject upload without authentication', async () => {
      const response = await request(app)
        .post('/api/media/upload')
        .attach('file', TEST_IMAGE_PATH);

      expect(response.status).toBe(401);
    });

    test('Should reject upload with invalid file type', async () => {
      // Create a temporary file with invalid extension
      const invalidFilePath = path.join(__dirname, 'fixtures', 'invalid.xyz');
      fs.writeFileSync(invalidFilePath, 'Invalid file content');

      try {
        const response = await request(app)
          .post('/api/media/upload')
          .set('Authorization', `Bearer ${authToken1}`)
          .attach('file', invalidFilePath);

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error');
      } finally {
        // Clean up
        if (fs.existsSync(invalidFilePath)) {
          fs.unlinkSync(invalidFilePath);
        }
      }
    });
  });

  describe('Media Retrieval', () => {
    let mediaId;

    beforeAll(async () => {
      // Upload a test image to use for retrieval tests
      const response = await request(app)
        .post('/api/media/upload')
        .set('Authorization', `Bearer ${authToken1}`)
        .attach('file', TEST_IMAGE_PATH);
      
      mediaId = response.body.mediaId;
      uploadedMediaIds.push(mediaId);
    });

    test('Should retrieve uploaded media file', async () => {
      const response = await request(app)
        .get(`/api/media/${mediaId}`)
        .set('Authorization', `Bearer ${authToken1}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/^image\//);
    });

    test('Should reject retrieval without authentication', async () => {
      const response = await request(app)
        .get(`/api/media/${mediaId}`);

      expect(response.status).toBe(401);
    });

    test('Should reject retrieval of non-existent media', async () => {
      const nonExistentId = uuidv4();
      const response = await request(app)
        .get(`/api/media/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken1}`);

      expect(response.status).toBe(404);
    });
  });

  describe('Media Messages', () => {
    let mediaId;

    beforeAll(async () => {
      // Upload a test image to use for message tests
      const response = await request(app)
        .post('/api/media/upload')
        .set('Authorization', `Bearer ${authToken1}`)
        .attach('file', TEST_IMAGE_PATH);
      
      mediaId = response.body.mediaId;
      uploadedMediaIds.push(mediaId);
    });

    test('Should send a message with media attachment', async () => {
      const response = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          conversationId,
          content: 'Check out this image',
          mediaId,
          mediaCaption: 'Test image caption'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('mediaId', mediaId);
      expect(response.body).toHaveProperty('mediaCaption', 'Test image caption');
    });

    test('Should retrieve messages with media attachments', async () => {
      const response = await request(app)
        .get(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken1}`);

      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
      
      // Find the media message
      const mediaMessage = response.body.find(msg => msg.mediaId === mediaId);
      expect(mediaMessage).toBeDefined();
      expect(mediaMessage).toHaveProperty('mediaUrl');
      expect(mediaMessage).toHaveProperty('mediaCaption', 'Test image caption');
    });

    test('Should allow recipient to view media in message', async () => {
      // First get the message to extract the media URL
      const messagesResponse = await request(app)
        .get(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken2}`);
      
      const mediaMessage = messagesResponse.body.find(msg => msg.mediaId === mediaId);
      expect(mediaMessage).toBeDefined();
      
      // Now try to access the media as the recipient
      const mediaUrl = mediaMessage.mediaUrl.replace('/api', '');
      const response = await request(app)
        .get(mediaUrl)
        .set('Authorization', `Bearer ${authToken2}`);

      expect(response.status).toBe(200);
    });
  });

  describe('Media Deletion', () => {
    let mediaId;

    beforeAll(async () => {
      // Upload a test image to use for deletion tests
      const response = await request(app)
        .post('/api/media/upload')
        .set('Authorization', `Bearer ${authToken1}`)
        .attach('file', TEST_IMAGE_PATH);
      
      mediaId = response.body.mediaId;
    });

    test('Should delete uploaded media', async () => {
      const response = await request(app)
        .delete(`/api/media/${mediaId}`)
        .set('Authorization', `Bearer ${authToken1}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });

    test('Should not be able to retrieve deleted media', async () => {
      const response = await request(app)
        .get(`/api/media/${mediaId}`)
        .set('Authorization', `Bearer ${authToken1}`);

      expect(response.status).toBe(404);
    });

    test('Should not allow unauthorized user to delete media', async () => {
      // Upload a new file
      const uploadResponse = await request(app)
        .post('/api/media/upload')
        .set('Authorization', `Bearer ${authToken1}`)
        .attach('file', TEST_IMAGE_PATH);
      
      const newMediaId = uploadResponse.body.mediaId;
      uploadedMediaIds.push(newMediaId);

      // Try to delete with different user
      const response = await request(app)
        .delete(`/api/media/${newMediaId}`)
        .set('Authorization', `Bearer ${authToken2}`);

      expect(response.status).toBe(403);
    });
  });
});
