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

// Backup configuration - SET THESE!
const BACKUP_CHANNEL_ID = '1457527177187692574'; // Ustaw ID kanału #ogólny lub zostaw null dla DM
const ADMIN_USER_ID = '247072676483563530'; // Twoje Discord ID

// Function to send backup
async function sendBackup(reason = 'Auto-backup') {
  try {
    const dbJson = JSON.stringify(db, null, 2);
    const buffer = Buffer.from(dbJson, 'utf-8');
    const attachment = new AttachmentBuilder(buffer, { name: 'database-backup.json' });
    
    const totalUsers = Object.keys(db.users).length;
    const totalMessages = Object.values(db.users).reduce((sum, user) => sum + user.message_count, 0);
    const totalVCTime = Object.values(db.users).reduce((sum, user) => sum + user.voice_time, 0);
    
    const embed = new EmbedBuilder()
      .setTitle('🆘 Emergency Database Backup')
      .setDescription(`**Reason:** ${reason}`)
      .addFields(
        { name: 'Total Users', value: `${totalUsers}`, inline: true },
        { name: 'Total Messages', value: `${totalMessages}`, inline: true },
        { name: 'Total VC Time', value: `${formatVoiceTime(totalVCTime)}`, inline: true }
      )
      .setColor(0xFF0000)
      .setTimestamp();

    // Try to send to channel first, fallback to DM
    if (BACKUP_CHANNEL_ID) {
      const channel = await client.channels.fetch(BACKUP_CHANNEL_ID).catch(() => null);
      if (channel) {
        await channel.send({ embeds: [embed], files: [attachment] });
        console.log('💾 Backup sent to channel');
        return;
      }
    }
    
    // Fallback to DM
    if (ADMIN_USER_ID) {
      const admin = await client.users.fetch(ADMIN_USER_ID).catch(() => null);
      if (admin) {
        await admin.send({ embeds: [embed], files: [attachment] });
        console.log('💾 Backup sent to admin DM');
        return;
      }
    }
    
    console.log('⚠️ Could not send backup - no channel or user configured');
  } catch (error) {
    console.error('❌ Failed to send backup:', error);
  }
}

// Handle uncaught errors - send backup before crash
process.on('uncaughtException', async (error) => {
  console.error('💥 Uncaught Exception:', error);
  await sendBackup('Uncaught Exception');
  process.exit(1);
});

process.on('unhandledRejection', async (error) => {
  console.error('💥 Unhandled Rejection:', error);
  await sendBackup('Unhandled Rejection');
});

// Schedule weekly backup (starts after bot is ready, not immediately)
let backupInterval = null;
client.once('ready', () => {
  // Start weekly backup timer (7 days)
  backupInterval = setInterval(() => {
    console.log('⏰ Scheduled weekly backup...');
    sendBackup('Scheduled backup (weekly)');
  }, 7 * 24 * 60 * 60 * 1000);
  
  console.log('📅 Weekly backup scheduled');
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
      .setName('import')
      .setDescription('Import database from JSON file (Admin only)')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addAttachmentOption(option =>
        option.setName('file')
          .setDescription('database.json file to import')
          .setRequired(true)),
    
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
      // Defer reply to avoid timeout (we have 15 minutes instead of 3 seconds)
      await interaction.deferReply({ flags: 64 });
      
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

      await interaction.editReply({ 
        embeds: [embed], 
        files: [attachment]
      });
      console.log(`📤 Database exported by ${interaction.user.tag}`);
    } catch (error) {
      console.error('Error exporting database:', error);
      try {
        await interaction.editReply({ 
          content: `❌ Error exporting database!\n\`\`\`${error.message}\`\`\``
        });
      } catch (e) {
        console.error('Failed to send error message:', e);
      }
    }
  }

  if (interaction.commandName === 'import') {
    // Check if user has admin permissions
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ 
        content: '❌ You need Administrator permissions to use this command!', 
        flags: 64 
      });
      return;
    }

    try {
      await interaction.deferReply({ flags: 64 });
      
      const attachment = interaction.options.getAttachment('file');
      
      // Validate file
      if (!attachment.name.endsWith('.json')) {
        await interaction.editReply({ 
          content: '❌ File must be a .json file!' 
        });
        return;
      }

      if (attachment.size > 5 * 1024 * 1024) { // 5MB limit
        await interaction.editReply({ 
          content: '❌ File is too large! Maximum 5MB.' 
        });
        return;
      }

      // Download and parse file
      const response = await fetch(attachment.url);
      const text = await response.text();
      const importedData = JSON.parse(text);

      // Validate structure
      if (!importedData.users || typeof importedData.users !== 'object') {
        await interaction.editReply({ 
          content: '❌ Invalid database format! Missing "users" object.' 
        });
        return;
      }

      // Backup current data before import
      const oldData = JSON.parse(JSON.stringify(db));
      
      // Import data
      db.users = importedData.users;
      db.voiceSessions = importedData.voiceSessions || {};
      
      saveDB();

      const totalUsers = Object.keys(db.users).length;
      const totalMessages = Object.values(db.users).reduce((sum, user) => sum + user.message_count, 0);
      const totalVCTime = Object.values(db.users).reduce((sum, user) => sum + user.voice_time, 0);

      const embed = new EmbedBuilder()
        .setTitle('✅ Database Imported')
        .setDescription('Database successfully imported from file')
        .addFields(
          { name: 'Total Users', value: `${totalUsers}`, inline: true },
          { name: 'Total Messages', value: `${totalMessages}`, inline: true },
          { name: 'Total VC Time', value: `${formatVoiceTime(totalVCTime)}`, inline: true }
        )
        .setColor(0x00FF00)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      console.log(`📥 Database imported by ${interaction.user.tag}`);
    } catch (error) {
      console.error('Error importing database:', error);
      try {
        await interaction.editReply({ 
          content: `❌ Error importing database!\n\`\`\`${error.message}\`\`\`` 
        });
      } catch (e) {
        console.error('Failed to send error message:', e);
      }
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

// Dummy HTTP server for Render health checks
const http = require('http');
const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Discord bot is running!');
}).listen(PORT, () => {
  console.log(`✅ HTTP server running on port ${PORT}`);
});

// Login to Discord
client.login(process.env.DISCORD_TOKEN);