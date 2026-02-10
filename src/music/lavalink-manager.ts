import { LavalinkManager } from 'lavalink-client';
import { Client } from 'discord.js';

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

  return manager;
}
