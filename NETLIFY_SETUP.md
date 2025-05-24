# Netlify Deployment Setup

This guide will help you set up the environment variables on Netlify to ensure that sign out works correctly in production.

## Environment Variables Required

You need to configure the following environment variables in your Netlify dashboard:

### 1. Clerk Authentication Variables

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: Your Clerk publishable key from the Clerk dashboard
- `CLERK_SECRET_KEY`: Your Clerk secret key from the Clerk dashboard  
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_OUT_URL`: Your deployed Netlify app URL (e.g., `https://your-app.netlify.app`)
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL`: `/sign-in`
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL`: `/sign-up`

### 2. Other Application Variables

- `GOOGLE_API_KEY`: Google API key for Gemini models
- `PINECONE_API_KEY`: Pinecone API key
- `PINECONE_INDEX`: Name of your Pinecone index

## Setting Up Environment Variables on Netlify

1. Go to your Netlify site dashboard
2. Navigate to **Site settings** → **Environment variables**
3. Click **Add a variable** for each environment variable listed above
4. Enter the variable name and value
5. Click **Save**

## Clerk Dashboard Configuration

Make sure your Clerk application is configured correctly:

1. Go to your [Clerk Dashboard](https://dashboard.clerk.com/)
2. Select your application
3. Go to **Configure** → **Domains**
4. Add your Netlify domain (e.g., `https://your-app.netlify.app`) to the allowed domains
5. Go to **Configure** → **Paths**
6. Ensure the following paths are configured:
   - Sign-in path: `/sign-in`
   - Sign-up path: `/sign-up`
   - After sign-in URL: `/` (or your preferred landing page)
   - After sign-up URL: `/` (or your preferred landing page)

## Common Issues and Solutions

### Sign out works locally but not on Netlify

This is usually caused by:

1. **Missing environment variables**: Make sure `NEXT_PUBLIC_CLERK_AFTER_SIGN_OUT_URL` is set to your actual Netlify URL
2. **Domain mismatch**: Ensure your Netlify domain is added to the allowed domains in Clerk
3. **CORS issues**: Check that your Clerk application allows requests from your Netlify domain

### Fix Applied

The codebase has been updated with the following improvements:

1. **Dynamic sign-out URL detection**: The `UserButton` now uses `window.location.origin` when available, providing better compatibility across environments
2. **Enhanced Netlify configuration**: Added proper redirects for authentication routes
3. **Comprehensive environment variable setup**: All necessary Clerk variables are documented

## Deployment Steps

1. Set up all environment variables in Netlify dashboard
2. Configure your Clerk application with the correct domains and paths
3. Deploy your site to Netlify
4. Test the sign-out functionality

If you continue to experience issues, check the browser's developer console for any error messages and verify that all environment variables are correctly set. 