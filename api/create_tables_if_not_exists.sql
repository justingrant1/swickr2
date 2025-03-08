-- Function to create users table if it doesn't exist
CREATE OR REPLACE FUNCTION create_users_table_if_not_exists()
RETURNS void AS $$
BEGIN
  -- Check if the table already exists
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'users'
  ) THEN
    -- Create the users table
    CREATE TABLE public.users (
      id UUID PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT,
      status TEXT DEFAULT 'offline',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Add indexes
    CREATE INDEX idx_users_username ON public.users(username);
    CREATE INDEX idx_users_email ON public.users(email);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to create messages table if it doesn't exist
CREATE OR REPLACE FUNCTION create_messages_table_if_not_exists()
RETURNS void AS $$
BEGIN
  -- Check if the table already exists
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'messages'
  ) THEN
    -- Create the messages table
    CREATE TABLE public.messages (
      id UUID PRIMARY KEY,
      content TEXT NOT NULL,
      userId UUID NOT NULL,
      recipientId UUID NOT NULL,
      timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Add indexes
    CREATE INDEX idx_messages_userId ON public.messages(userId);
    CREATE INDEX idx_messages_recipientId ON public.messages(recipientId);
    CREATE INDEX idx_messages_timestamp ON public.messages(timestamp);
  END IF;
END;
$$ LANGUAGE plpgsql;
