# Discord Music Bot

A Discord music bot with Spotify search, SoundCloud playback, and voting features.

## Features

- 🎵 Play music from Spotify, SoundCloud, and YouTube (fallback)
- 🔍 Smart search using Spotify metadata with SoundCloud playback
- 📋 Queue management
- 🗳️ Vote to skip current song
- 💡 Song suggestions with community voting
- ⚡ Slash commands

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Get Your Credentials

#### Discord Bot Token
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to "Bot" section and create a bot
4. Copy the token
5. Enable these intents:
   - Presence Intent
   - Server Members Intent
   - Message Content Intent
6. Go to OAuth2 > URL Generator
   - Select scopes: `bot`, `applications.commands`
   - Select permissions: `Send Messages`, `Connect`, `Speak`, `Use Voice Activity`
   - Copy the generated URL and invite the bot to your server

#### Spotify API Credentials
1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new app
3. Copy the Client ID and Client Secret

### 3. Configure Environment

Create a `.env` file (copy from `.env.example`):

```bash
cp .env.example .env
```

Edit `.env` and add your credentials:

```env
DISCORD_TOKEN=your_discord_bot_token_here
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
PREFIX=/
```

### 4. Run the Bot

Development mode:
```bash
npm run dev
```

Production mode:
```bash
npm run build
npm start
```

## Commands

- `/play <song>` - Play a song (searches Spotify, plays from SoundCloud)
- `/skip` - Skip the current song (requires DJ or vote)
- `/vote` - Vote to skip the current song (50% of voice channel needed)
- `/queue` - Show the current queue
- `/stop` - Stop playing and clear the queue
- `/suggest <song>` - Suggest a song for voting (3 votes needed to add)

## How It Works

1. **Search**: Uses Spotify API for accurate song metadata
2. **Playback**: Finds the same song on SoundCloud for streaming (no API limits)
3. **Fallback**: If SoundCloud doesn't have it, falls back to YouTube
4. **Voting**: Democratic skip voting and song suggestions

## Why This Approach?

- **Spotify**: Best search results and metadata, but only 30s previews
- **SoundCloud**: More permissive for playback, no strict API limits
- **YouTube**: Fallback option (use sparingly to avoid rate limits)

This hybrid approach gives you the best of all worlds without hitting API limits or ToS issues.

## Troubleshooting

### Bot doesn't respond
- Check if bot has proper permissions in your server
- Verify intents are enabled in Discord Developer Portal
- Check console for errors

### No audio playing
- Ensure bot has "Connect" and "Speak" permissions
- Check if you're in a voice channel
- Verify FFmpeg is installed (required by @discordjs/voice)

### Songs not found
- Verify Spotify credentials are correct
- Try searching with more specific terms
- Check console logs for API errors

## Notes

- The bot uses `play-dl` library which handles multiple sources
- Spotify credentials are optional but recommended for better search
- Vote skip requires 50% of voice channel members
- Song suggestions need 3 votes to be added to queue
