const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes, AttachmentBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
require('dotenv').config();

// Database file path
const DB_PATH = './database.json';

// Initialize database
let db = { 
  users: {},
  voiceSessions: {}
};

// Load database from file (if exists)
if (fs.existsSync(DB_PATH)) {
  try {
    const data = fs.readFileSync(DB_PATH, 'utf8');
    db = JSON.parse(data);
    if (!db.voiceSessions) db.voiceSessions = {};
    console.log('📂 Database loaded');
  } catch (error) {
    console.error('⚠️  Error loading database, creating new one');
  }
}

// Save to file
function saveDB() {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

// Message management functions
function updateMessageCount(userId, username) {
  if (!db.users[userId]) {
    db.users[userId] = {
      username: username,
      message_count: 0,
      voice_time: 0,
      last_message: new Date().toISOString()
    };
  }
  
  db.users[userId].message_count++;
  db.users[userId].username = username;
  db.users[userId].last_message = new Date().toISOString();
  
  saveDB();
  return db.users[userId].message_count;
}

function getUserStats(userId) {
  return db.users[userId] || {
    message_count: 0,
    voice_time: 0
  };
}

function getLeaderboard(type = 'messages') {
  return Object.entries(db.users)
    .map(([id, user]) => user)
    .sort((a, b) => {
      if (type === 'messages') {
        return b.message_count - a.message_count;
      } else {
        return b.voice_time - a.voice_time;
      }
    })
    .slice(0, 10);
}

// VC time management functions
function formatVoiceTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

// Initialize bot
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

// Event: bot ready
client.once('ready', async () => {
  console.log(`✅ Bot logged in as ${client.user.tag}`);
  
  // Register slash commands
  const commands = [
    new SlashCommandBuilder()
      .setName('stats')
      .setDescription('Check your stats!')
      .addUserOption(option =>
        option.setName('user')
          .setDescription('User to check stats for')
          .setRequired(false)),
    
    new SlashCommandBuilder()
      .setName('leaderboard')
      .setDescription('Check the leaderboards!')
      .addStringOption(option =>
        option.setName('type')
          .setDescription('Leaderboard type')
          .setRequired(false)
          .addChoices(
            { name: 'Messages', value: 'messages' },
            { name: 'VC', value: 'voice' }
          )),
    
    new SlashCommandBuilder()
      .setName('export')
      .setDescription('Export database file (Admin only)')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    new SlashCommandBuilder()
      .setName('add')
      .setDescription('Add stats to a user (Admin only)')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addSubcommand(subcommand =>
        subcommand
          .setName('message')
          .setDescription('Add messages to a user')
          .addUserOption(option =>
            option.setName('user')
              .setDescription('User to add messages to')
              .setRequired(true))
          .addIntegerOption(option =>
            option.setName('amount')
              .setDescription('Number of messages to add')
              .setRequired(true)
              .setMinValue(1)))
      .addSubcommand(subcommand =>
        subcommand
          .setName('vc')
          .setDescription('Add VC time to a user')
          .addUserOption(option =>
            option.setName('user')
              .setDescription('User to add VC time to')
              .setRequired(true))
          .addIntegerOption(option =>
            option.setName('seconds')
              .setDescription('Number of seconds to add')
              .setRequired(true)
              .setMinValue(1))),
  ].map(command => command.toJSON());

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  try {
    console.log('🔄 Registering slash commands...');
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands },
    );
    console.log('✅ Slash commands registered!');
  } catch (error) {
    console.error('❌ Error during registration:', error);
  }
});

// Event: new message
client.on('messageCreate', (message) => {
  if (message.author.bot) return;

  try {
    updateMessageCount(message.author.id, message.author.tag);
  } catch (error) {
    console.error('Error updating message counter:', error);
  }
});

// Event: voice state change
client.on('voiceStateUpdate', (oldState, newState) => {
  const userId = newState.id;
  const username = newState.member.user.tag;

  if (!oldState.channelId && newState.channelId) {
    db.voiceSessions[userId] = {
      joinTime: Date.now(),
      username: username
    };
    console.log(`🎤 ${username} joined VC`);
  }
  
  if (oldState.channelId && !newState.channelId) {
    if (db.voiceSessions[userId]) {
      const session = db.voiceSessions[userId];
      const duration = Math.floor((Date.now() - session.joinTime) / 1000);
      
      if (!db.users[userId]) {
        db.users[userId] = {
          username: username,
          message_count: 0,
          voice_time: 0,
          last_message: new Date().toISOString()
        };
      }
      
      db.users[userId].voice_time = (db.users[userId].voice_time || 0) + duration;
      db.users[userId].username = username;
      
      delete db.voiceSessions[userId];
      saveDB();
      
      console.log(`🔇 ${username} left VC (time: ${formatVoiceTime(duration)})`);
    }
  }
  
  if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
    console.log(`🔄 ${username} switched VC channel`);
  }
});

