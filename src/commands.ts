import { Client, REST, Routes, SlashCommandBuilder } from 'discord.js';

const commands = [
  new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a song from Spotify/SoundCloud')
    .addStringOption(option =>
      option.setName('query')
        .setDescription('Song name or URL')
        .setRequired(true)
    ),
  
  new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Skip the current song'),
  
  new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Show the current queue'),
  
  new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop playing and clear the queue'),
  
  new SlashCommandBuilder()
    .setName('vote')
    .setDescription('Vote to skip the current song'),
  
  new SlashCommandBuilder()
    .setName('suggest')
    .setDescription('Suggest a song for voting')
    .addStringOption(option =>
      option.setName('song')
        .setDescription('Song name or URL')
        .setRequired(true)
    ),
].map(command => command.toJSON());

export async function registerCommands(client: Client) {
  if (!client.user) return;

  const rest = new REST().setToken(process.env.DISCORD_TOKEN!);

  try {
    console.log('🔄 Registering slash commands...');
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    console.log('✅ Slash commands registered!');
  } catch (error) {
    console.error('❌ Error registering commands:', error);
  }
}
