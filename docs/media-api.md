# Swickr Media API Documentation

This document provides detailed information about the Media API in Swickr, including endpoints, request/response formats, and implementation details.

## Table of Contents

1. [Overview](#overview)
2. [API Endpoints](#api-endpoints)
3. [Media Models](#media-models)
4. [Client Implementation](#client-implementation)
5. [Server Implementation](#server-implementation)
6. [Error Handling](#error-handling)
7. [Security Considerations](#security-considerations)
8. [Performance Optimization](#performance-optimization)

## Overview

The Swickr Media API enables users to upload, retrieve, and manage media files within conversations. It supports various media types including images, videos, audio files, and documents, with features such as progress tracking, metadata extraction, and access control.

### Key Features

- Single and batch file uploads
- Real-time progress tracking
- Automatic metadata extraction
- Preview and thumbnail generation
- Comprehensive error handling
- Access control based on conversation membership

## API Endpoints

### Media Upload

#### Single File Upload

```
POST /api/media/upload
```

**Request:**
- Content-Type: `multipart/form-data`
- Authentication: JWT token in Authorization header
- Form Fields:
  - `file`: The media file to upload
  - `conversationId`: ID of the conversation

**Response:**
```json
{
  "success": true,
  "message": "Media uploaded successfully",
  "media": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "userId": "user123",
    "conversationId": "conv456",
    "mediaType": "image",
    "filename": "f8e7d6c5-b4a3-9876-5432-1fedcba98765.jpg",
    "originalFilename": "vacation.jpg",
    "mimeType": "image/jpeg",
    "size": 1024000,
    "url": "/api/media/123e4567-e89b-12d3-a456-426614174000",
    "thumbnailUrl": "/api/media/thumbnail/123e4567-e89b-12d3-a456-426614174000",
    "metadata": {
      "width": 1920,
      "height": 1080,
      "aspectRatio": 1.778
    },
    "createdAt": "2025-03-05T12:00:00Z",
    "updatedAt": "2025-03-05T12:00:00Z"
  }
}
```

#### Batch File Upload

```
POST /api/media/upload/batch
```

**Request:**
- Content-Type: `multipart/form-data`
- Authentication: JWT token in Authorization header
- Form Fields:
  - `files`: Array of media files to upload (up to 10 files)
  - `conversationId`: ID of the conversation
  - `dimensions`: (Optional) JSON string with image dimensions
  - `durations`: (Optional) JSON string with video/audio durations

**Response (All Success):**
```json
{
  "success": true,
  "message": "All media uploaded successfully",
  "media": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "userId": "user123",
      "mediaType": "image",
      "filename": "f8e7d6c5-b4a3-9876-5432-1fedcba98765.jpg",
      "originalFilename": "vacation.jpg",
      "mimeType": "image/jpeg",
      "size": 1024000,
      "url": "/api/media/123e4567-e89b-12d3-a456-426614174000",
      "thumbnailUrl": "/api/media/thumbnail/123e4567-e89b-12d3-a456-426614174000",
      "metadata": {
        "width": 1920,
        "height": 1080,
        "aspectRatio": 1.778
      },
      "createdAt": "2025-03-05T12:00:00Z"
    },
    // Additional media items...
  ],
  "total": 3
}
```

**Response (Partial Success - HTTP 207):**
```json
{
  "success": true,
  "message": "Some uploads completed with errors",
  "media": [
    // Successfully uploaded media items
  ],
  "errors": [
    {
      "filename": "toolarge.mp4",
      "error": "File exceeds maximum size limit of 100MB"
    }
  ],
  "total": 5,
  "successful": 4,
  "failed": 1
}
```

### Media Retrieval

#### Get Media by ID

```
GET /api/media/:id
```

**Request:**
- Authentication: JWT token in Authorization header
- URL Parameters:
  - `id`: Media ID

**Response:**
- Content-Type: Based on the media type
- The media file content

#### Get Media Thumbnail

```
GET /api/media/thumbnail/:id
```

**Request:**
- Authentication: JWT token in Authorization header
- URL Parameters:
  - `id`: Media ID

**Response:**
- Content-Type: Based on the thumbnail type (usually image/jpeg or image/png)
- The thumbnail image content

#### Get Media for Conversation

```
GET /api/media/conversation/:conversationId
```

**Request:**
- Authentication: JWT token in Authorization header
- URL Parameters:
  - `conversationId`: Conversation ID

**Response:**
```json
{
  "success": true,
  "media": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "userId": "user123",
      "mediaType": "image",
      "filename": "f8e7d6c5-b4a3-9876-5432-1fedcba98765.jpg",
      "originalFilename": "vacation.jpg",
      "mimeType": "image/jpeg",
      "size": 1024000,
      "url": "/api/media/123e4567-e89b-12d3-a456-426614174000",
      "thumbnailUrl": "/api/media/thumbnail/123e4567-e89b-12d3-a456-426614174000",
      "metadata": {
        "width": 1920,
        "height": 1080,
        "aspectRatio": 1.778
      },
      "createdAt": "2025-03-05T12:00:00Z"
    },
    // Additional media items...
  ]
}
```

### Media Deletion

```
DELETE /api/media/:id
```

**Request:**
- Authentication: JWT token in Authorization header
- URL Parameters:
  - `id`: Media ID

**Response:**
```json
{
  "success": true,
  "message": "Media deleted successfully"
}
```

## Media Models

### Media Schema

```javascript
{
  id: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  conversationId: {
    type: String,
    required: true,
    index: true
  },
  mediaType: {
    type: String,
    enum: ['image', 'video', 'audio', 'document'],
    required: true
  },
  filename: {
    type: String,
    required: true
  },
  originalFilename: {
    type: String,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  thumbnailPath: {
    type: String
  },
  metadata: {
    type: Object,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}
```

## Client Implementation

### Media Service

The client-side `mediaService` provides methods for interacting with the Media API:

#### Upload Media

```javascript
/**
 * Upload a media file
 * 
 * @param {File} file - The file to upload
 * @param {string} conversationId - ID of the conversation
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>} - Uploaded media object
 */
const uploadMedia = async (file, conversationId, onProgress) => {
  // Implementation details...
}
```

#### Upload Media Batch

```javascript
/**
 * Upload multiple media files in a batch
 * 
 * @param {Array} files - Array of files to upload
 * @param {string} conversationId - ID of the conversation
 * @param {Function} onProgress - Progress callback for overall progress
 * @param {Function} onFileProgress - Progress callback for individual file progress
 * @param {Function} onFileComplete - Callback when a single file is complete
 * @returns {Promise<Array>} - Array of uploaded media objects
 */
const uploadMediaBatch = async (files, conversationId, onProgress, onFileProgress, onFileComplete) => {
  // Implementation details...
}
```

#### Validate File

```javascript
/**
 * Validate a file before upload
 * 
 * @param {File} file - The file to validate
 * @returns {Object} - Validation result {valid: boolean, error: string}
 */
const validateFile = (file) => {
  // Implementation details...
}
```

#### Generate Preview

```javascript
/**
 * Generate a preview URL for a file
 * 
 * @param {File} file - The file to generate preview for
 * @returns {Promise<string>} - Preview URL
 */
const generatePreview = async (file) => {
  // Implementation details...
}
```

### MediaUploader Component

The `MediaUploader` component provides a user interface for uploading media files:

```jsx
/**
 * MediaUploader Component
 * 
 * @param {Object} props - Component props
 * @param {Function} props.onMediaSelected - Callback when media is selected
 * @param {Function} props.onMediaUploaded - Callback when media is uploaded
 * @param {string} props.conversationId - ID of the conversation
 * @param {boolean} props.disabled - Whether the uploader is disabled
 * @param {boolean} props.allowMultiple - Whether to allow multiple file uploads
 * @returns {JSX.Element} - MediaUploader component
 */
const MediaUploader = ({ 
  onMediaSelected, 
  onMediaUploaded, 
  conversationId, 
  disabled, 
  allowMultiple = false 
}) => {
  // Implementation details...
}
```

## Server Implementation

### Controller Functions

#### Upload Media

```javascript
/**
 * Upload a media file
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const uploadMedia = async (req, res) => {
  // Implementation details...
}
```

#### Upload Media Batch

```javascript
/**
 * Upload multiple media files
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const uploadMediaBatch = async (req, res) => {
  // Implementation details...
}
```

### File Storage Structure

Media files are stored in a structured directory system:

```
uploads/
├── image/
│   └── user123/
│       ├── f8e7d6c5-b4a3-9876-5432-1fedcba98765.jpg
│       └── ...
├── video/
│   └── user123/
│       ├── a1b2c3d4-e5f6-7890-abcd-ef1234567890.mp4
│       └── ...
├── audio/
│   └── ...
├── document/
│   └── ...
└── thumbnails/
    └── user123/
        ├── thumb_f8e7d6c5-b4a3-9876-5432-1fedcba98765.jpg
        └── ...
```

## Error Handling

### Common Error Codes

| HTTP Status | Error Code | Description |
|-------------|------------|-------------|
| 400 | INVALID_REQUEST | Missing required parameters |
| 400 | INVALID_FILE_TYPE | Unsupported file type |
| 400 | NO_FILE_UPLOADED | No file was provided in the request |
| 401 | UNAUTHORIZED | Authentication required |
| 403 | ACCESS_DENIED | User does not have access to the conversation |
| 404 | MEDIA_NOT_FOUND | Media file not found |
| 413 | FILE_TOO_LARGE | File exceeds maximum size limit |
| 500 | SERVER_ERROR | Internal server error |
| 507 | INSUFFICIENT_STORAGE | Not enough storage space available |

### Error Response Format

```json
{
  "success": false,
  "error": "Error message",
  "details": {
    // Additional error details if available
  }
}
```

## Security Considerations

### Access Control

- Media access is restricted to conversation participants
- Files are stored with unique, non-guessable filenames
- Authentication is required for all media operations
- User IDs are included in file paths to prevent unauthorized access

### File Validation

- File types are validated using both extension and MIME type
- File size limits are enforced (100MB maximum)
- Malicious file detection (future enhancement)

## Performance Optimization

### Upload Optimization

- Batch uploads to reduce network requests
- Progress tracking for better user experience
- Client-side validation to prevent unnecessary uploads
- Temporary file storage during upload process

### Retrieval Optimization

- Thumbnail generation for faster previews
- Caching of frequently accessed media (future enhancement)
- Compression of large files (future enhancement)
- Content delivery network integration (future enhancement)
