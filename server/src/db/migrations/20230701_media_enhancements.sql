-- Media Enhancements Migration

-- Create media table if it doesn't exist
CREATE TABLE IF NOT EXISTS media (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  media_type VARCHAR(50) NOT NULL, -- image, video, audio, document
  filename VARCHAR(255) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size BIGINT NOT NULL,
  thumbnail_path VARCHAR(255),
  metadata JSONB,
  marked_for_deletion BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_media_user_id ON media(user_id);

-- Create index on media_type for faster filtering
CREATE INDEX IF NOT EXISTS idx_media_type ON media(media_type);

-- Add media fields to messages table if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'media_id') THEN
    ALTER TABLE messages ADD COLUMN media_id VARCHAR(255);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'media_type') THEN
    ALTER TABLE messages ADD COLUMN media_type VARCHAR(50);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'media_url') THEN
    ALTER TABLE messages ADD COLUMN media_url VARCHAR(255);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'media_caption') THEN
    ALTER TABLE messages ADD COLUMN media_caption TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'media_size') THEN
    ALTER TABLE messages ADD COLUMN media_size BIGINT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'media_mime_type') THEN
    ALTER TABLE messages ADD COLUMN media_mime_type VARCHAR(100);
  END IF;
END $$;

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_messages_media_id' 
    AND table_name = 'messages'
  ) THEN
    ALTER TABLE messages 
    ADD CONSTRAINT fk_messages_media_id 
    FOREIGN KEY (media_id) 
    REFERENCES media(id) 
    ON DELETE SET NULL;
  END IF;
END $$;

-- Add last_message and last_activity columns to conversations table if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'last_message') THEN
    ALTER TABLE conversations ADD COLUMN last_message TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'last_activity') THEN
    ALTER TABLE conversations ADD COLUMN last_activity TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Update conversations table to set last_activity from updated_at if null
UPDATE conversations 
SET last_activity = updated_at 
WHERE last_activity IS NULL;

-- Create directories for media storage
DO $$
DECLARE
  upload_dir TEXT;
BEGIN
  -- Get upload directory from environment variable or use default
  upload_dir := current_setting('app.upload_dir', true);
  IF upload_dir IS NULL THEN
    upload_dir := 'uploads';
  END IF;
  
  -- This is just a comment as we can't create directories from SQL
  -- The application will need to ensure these directories exist
  RAISE NOTICE 'Remember to create directories for media storage: %', upload_dir;
END $$;
