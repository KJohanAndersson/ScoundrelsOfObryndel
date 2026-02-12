# Obryndel - Tabletop Game App

A React-based tabletop game app that uses QR code scanning to track game progress.

## Features

- Player selection (1-4 players)
- Character selection (Goblin, Troll, Cyclops, Witch)
- QR code scanning using device camera
- Three-act gameplay structure
- 30 unique tile events
- Fantasy-themed UI design

## Setup Instructions

### Prerequisites
- Node.js 16+ installed
- A GitHub account
- A Vercel account (free)

### Local Development

1. Clone this repository:
```bash
git clone <your-repo-url>
cd obryndel-game
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open your browser to the URL shown (usually `http://localhost:5173`)

### Deployment to Vercel

#### Option 1: Via Vercel Dashboard (Recommended)

1. Push your code to GitHub:
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

2. Go to [vercel.com](https://vercel.com) and sign in
3. Click "Add New Project"
4. Import your GitHub repository
5. Vercel will automatically detect it's a Vite project
6. Click "Deploy"

#### Option 2: Via Vercel CLI

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Deploy:
```bash
vercel
```

3. Follow the prompts and your app will be deployed!

## Camera Permissions

The app requires camera access to scan QR codes. Make sure to:
- Allow camera permissions when prompted
- Use HTTPS (Vercel provides this automatically)
- On Android, the app works best in Chrome or Firefox

## QR Code Format

The app expects QR codes in the format: `Tile-001` through `Tile-030`

You can generate test QR codes at sites like:
- https://www.qr-code-generator.com/
- https://goqr.me/

## Game Flow

1. **Main Menu** - Start game or access settings
2. **Introduction** - Story text and player count selection
3. **Instructions** - Setup instructions
4. **Character Selection** - Each player chooses a character
5. **Gameplay** - Scan QR cards, track events across 3 acts
   - Act 1: Cards 1-5
   - Act 2: Cards 6-10
   - Act 3: Cards 11-30

## Project Structure

```
obryndel-game/
├── src/
│   ├── App.jsx          # Main game component
│   └── main.jsx         # React entry point
├── index.html           # HTML template
├── package.json         # Dependencies
├── vite.config.js       # Vite configuration
└── README.md           # This file
```

## Technologies Used

- React 18
- Vite (build tool)
- jsQR (QR code scanning)
- Google Fonts (Cinzel)

## Troubleshooting

**Camera not working:**
- Ensure you're using HTTPS (required for camera access)
- Check browser camera permissions
- Try using Chrome or Firefox on Android

**QR codes not scanning:**
- Ensure good lighting
- Hold the QR code steady in view
- Make sure QR codes use the correct format (Tile-001, etc.)

**Build errors:**
- Run `npm install` to ensure all dependencies are installed
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`

## License

MIT
