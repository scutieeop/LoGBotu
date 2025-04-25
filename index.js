const { Client, GatewayIntentBits, Partials, Collection, Events } = require('discord.js');
const fs = require('fs');
const path = require('path');
const CustomLogs = require('./utils/customLogs');
const Logger = require('./utils/logger');

// JSON yapılandırmalarını yükle
let guildConfig, configData, commandsConfig, webhookConfig;
try {
  guildConfig = JSON.parse(fs.readFileSync('./data/guild.json', 'utf8'));
  console.log('Guild configuration loaded successfully');
} catch (error) {
  console.error('Error loading guild configuration:', error);
  process.exit(1);
}

try {
  configData = JSON.parse(fs.readFileSync('./data/config.json', 'utf8'));
  console.log('Main configuration loaded successfully');
} catch (error) {
  console.error('Error loading main configuration:', error);
  process.exit(1);
}

try {
  commandsConfig = JSON.parse(fs.readFileSync('./data/commands.json', 'utf8'));
  console.log('Commands configuration loaded successfully');
} catch (error) {
  console.error('Error loading commands configuration:', error);
  // Default command config if missing
  commandsConfig = { prefix: ".", usePrefix: true };
}

// Webhook URL'lerini yüklemeyi dene
try {
  webhookConfig = JSON.parse(fs.readFileSync('./data/webhook-urls.json', 'utf8'));
  console.log('Webhook URLs loaded successfully');
  
  // webhookConfig'teki değerleri configData ile birleştir
  if (webhookConfig && webhookConfig.webhooks) {
    configData.webhooks = webhookConfig.webhooks;
  }
} catch (error) {
  console.log('No separate webhook configuration found, using config.json webhooks');
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildBans,
    GatewayIntentBits.GuildEmojisAndStickers,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.User,
    Partials.GuildMember,
    Partials.Reaction
  ]
});

client.config = configData;
client.commandsConfig = commandsConfig;
client.events = new Collection();
client.commands = new Collection();

const loadCommands = () => {
  const commandsPath = path.join(__dirname, 'commands');
  if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      const command = require(filePath);
      if ('name' in command && 'execute' in command) {
        client.commands.set(command.name, command);
        console.log(`Loaded command: ${command.name}`);
      }
    }
  } else {
    fs.mkdirSync(commandsPath);
    console.log(`Created commands directory`);
  }
};

const loadEvents = async () => {
  const eventFolders = fs.readdirSync('./events');
  for (const folder of eventFolders) {
    const eventFiles = fs
      .readdirSync(`./events/${folder}`)
      .filter(file => file.endsWith('.js'));
    for (const file of eventFiles) {
      const event = require(`./events/${folder}/${file}`);
      if (event.once) {
        client.once(event.name, (...args) => event.execute(client, ...args));
      } else {
        client.on(event.name, (...args) => event.execute(client, ...args));
      }
      client.events.set(event.name, event);
      console.log(`Loaded event: ${event.name}`);
    }
  }
};

const initializeLogSystems = async () => {
  // Logger oluştur
  client.logger = new Logger({
    logChannels: client.config.logChannels || {},
    webhooks: client.config.webhooks || {},
    logDir: './logs',
    dailySummaryChannel: client.config.logChannels?.server || null
  });
  
  // Logger'a client'ı ekle
  client.logger.client = client;
  
  // Custom logs sistemini oluştur
  client.customLogs = new CustomLogs(client);
  
  try {
    // Logger ve custom logs sistemlerini başlat
    await client.logger.initialize();
    console.log('Logger system initialized successfully');
    
    await client.customLogs.log('system', {
      severity: 'INFO',
      content: 'Bot started successfully',
      details: {
        uptime: process.uptime(),
        nodeVersion: process.version,
        discordJsVersion: require('discord.js').version,
        guildCount: client.guilds.cache.size
      }
    });
  } catch (error) {
    console.error('Error initializing logging systems:', error);
  }
};

client.on(Events.MessageCreate, async message => {
  if (message.author.bot) return;
  const prefix = client.commandsConfig.prefix || '.';
  
  if (!message.content.startsWith(prefix)) return;

  // Commands disabled check
  if (!client.commandsConfig.usePrefix) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();
  
  // Check if command is disabled
  if (client.commandsConfig.disabledCommands && 
      client.commandsConfig.disabledCommands.includes(commandName)) {
    return message.reply('Bu komut şu anda devre dışı.').catch(console.error);
  }
  
  const command = client.commands.get(commandName);

  if (!command) return;

  // Apply cooldowns if configured
  if (client.commandsConfig.cooldowns) {
    const cooldowns = client.cooldowns || new Collection();
    client.cooldowns = cooldowns;
    
    if (!cooldowns.has(command.name)) {
      cooldowns.set(command.name, new Collection());
    }
    
    const now = Date.now();
    const timestamps = cooldowns.get(command.name);
    const cooldownAmount = (client.commandsConfig.cooldowns[command.name] || client.commandsConfig.cooldowns.default || 3) * 1000;
    
    if (timestamps.has(message.author.id)) {
      const expirationTime = timestamps.get(message.author.id) + cooldownAmount;
      
      if (now < expirationTime) {
        const timeLeft = (expirationTime - now) / 1000;
        return message.reply(`Lütfen bu komutu kullanmadan önce ${timeLeft.toFixed(1)} saniye bekleyin.`);
      }
    }
    
    timestamps.set(message.author.id, now);
    setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);
  }

  const startTime = Date.now();
  try {
    await command.execute(message, args, client);
    if (client.customLogs) {
      const executionTime = Date.now() - startTime;
      client.customLogs.logCommand(
        commandName,
        message.author.id,
        message.guild?.id,
        true,
        executionTime
      );
    }
  } catch (error) {
    console.error(`Error executing command ${commandName}:`, error);
    message.reply('Komutu çalıştırırken bir hata oluştu!').catch(console.error);
    if (client.customLogs) {
      const executionTime = Date.now() - startTime;
      client.customLogs.logCommand(
        commandName,
        message.author.id,
        message.guild?.id,
        false,
        executionTime,
        error
      );
    }
  }
});

client.login(guildConfig.TOKEN).then(async () => {
  console.log('Bot logged in...');
  await loadCommands();
  await loadEvents();
  await initializeLogSystems();
  console.log('Bot is fully ready!');
});

process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
  if (client.customLogs) {
    client.customLogs.logError(error, 'unhandledRejection', null, null);
  }
});

process.on('uncaughtException', error => {
  console.error('Uncaught exception:', error);
  if (client.customLogs) {
    client.customLogs.logError(error, 'uncaughtException', null, null);
  }
});

setInterval(() => {
  const memoryUsage = process.memoryUsage();
  const memoryUsageMB = {
    rss: Math.round(memoryUsage.rss / 1024 / 1024 * 100) / 100,
    heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024 * 100) / 100,
    heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100,
    external: Math.round(memoryUsage.external / 1024 / 1024 * 100) / 100
  };

  if (memoryUsageMB.heapUsed / memoryUsageMB.heapTotal > 0.8 && client.customLogs) {
    client.customLogs.log('performance', {
      severity: 'WARNING',
      content: 'High memory usage detected',
      details: {
        memoryUsage: memoryUsageMB,
        uptime: process.uptime()
      }
    });
  }
}, 300000); 