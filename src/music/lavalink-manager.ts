import { LavalinkManager } from 'lavalink-client';
import { Client } from 'discord.js';
import { skipVotes } from '../index';

// Track auto-recommended tracks per guild
const autoRecommendedTracks = new Map<string, Set<string>>();

export function createLavalinkManager(client: Client, skipFlags: Map<string, boolean>): LavalinkManager {
  const manager = new LavalinkManager({
    nodes: [
      {
        authorization: 'youshallnotpass',
        host: 'localhost',
        port: 2333,
        id: 'local-node',
        secure: false,
      },
    ],
    sendToShard: (guildId, payload) => {
      const guild = client.guilds.cache.get(guildId);
      if (guild) guild.shard.send(payload);
    },
  });

  manager.nodeManager.on('connect', (node) => {
    console.log(`✅ Lavalink node "${node.id}" connected`);
  });

  manager.nodeManager.on('disconnect', (node, reason) => {
    console.log(`❌ Lavalink node "${node.id}" disconnected:`, reason);
  });

  manager.nodeManager.on('error', (node, error) => {
    console.error(`❌ Lavalink node "${node.id}" error:`, error);
  });

  // Auto-recommendation function
  const autoRecommend = async (player: any, track: any) => {
    if (!track) return;
    
    // Auto-add recommendations when 3 or fewer tracks in queue
    if (player.queue.tracks.length <= 3) {
      try {
        const searchQuery = `${track.info.author} similar songs`;
        const res = await player.search({ query: searchQuery }, { id: 'auto-recommend' });
        
        if (res && res.tracks && res.tracks.length > 0) {
          const tracksToAdd = res.tracks.slice(0, 1).filter((t: any) => t.info.identifier !== track.info.identifier);
          
          if (tracksToAdd.length > 0) {
            await player.queue.add(tracksToAdd);
            
            // Mark these as auto-recommended
            if (!autoRecommendedTracks.has(player.guildId)) {
              autoRecommendedTracks.set(player.guildId, new Set());
            }
            tracksToAdd.forEach((t: any) => {
              autoRecommendedTracks.get(player.guildId)!.add(t.info.identifier);
            });
            
            console.log(`\n🎵 Auto-recommendations added (${tracksToAdd.length} tracks):`);
            tracksToAdd.forEach((t: any, i: number) => {
              console.log(`  ${i + 1}. ${t.info.title} - ${t.info.author}`);
            });
            console.log('');
          }
        }
      } catch (error) {
        console.error('Error auto-adding tracks:', error);
      }
    }
  };

  // Function to clear auto-recommendations and refetch based on last manually added track
  const refreshRecommendations = async (player: any, newTrack: any) => {
    if (!player || !newTrack) return;
    
    // Remove all auto-recommended tracks from queue
    const autoTracks = autoRecommendedTracks.get(player.guildId);
    if (autoTracks && autoTracks.size > 0) {
      const tracksToKeep = player.queue.tracks.filter((t: any) => !autoTracks.has(t.info.identifier));
      player.queue.tracks = tracksToKeep;
      autoRecommendedTracks.delete(player.guildId);
      console.log(`🗑️ Cleared ${autoTracks.size} auto-recommendations`);
    }
    
    // Fetch new recommendations based on the newly added track
    await autoRecommend(player, newTrack);
  };

  // Export the refresh function so it can be called from the play command
  (manager as any).refreshRecommendations = refreshRecommendations;

  // Trigger auto-recommend when track starts
  manager.on('trackStart', async (player, track) => {
    if (!track) return;
    
    // Only send "Now Playing" if this wasn't triggered by a skip
    const wasSkipped = skipFlags.get(player.guildId);
    if (!wasSkipped) {
      try {
        if (!player.textChannelId) return;
        const channel = await client.channels.fetch(player.textChannelId);
        if (channel && 'send' in channel) {
          await channel.send(`🎵 **Now Playing:** ${track.info.title} - ${track.info.author}`);
        }
      } catch (error) {
        console.error('Error sending now playing message:', error);
      }
    } else {
      // Send "Now Playing" message for skipped tracks
      try {
        if (!player.textChannelId) return;
        const channel = await client.channels.fetch(player.textChannelId);
        if (channel && 'send' in channel) {
          await channel.send(`🎵 **Now Playing:** ${track.info.title} - ${track.info.author}`);
        }
      } catch (error) {
        console.error('Error sending now playing message:', error);
      }
      // Clear the skip flag after using it
      skipFlags.delete(player.guildId);
    }
    
    // Always check for auto-recommendations
    await autoRecommend(player, track);
    
    // Always show "Next up" after recommendations are added
    if (player.queue.tracks.length > 0) {
      try {
        if (!player.textChannelId) return;
        const channel = await client.channels.fetch(player.textChannelId);
        if (channel && 'send' in channel) {
          const nextTrack = player.queue.tracks[0];
          await channel.send(`⏭️ **Next up:** ${nextTrack.info.title} - ${nextTrack.info.author}`);
        }
      } catch (error) {
        console.error('Error sending next up message:', error);
      }
    }
  });

  // Clean up skip votes when track ends
  manager.on('trackEnd', async (player) => {
    skipVotes.delete(player.guildId);
  });

  return manager;
}
