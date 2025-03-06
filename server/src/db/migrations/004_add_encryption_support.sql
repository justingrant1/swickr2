-- Add encryption support to messages table
ALTER TABLE messages
ADD COLUMN encrypted_content TEXT,
ADD COLUMN iv TEXT,
ADD COLUMN recipient_keys JSONB,
ADD COLUMN is_encrypted BOOLEAN DEFAULT FALSE;

-- Add public_key field to users table
ALTER TABLE users
ADD COLUMN public_key TEXT;

-- Create index for faster encrypted message queries
CREATE INDEX idx_messages_is_encrypted ON messages(is_encrypted);

-- Create endpoint for updating user public key
CREATE OR REPLACE FUNCTION update_user_public_key(user_id UUID, new_public_key TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE users SET public_key = new_public_key WHERE id = user_id;
END;
$$ LANGUAGE plpgsql;
