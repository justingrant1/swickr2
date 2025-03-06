-- Media tables migration script
-- This script creates the necessary tables and indexes for media handling in Swickr

-- Create media table if it doesn't exist
CREATE TABLE IF NOT EXISTS media (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  filename VARCHAR(255) NOT NULL,
  path VARCHAR(512) NOT NULL,
  size BIGINT NOT NULL,
  type VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_media_user_id ON media(user_id);

-- Create index on filename for faster lookups
CREATE INDEX IF NOT EXISTS idx_media_filename ON media(filename);

-- Add media-related columns to messages table if they don't exist
DO $$
BEGIN
  -- Check if media_id column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' AND column_name = 'media_id'
  ) THEN
    ALTER TABLE messages ADD COLUMN media_id VARCHAR(36);
  END IF;

  -- Check if media_type column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' AND column_name = 'media_type'
  ) THEN
    ALTER TABLE messages ADD COLUMN media_type VARCHAR(20);
  END IF;

  -- Check if media_url column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' AND column_name = 'media_url'
  ) THEN
    ALTER TABLE messages ADD COLUMN media_url VARCHAR(512);
  END IF;

  -- Check if media_caption column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' AND column_name = 'media_caption'
  ) THEN
    ALTER TABLE messages ADD COLUMN media_caption TEXT;
  END IF;

  -- Check if media_size column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' AND column_name = 'media_size'
  ) THEN
    ALTER TABLE messages ADD COLUMN media_size BIGINT;
  END IF;

  -- Check if media_mime_type column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' AND column_name = 'media_mime_type'
  ) THEN
    ALTER TABLE messages ADD COLUMN media_mime_type VARCHAR(100);
  END IF;
END $$;

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically update the updated_at column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_media_modtime'
  ) THEN
    CREATE TRIGGER update_media_modtime
    BEFORE UPDATE ON media
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();
  END IF;
END $$;

-- Add a foreign key constraint to messages table referencing media table
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
