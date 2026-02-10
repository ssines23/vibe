import { LavalinkManager } from 'lavalink-client';
import { Client } from 'discord.js';
import { skipVotes } from '../index';

export function createLavalinkManager(client: Client): LavalinkManager {
  const manager = new LavalinkManager({
    nodes: [
      {
        authorization: 'youshallnotpass',
        host: 'lavalink.jirayu.net',
        port: 13592,
        id: 'hosted-node',
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
          const tracksToAdd = res.tracks.slice(0, 5).filter((t: any) => t.info.identifier !== track.info.identifier);
          
          if (tracksToAdd.length > 0) {
            await player.queue.add(tracksToAdd);
            console.log(`\n🎵 Auto-recommendations added (${tracksToAdd.length} tracks):`);
            tracksToAdd.forEach((t: any, i: number) => {
              console.log(`  ${i + 1}. ${t.info.title} - ${t.info.author}`);
            });
            console.log('');
            
            // Send message to Discord channel
            try {
              if (!player.textChannelId) return;
              const channel = await client.channels.fetch(player.textChannelId);
              if (channel && 'send' in channel) {
                let msg = `🎵 **Playing next:**\n`;
                tracksToAdd.slice(0, 3).forEach((t: any, i: number) => {
                  msg += `${i + 1}. ${t.info.title} - ${t.info.author}\n`;
                });
                if (tracksToAdd.length > 3) {
                  msg += `...and ${tracksToAdd.length - 3} more`;
                }
                await channel.send(msg);
              }
            } catch (error) {
              console.error('Error sending recommendation message:', error);
            }
          }
        }
      } catch (error) {
        console.error('Error auto-adding tracks:', error);
      }
    }
  };

  // Trigger auto-recommend when track starts
  manager.on('trackStart', async (player, track) => {
    if (!track) return;
    
    // Send "Now Playing" message
    try {
      if (!player.textChannelId) return;
      const channel = await client.channels.fetch(player.textChannelId);
      if (channel && 'send' in channel) {
        await channel.send(`🎵 **Now Playing:** ${track.info.title} - ${track.info.author}`);
      }
    } catch (error) {
      console.error('Error sending now playing message:', error);
    }
    
    // Check for auto-recommendations
    await autoRecommend(player, track);
  });

  // Trigger auto-recommend when track ends
  manager.on('trackEnd', async (player, track) => {
    skipVotes.delete(player.guildId);
    await autoRecommend(player, track);
  });

  return manager;
}
