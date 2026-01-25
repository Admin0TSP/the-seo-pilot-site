# Deploying TheSEOPilot Site to Render

This guide will help you deploy your static website to Render using your GitHub repository.

## Prerequisites

- GitHub account with the repository: `https://github.com/Admin0TSP/the-seo-pilot-site`
- Render account (sign up at https://render.com)

## Deployment Steps

### 1. Push Your Code to GitHub

Make sure all your files are committed and pushed to your GitHub repository:

```bash
git add .
git commit -m "Add Render deployment configuration"
git push origin main
```

### 2. Deploy on Render

#### Option A: Using render.yaml (Recommended)

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"Static Site"**
3. Connect your GitHub account if not already connected
4. Select your repository: `Admin0TSP/the-seo-pilot-site`
5. Render will automatically detect the `render.yaml` file
6. Click **"Create Static Site"**

#### Option B: Manual Configuration

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"Static Site"**
3. Connect your GitHub account
4. Select repository: `Admin0TSP/the-seo-pilot-site`
5. Configure:
   - **Name**: `the-seo-pilot-site` (or your preferred name)
   - **Branch**: `main`
   - **Root Directory**: Leave empty (or `seo-pilot-site` if your files are in a subdirectory)
   - **Build Command**: Leave empty (static site)
   - **Publish Directory**: `.` (or the folder containing index.html)
6. Click **"Create Static Site"**

### 3. Environment Variables (Optional)

If you need to change EmailJS or other configurations:

1. In your Render dashboard, go to your static site
2. Navigate to **"Environment"** tab
3. Add any variables you need (though static sites can't directly use env vars without a build step)

**Note**: For static sites, environment variables are typically hardcoded in the HTML/JS files. If you need dynamic configuration, consider:
- Using a build step to replace variables
- Using client-side configuration
- Moving sensitive keys to environment variables and using a build process

### 4. Custom Domain (Optional)

1. In your Render dashboard, go to your static site
2. Click **"Settings"** → **"Custom Domains"**
3. Add your custom domain
4. Follow DNS configuration instructions

## File Structure

```
the-seo-pilot-site/
├── index.html          # Main page
├── terms.html          # Terms of Service
├── privacy.html        # Privacy Policy
├── style.css           # Styles
├── script.js           # JavaScript
├── _redirects          # Netlify redirects (not used on Render)
├── render.yaml         # Render configuration
├── .gitignore          # Git ignore rules
├── .env.example        # Environment variables template
└── assets/             # Images and media
    └── img/
```

## Current Configuration

The site uses:
- **EmailJS**: For contact form submissions
  - Public Key: `ZAR28m5o6Hqq5XNZY`
  - Service ID: `service_x943cgt`
  - Template ID: `template_capb6qn`
- **OmniDimension Widget**: Analytics/chat widget
  - Secret Key: `c128810afd0f302bcc9528923acd31d8`

## Troubleshooting

### Build Fails
- Ensure `index.html` is in the root directory (or adjust Publish Directory)
- Check that all asset paths are correct (relative paths work best)

### Assets Not Loading
- Verify all files are committed to GitHub
- Check file paths are relative (e.g., `assets/img/logo.webp` not `/assets/img/logo.webp`)

### Contact Form Not Working
- Verify EmailJS keys are correct in `index.html`
- Check browser console for errors
- Ensure EmailJS service is active

## Local Testing

Before deploying, test locally:

```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx http-server -p 8000

# Using npm script (if you run npm install)
npm start
```

Then visit: `http://localhost:8000`

## Support

For Render-specific issues, check:
- [Render Documentation](https://render.com/docs)
- [Render Community](https://community.render.com)

