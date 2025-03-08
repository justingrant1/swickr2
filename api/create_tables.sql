-- Function to create users table
CREATE OR REPLACE FUNCTION create_users_table()
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
    
    -- Set up Row Level Security
    ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
    
    -- Create policies
    CREATE POLICY "Users are viewable by everyone" 
      ON public.users FOR SELECT 
      USING (true);
      
    CREATE POLICY "Users can be inserted by authenticated users" 
      ON public.users FOR INSERT 
      WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'anon');
      
    CREATE POLICY "Users can be updated by themselves" 
      ON public.users FOR UPDATE 
      USING (auth.uid() = id);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to create messages table
CREATE OR REPLACE FUNCTION create_messages_table()
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
      userId UUID NOT NULL REFERENCES public.users(id),
      recipientId UUID NOT NULL REFERENCES public.users(id),
      timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Add indexes
    CREATE INDEX idx_messages_userId ON public.messages(userId);
    CREATE INDEX idx_messages_recipientId ON public.messages(recipientId);
    CREATE INDEX idx_messages_timestamp ON public.messages(timestamp);
    
    -- Set up Row Level Security
    ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
    
    -- Create policies
    CREATE POLICY "Messages are viewable by sender and recipient" 
      ON public.messages FOR SELECT 
      USING (auth.uid() = userId OR auth.uid() = recipientId);
      
    CREATE POLICY "Messages can be inserted by authenticated users" 
      ON public.messages FOR INSERT 
      WITH CHECK (auth.uid() = userId);
  END IF;
END;
$$ LANGUAGE plpgsql;
