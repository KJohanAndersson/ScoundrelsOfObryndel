# Quick Deployment Guide

## Step-by-Step Deployment to Vercel

### 1. Upload to GitHub

```bash
# Navigate to your project folder
cd obryndel-game

# Initialize git repository
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - Obryndel game"

# Create a new repository on GitHub (github.com/new)
# Then connect and push:
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/obryndel-game.git
git push -u origin main
```

### 2. Deploy to Vercel

1. Go to https://vercel.com
2. Sign in with GitHub
3. Click "Add New Project"
4. Select your `obryndel-game` repository
5. Click "Deploy"

That's it! Vercel will automatically:
- Detect it's a Vite project
- Run `npm install`
- Run `npm run build`
- Deploy your app

### 3. Access Your App

Once deployed, Vercel will give you a URL like:
`https://obryndel-game.vercel.app`

## Important Notes for Mobile Usage

- **HTTPS Required**: The camera API only works on HTTPS. Vercel provides this automatically.
- **Camera Permissions**: Users must grant camera permission when first accessing the app.
- **Best Browsers**: Chrome or Firefox on Android work best for camera access.

## Testing QR Codes

You can create test QR codes with the format `Tile-001` through `Tile-030` using:
- https://www.qr-code-generator.com/
- https://goqr.me/

Simply enter the text (e.g., "Tile-001") and generate a QR code to print or display on another device.

## Troubleshooting

**"Camera not supported" error:**
- Ensure you're accessing via HTTPS (Vercel URL)
- Check browser permissions
- Try a different browser (Chrome recommended)

**Build fails on Vercel:**
- Check the build logs in Vercel dashboard
- Ensure package.json has all dependencies
- Vercel will automatically install and build

**QR codes don't scan:**
- Ensure proper lighting
- Hold QR code steady
- Make sure format is exactly: Tile-001 (with capital T and dash)
