#!/bin/bash

# Swickr Deployment Script
# This script prepares and deploys the Swickr application to production

echo "=== Starting Swickr Deployment ==="

# Step 1: Build the client
echo "Building client application..."
cd client
npm run build

# Step 2: Prepare server for production
echo "Preparing server for production..."
cd ../server

# Create production .env file
echo "Creating production environment variables..."
cat > .env << EOL
NODE_ENV=production
PORT=3001
JWT_SECRET=your_production_jwt_secret_key_here
CLIENT_URL=https://swickr.example.com
DATABASE_URL=postgresql://username:password@db-host:5432/swickr
REDIS_URL=redis://redis-host:6379
EOL

# Step 3: Install production dependencies
echo "Installing production dependencies..."
npm ci --only=production

# Step 4: Package application
echo "Packaging application for deployment..."
mkdir -p ../dist
cp -r ../client/build ../dist/client
cp -r . ../dist/server
cd ../dist
tar -czvf swickr-production.tar.gz client server

echo "=== Deployment package created: dist/swickr-production.tar.gz ==="
echo "To deploy to your production server:"
echo "1. Transfer the package to your server"
echo "2. Extract the package: tar -xzvf swickr-production.tar.gz"
echo "3. Configure your web server (Nginx/Apache) to serve the static files from client/build"
echo "4. Set up a process manager (PM2) to run the Node.js server"
echo "5. Configure SSL certificates for secure communication"

echo "=== Deployment preparation complete ==="
