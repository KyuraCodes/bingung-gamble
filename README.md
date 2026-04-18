# BingungGambling - Minecraft Casino Website

A comprehensive gambling website integrated with Minecraft, featuring code-based authentication, live betting feed, and player progression system.

## Features

- 🎮 Code-based authentication from Minecraft (/gamble command)
- 💰 Real-time balance synchronization with MySQL
- 📊 Live betting feed with Socket.io
- 🎯 Leveling system with XP progression
- 🖼️ Minecraft skin display
- 💵 Formatted amounts (K, M, B, T, Q)
- 🔒 72-hour session management
- 📈 Comprehensive player statistics

## Installation

### 1. Install Dependencies

```bash
cd bingungGambling
npm install
```

### 2. Setup MySQL Database

```bash
mysql -u root -p < database.sql
```

### 3. Configure Environment

Copy `.env.example` to `.env` and update with your settings:

```bash
cp .env.example .env
```

Edit `.env`:
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=bingung_gambling
DB_PORT=3306
SESSION_SECRET=your_super_secret_key
PORT=3000
```

### 4. Start the Server

```bash
npm start
```

Or for development with auto-reload:
```bash
npm run dev
```

The website will be available at `http://localhost:3000`

## How It Works

1. Player types `/gamble` in Minecraft
2. Plugin generates a 6-digit code (e.g., 628174)
3. Player visits the website and enters username + code
4. Session lasts 72 hours
5. Logging out resets the code
6. All balance changes sync with Minecraft via MySQL

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login with username and code
- `GET /api/auth/session` - Check current session
- `POST /api/auth/logout` - Logout and invalidate session

### Game
- `POST /api/game/bet` - Place a bet
- `GET /api/game/recent-bets` - Get recent bets for live feed

### Player
- `GET /api/player/stats` - Get player statistics
- `GET /api/player/history` - Get bet history

## Database Schema

### Tables
- `players` - Player data (username, balance, level, xp)
- `auth_codes` - Authentication codes from Minecraft
- `sessions` - Active login sessions
- `bets` - Bet history

## Tech Stack

- Node.js + Express
- MySQL2
- Socket.io (real-time updates)
- Express-session (session management)
- Vanilla JavaScript (frontend)

## Next Steps

Configure the Minecraft plugin to integrate with this website!
