import { Client, GatewayIntentBits } from 'discord.js';
import { config } from 'dotenv';
import { registerCommands } from './commands';
import { createLavalinkManager } from './music/lavalink-manager';
import { LavalinkManager } from 'lavalink-client';

config();

export let manager: LavalinkManager;

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
    manager = createLavalinkManager(client);
    manager.init({ id: client.user!.id, username: client.user!.username });
    
    registerCommands(client);
  });

  client.on('raw', (d) => {
    if (manager) manager.sendRawData(d);
  });

  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, guildId } = interaction;
    if (!guildId) return;
    
    try {
      let player;
      
      switch (commandName) {
        case 'play':
          const query = interaction.options.getString('query', true);
          const member = interaction.member as any;
          const voiceChannel = member?.voice?.channel;

          if (!voiceChannel) {
            await interaction.reply('❌ You need to be in a voice channel!');
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
              selfDeaf: false,
            });
            await player.connect();
          }

          // Search and play
          const res = await player.search({ query }, interaction.user);
          
          console.log('Search result:', JSON.stringify(res, null, 2));
          
          if (!res || !res.tracks || res.tracks.length === 0) {
            await interaction.editReply(`❌ No results found! Load type: ${res?.loadType || 'unknown'}`);
            return;
          }

          if (res.loadType === 'playlist') {
            await player.queue.add(res.tracks);
            await interaction.editReply(`✅ Added playlist with ${res.tracks.length} tracks!`);
          } else {
            await player.queue.add(res.tracks[0]);
            await interaction.editReply(`✅ Added **${res.tracks[0].info.title}** to the queue!`);
          }

          if (!player.playing) await player.play();
          break;

        case 'skip':
          player = manager.getPlayer(guildId);
          if (!player || !player.queue.current) {
            await interaction.reply('❌ Nothing is playing!');
            return;
          }
          await player.skip();
          await interaction.reply('⏭️ Skipped!');
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
            queue.tracks.slice(0, 10).forEach((track, i) => {
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

        case 'vote':
        case 'suggest':
          await interaction.reply('❌ This command is not yet implemented with Lavalink!');
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
