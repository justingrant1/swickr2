# Swickr Vercel Deployment Guide

This guide will help you deploy Swickr to Vercel for production use.

## Prerequisites

1. GitHub repository with your Swickr code (already set up at https://github.com/justingrant1/swickr)
2. Vercel account (sign up at https://vercel.com if you don't have one)
3. PostgreSQL database (can be set up on services like AWS RDS, Heroku Postgres, or DigitalOcean)
4. Redis instance (can be set up on services like AWS ElastiCache, Heroku Redis, or Redis Labs)

## Deployment Steps

### 1. Set Up Database Services

Before deploying to Vercel, set up your PostgreSQL and Redis instances:

- **PostgreSQL**: Create a PostgreSQL database and note the connection details
- **Redis**: Set up a Redis instance and note the connection details

### 2. Deploy to Vercel

1. Log in to [Vercel](https://vercel.com)
2. Click "Add New" → "Project"
3. Import your GitHub repository (https://github.com/justingrant1/swickr)
4. Configure the project:
   - Framework Preset: Other
   - Root Directory: ./
   - Build Command: `npm run build:client`
   - Output Directory: `client/build`
5. Add Environment Variables (from your `.env` file):
   ```
   NODE_ENV=production
   PORT=3001
   CLIENT_URL=https://your-vercel-domain.vercel.app
   
   JWT_SECRET=your_secure_jwt_secret_key
   JWT_ACCESS_EXPIRY=15m
   JWT_REFRESH_EXPIRY=7d
   
   DB_HOST=your_postgres_host
   DB_PORT=5432
   DB_NAME=swickr
   DB_USER=your_db_username
   DB_PASSWORD=your_db_password
   
   REDIS_HOST=your_redis_host
   REDIS_PORT=6379
   REDIS_PASSWORD=your_redis_password
   
   WEBSOCKET_URL=wss://your-vercel-domain.vercel.app
   ```
6. Click "Deploy"

### 3. Configure WebSockets

For WebSocket support in production:

1. Update the client WebSocket connection to use the production URL:
   ```javascript
   // In client/src/services/socketService.js
   const SOCKET_URL = process.env.NODE_ENV === 'production' 
     ? 'wss://your-vercel-domain.vercel.app'
     : 'ws://localhost:3001';
   ```

2. Make sure your CORS settings in the server allow connections from your Vercel domain:
   ```javascript
   // In server/src/index.js
   app.use(cors({
     origin: process.env.NODE_ENV === 'production'
       ? 'https://your-vercel-domain.vercel.app'
       : 'http://localhost:3000',
     credentials: true
   }));
   ```

### 4. Database Migrations

After deployment, you'll need to run your database migrations:

1. Connect to your production database
2. Run the migration scripts to set up your database schema

### 5. Verify Deployment

1. Visit your Vercel deployment URL
2. Test user registration and login
3. Test messaging functionality
4. Verify WebSocket connections are working properly

## Troubleshooting

If you encounter issues:

1. Check Vercel deployment logs
2. Verify environment variables are set correctly
3. Test database connectivity
4. Check WebSocket connections

## Performance Monitoring

Set up monitoring for your Swickr deployment:

1. Enable Vercel Analytics
2. Set up logging with a service like Papertrail or LogDNA
3. Monitor your database and Redis performance

## Security Considerations

1. Ensure your JWT_SECRET is strong and secure
2. Set up proper CORS configuration
3. Consider enabling rate limiting for API endpoints
4. Regularly update dependencies for security patches