// Slash commands
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'stats') {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const userId = targetUser.id;
    const stats = getUserStats(userId);
    
    const hours = (stats.voice_time / 3600).toFixed(1);

    const embed = new EmbedBuilder()
      .setTitle(`📊 ${targetUser.username} stats`)
      .setDescription(`Messages: **${stats.message_count}**\nVC: **${hours}h**`)
      .setColor(0x0099FF)
      .setThumbnail(targetUser.displayAvatarURL())
      .setFooter({ text: `Requested by: ${interaction.user.username}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  if (interaction.commandName === 'leaderboard') {
    const type = interaction.options.getString('type') || 'messages';
    const results = getLeaderboard(type);

    if (results.length === 0) {
      await interaction.reply('No data');
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(type === 'messages' ? '🏆 Top 10 - Messages' : '🏆 Top 10 - VC')
      .setColor(0xFFD700)
      .setTimestamp();

    const medals = ['🥇', '🥈', '🥉'];
    results.forEach((user, index) => {
      const medal = index < 3 ? medals[index] : `${index + 1}.`;
      const value = type === 'messages' 
        ? `${user.message_count} messages`
        : `${formatVoiceTime(user.voice_time)}`;
      
      embed.addFields({
        name: `${medal} ${user.username}`,
        value: value,
        inline: false,
      });
    });

    await interaction.reply({ embeds: [embed] });
  }

  if (interaction.commandName === 'export') {
    // Check if user has admin permissions
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ 
        content: '❌ You need Administrator permissions to use this command!', 
        flags: 64 
      });
      return;
    }

    try {
      // Export from memory
      const dbJson = JSON.stringify(db, null, 2);
      const buffer = Buffer.from(dbJson, 'utf-8');
      const attachment = new AttachmentBuilder(buffer, { name: 'database.json' });
      
      const totalUsers = Object.keys(db.users).length;
      const totalMessages = Object.values(db.users).reduce((sum, user) => sum + user.message_count, 0);
      const totalVCTime = Object.values(db.users).reduce((sum, user) => sum + user.voice_time, 0);
      
      const embed = new EmbedBuilder()
        .setTitle('📦 Database Export')
        .setDescription('Database file attached below')
        .addFields(
          { name: 'Total Users', value: `${totalUsers}`, inline: true },
          { name: 'Total Messages', value: `${totalMessages}`, inline: true },
          { name: 'Total VC Time', value: `${formatVoiceTime(totalVCTime)}`, inline: true }
        )
        .setColor(0x00FF00)
        .setTimestamp();

      await interaction.reply({ 
        embeds: [embed], 
        files: [attachment], 
        flags: 64
      });
      console.log(`📤 Database exported by ${interaction.user.tag}`);
    } catch (error) {
      console.error('Error exporting database:', error);
      await interaction.reply({ 
        content: `❌ Error exporting database!\n\`\`\`${error.message}\`\`\``, 
        flags: 64
      });
    }
  }

  if (interaction.commandName === 'add') {
    // Check if user has admin permissions
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ 
        content: '❌ You need Administrator permissions to use this command!', 
        flags: 64 
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();
    const targetUser = interaction.options.getUser('user');
    const userId = targetUser.id;

    // Initialize user if doesn't exist
    if (!db.users[userId]) {
      db.users[userId] = {
        username: targetUser.tag,
        message_count: 0,
        voice_time: 0,
        last_message: new Date().toISOString()
      };
    }

    if (subcommand === 'message') {
      const amount = interaction.options.getInteger('amount');
      const oldCount = db.users[userId].message_count;
      db.users[userId].message_count += amount;
      const newCount = db.users[userId].message_count;
      
      saveDB();

      const embed = new EmbedBuilder()
        .setTitle('✅ Messages Added')
        .setDescription(`Added **${amount}** messages to ${targetUser.username}`)
        .addFields(
          { name: 'Before', value: `${oldCount}`, inline: true },
          { name: 'After', value: `${newCount}`, inline: true }
        )
        .setColor(0x00FF00)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      console.log(`➕ ${interaction.user.tag} added ${amount} messages to ${targetUser.tag}`);
    }

    if (subcommand === 'vc') {
      const seconds = interaction.options.getInteger('seconds');
      const oldTime = db.users[userId].voice_time;
      db.users[userId].voice_time += seconds;
      const newTime = db.users[userId].voice_time;
      
      saveDB();

      const embed = new EmbedBuilder()
        .setTitle('✅ VC Time Added')
        .setDescription(`Added **${formatVoiceTime(seconds)}** to ${targetUser.username}`)
        .addFields(
          { name: 'Before', value: formatVoiceTime(oldTime), inline: true },
          { name: 'After', value: formatVoiceTime(newTime), inline: true }
        )
        .setColor(0x00FF00)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      console.log(`➕ ${interaction.user.tag} added ${seconds}s VC time to ${targetUser.tag}`);
    }
  }
});

// Login to Discord
client.login(process.env.DISCORD_TOKEN);