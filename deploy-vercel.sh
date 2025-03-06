#!/bin/bash

# Swickr Vercel Deployment Script
# This script prepares the Swickr application for deployment to Vercel

echo "=== Starting Swickr Vercel Deployment Preparation ==="

# Step 1: Update environment variables for production
echo "Updating environment variables for production..."

# Create production .env file for client
echo "Creating production client environment variables..."
cat > client/.env << EOL
REACT_APP_API_URL=https://swickr.vercel.app/api
REACT_APP_WEBSOCKET_URL=wss://swickr.vercel.app
REACT_APP_ENV=production
EOL

# Create production .env file for server
echo "Creating production server environment variables..."
cat > server/.env << EOL
NODE_ENV=production
PORT=3001
JWT_SECRET=your_production_jwt_secret_key_here
CLIENT_URL=https://swickr.vercel.app
VERCEL=true
EOL

# Step 2: Commit changes to Git
echo "Committing changes to Git..."
git add .
git commit -m "Prepare for Vercel deployment"
git push origin master

# Step 3: Deploy to Vercel
echo "=== Deployment Preparation Complete ==="
echo "To deploy to Vercel, follow these steps:"
echo "1. Go to https://vercel.com/new"
echo "2. Import your GitHub repository"
echo "3. Configure the project settings as described in VERCEL_DEPLOYMENT.md"
echo "4. Click 'Deploy'"
echo ""
echo "After deployment, you may need to set up the following environment variables in the Vercel dashboard:"
echo "- NODE_ENV=production"
echo "- JWT_SECRET=your_secure_jwt_secret"
echo "- CLIENT_URL=https://your-vercel-domain.vercel.app"
echo "- VERCEL=true"
