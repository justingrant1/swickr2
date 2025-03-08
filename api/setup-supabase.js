// Script to set up Supabase tables
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const SUPABASE_URL = 'https://orfrnjeheaufjznybjtb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yZnJuamVoZWF1Zmp6bnlianRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE0MDM1MTAsImV4cCI6MjA1Njk3OTUxMH0.sUqLxOTgjFWc1Cia6SDUQDfnMVDKNBx83FqKEWjDSzM';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Read SQL file
const sqlFilePath = path.join(__dirname, 'create_tables.sql');
const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

// Split SQL into individual statements
const statements = sqlContent.split(';').filter(stmt => stmt.trim() !== '');

// Execute each SQL statement
async function executeSQL() {
  try {
    console.log('Setting up Supabase tables...');
    
    // Execute each statement
    for (const statement of statements) {
      console.log(`Executing SQL statement: ${statement.substring(0, 50)}...`);
      
      const { data, error } = await supabase.rpc('exec_sql', { sql: statement });
      
      if (error) {
        console.error('Error executing SQL:', error);
      } else {
        console.log('SQL executed successfully');
      }
    }
    
    // Call the functions to create tables
    console.log('Creating users table...');
    const { error: usersError } = await supabase.rpc('create_users_table');
    if (usersError) {
      console.error('Error creating users table:', usersError);
    } else {
      console.log('Users table created successfully');
    }
    
    console.log('Creating messages table...');
    const { error: messagesError } = await supabase.rpc('create_messages_table');
    if (messagesError) {
      console.error('Error creating messages table:', messagesError);
    } else {
      console.log('Messages table created successfully');
    }
    
    console.log('Supabase setup completed');
  } catch (error) {
    console.error('Error setting up Supabase:', error);
  }
}

// Execute the setup
executeSQL();
