# Swickr Deployment Guide

This document outlines the steps to deploy Swickr to GitHub and Vercel.

## Deployment Steps

### 1. GitHub Repository Setup

1. Create a new GitHub repository
2. Push the Swickr codebase to GitHub:

```bash
# Initialize git repository (if not already done)
git init

# Add all files
git add .

# Commit changes
git commit -m "Initial commit"

# Add your GitHub repository as remote
git remote add origin https://github.com/yourusername/swickr.git

# Push to GitHub
git push -u origin main
```

### 2. Vercel Deployment

1. Sign up or log in to [Vercel](https://vercel.com/)
2. Click "New Project" and import your GitHub repository
3. Configure the project:
   - Framework Preset: Other
   - Root Directory: ./
   - Build Command: npm run build:client
   - Output Directory: client/build
4. Add environment variables:
   - Copy all variables from your `.env` file to Vercel's environment variables section
   - Make sure to add `NODE_ENV=production`
5. Click "Deploy"

### 3. Database Setup

For production deployment, you'll need to set up PostgreSQL and Redis:

1. Set up a PostgreSQL database (using services like AWS RDS, Heroku Postgres, or DigitalOcean)
2. Set up a Redis instance (using services like AWS ElastiCache, Heroku Redis, or Redis Labs)
3. Update your environment variables in Vercel with the production database connection strings

### 4. WebSocket Configuration

For WebSocket support in production:

1. Make sure your client is configured to connect to the production WebSocket endpoint
2. Update the CORS settings in your server to allow connections from your Vercel domain

## Monitoring and Maintenance

- Set up logging with a service like Papertrail or LogDNA
- Configure monitoring with Vercel Analytics
- Regularly check for security updates and dependencies

## Troubleshooting

If you encounter issues with the deployment:

1. Check Vercel build logs for errors
2. Verify environment variables are correctly set
3. Test WebSocket connections
4. Check database connectivity

For more detailed information, refer to the [Vercel documentation](https://vercel.com/docs).
