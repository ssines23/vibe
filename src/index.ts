import { Client, GatewayIntentBits } from 'discord.js';
import { config } from 'dotenv';
import { registerCommands } from './commands';
import { createLavalinkManager } from './music/lavalink-manager';
import { LavalinkManager } from 'lavalink-client';

config();

export let manager: LavalinkManager;

// Store vote-to-skip data per guild
export const skipVotes = new Map<string, Set<string>>();

// Track which guilds just skipped to avoid duplicate "Now Playing" messages
const skipFlags = new Map<string, boolean>();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

  client.once('ready', () => {
    console.log(`✅ Bot is ready! Logged in as ${client.user?.tag}`);
    
    // Initialize Lavalink
    manager = createLavalinkManager(client, skipFlags);
    manager.init({ id: client.user!.id, username: client.user!.username });
    
    registerCommands(client);
  });

  client.on('raw', (d) => {
    if (manager && manager.nodeManager.nodes.size > 0) {
      const node = manager.nodeManager.nodes.values().next().value;
      if (node?.sessionId) {
        manager.sendRawData(d);
      }
    }
  });

  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, guildId } = interaction;
    if (!guildId) return;
    
    try {
      let player: any;
      
      switch (commandName) {
        case 'play':
          const query = interaction.options.getString('query', true);
          const member = interaction.member as any;
          const voiceChannel = member?.voice?.channel;

          if (!voiceChannel) {
            await interaction.reply('❌ You need to be in a voice channel!');
            return;
          }

          // Check if Lavalink is ready
          if (!manager.nodeManager.nodes.size || !manager.nodeManager.nodes.values().next().value?.sessionId) {
            await interaction.reply('❌ Music system is not ready yet. Please try again in a moment.');
            return;
          }

          await interaction.deferReply();

          // Create or get Lavalink player
          player = manager.getPlayer(guildId);
          if (!player) {
            player = manager.createPlayer({
              guildId: guildId,
              voiceChannelId: voiceChannel.id,
              textChannelId: interaction.channelId,
              selfDeaf: true,
            });
            await player.connect();
          }

          // Search and play
          const res = await player.search({ query }, interaction.user);
          
          if (!res || !res.tracks || res.tracks.length === 0) {
            await interaction.editReply(`❌ No results found!`);
            return;
          }

          if (res.loadType === 'playlist') {
            await player.queue.add(res.tracks);
            await interaction.editReply(`✅ Added playlist with ${res.tracks.length} tracks!`);
          } else {
            await player.queue.add(res.tracks[0]);
            await interaction.editReply(`✅ Added **${res.tracks[0].info.title}** to the queue!`);
            
            // Refresh recommendations based on this newly added track
            if ((manager as any).refreshRecommendations) {
              await (manager as any).refreshRecommendations(player, res.tracks[0]);
            }
          }

          if (!player.playing) await player.play();
          break;

        case 'genre':
          const genre = interaction.options.getString('genre', true);
          const genreMember = interaction.member as any;
          const genreVoiceChannel = genreMember?.voice?.channel;

          if (!genreVoiceChannel) {
            await interaction.reply('❌ You need to be in a voice channel!');
            return;
          }

          if (!manager.nodeManager.nodes.size || !manager.nodeManager.nodes.values().next().value?.sessionId) {
            await interaction.reply('❌ Music system is not ready yet. Please try again in a moment.');
            return;
          }

          await interaction.deferReply();

          player = manager.getPlayer(guildId);
          if (!player) {
            player = manager.createPlayer({
              guildId: guildId,
              voiceChannelId: genreVoiceChannel.id,
              textChannelId: interaction.channelId,
              selfDeaf: true,
            });
            await player.connect();
          }

          // Search for genre music
          const genreQuery = `${genre} music`;
          const genreRes = await player.search({ query: genreQuery }, interaction.user);
          
          if (!genreRes || !genreRes.tracks || genreRes.tracks.length === 0) {
            await interaction.editReply(`❌ No ${genre} music found!`);
            return;
          }

          await player.queue.add(genreRes.tracks[0]);
          await interaction.editReply(`✅ Playing ${genre} music: **${genreRes.tracks[0].info.title}**`);
          
          // Refresh recommendations based on this genre track
          if ((manager as any).refreshRecommendations) {
            await (manager as any).refreshRecommendations(player, genreRes.tracks[0]);
          }

          if (!player.playing) await player.play();
          break;

        case 'vote':
          player = manager.getPlayer(guildId);
          if (!player || !player.queue.current) {
            await interaction.reply('❌ Nothing is playing!');
            return;
          }

          const voteMember = interaction.member as any;
          const voteChannel = voteMember?.voice?.channel;

          if (!voteChannel) {
            await interaction.reply('❌ You need to be in the voice channel to skip!');
            return;
          }

          const listeners = voteChannel.members.filter((m: any) => !m.user.bot).size;

          // Auto-skip if 1-2 people (no voting needed)
          if (listeners <= 2) {
            if (player.queue.tracks.length === 0) {
              await interaction.reply(`⏭️ Skipped! Queue is empty, stopping playback.`);
              await player.destroy();
            } else {
              skipFlags.set(guildId, true);
              await player.skip();
              await interaction.reply(`⏭️ Skipped!`);
            }
            return;
          }

          // 3+ people: need 2 votes
          if (!skipVotes.has(guildId)) {
            skipVotes.set(guildId, new Set());
          }
          const votes = skipVotes.get(guildId)!;

          if (votes.has(interaction.user.id)) {
            await interaction.reply('❌ You already voted to skip!');
            return;
          }

          votes.add(interaction.user.id);
          const required = 2;

          if (votes.size >= required) {
            votes.clear();
            skipVotes.delete(guildId);
            
            if (player.queue.tracks.length === 0) {
              await interaction.reply(`⏭️ Skipped! Queue is empty, stopping playback.`);
              await player.destroy();
            } else {
              skipFlags.set(guildId, true);
              await player.skip();
              await interaction.reply(`⏭️ Skipped! (${votes.size}/${required} votes)`);
            }
          } else {
            await interaction.reply(`🗳️ Skip vote registered! (${votes.size}/${required} votes needed)`);
          }
          break;

        case 'queue':
          player = manager.getPlayer(guildId);
          if (!player || (!player.queue.current && player.queue.tracks.length === 0)) {
            await interaction.reply('❌ Queue is empty!');
            return;
          }

          const queue = player.queue;
          let queueMsg = '';
          
          if (queue.current) {
            queueMsg += `**Now Playing:**\n${queue.current.info.title}\n\n`;
          }
          
          if (queue.tracks.length > 0) {
            queueMsg += `**Up Next:**\n`;
            queue.tracks.slice(0, 10).forEach((track: any, i: number) => {
              queueMsg += `${i + 1}. ${track.info.title}\n`;
            });
            if (queue.tracks.length > 10) {
              queueMsg += `\n...and ${queue.tracks.length - 10} more`;
            }
          }

          await interaction.reply(queueMsg || 'Queue is empty!');
          break;

        case 'stop':
          player = manager.getPlayer(guildId);
          if (!player) {
            await interaction.reply('❌ Nothing is playing!');
            return;
          }
          await player.destroy();
          await interaction.reply('⏹️ Stopped and disconnected!');
          break;

        case 'suggest':
          await interaction.reply('❌ This command is not yet implemented!');
          break;
      }
    } catch (error) {
      console.error('Command error:', error);
      const reply = { content: '❌ An error occurred!', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply);
      } else {
        await interaction.reply(reply);
      }
    }
  });

  client.login(process.env.DISCORD_TOKEN);
