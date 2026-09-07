const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const express = require('express');
const app = express();

const TOKEN = process.env.TOKEN;
const PORT = process.env.PORT || 3000;

if (!TOKEN) {
    console.error('❌ TOKEN environment variable is required!');
    process.exit(1);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ]
});

app.get('/', (req, res) => res.send('✅ Pulse Setup Bot is running!'));
app.listen(PORT, () => console.log(`🌐 Web server on port ${PORT}`));

async function registerCommands() {
    try {
        await client.application.commands.set([
            {
                name: 'setup',
                description: '🚀 Smart server setup - detects your server type',
                options: [
                    {
                        name: 'action',
                        type: 3,
                        description: 'What to do',
                        required: true,
                        choices: [
                            { name: 'Auto Setup (Detects Server Type)', value: 'auto' },
                            { name: 'Full Setup (Force All)', value: 'full' },
                            { name: 'Scan Server', value: 'scan' },
                            { name: 'Fix Permissions', value: 'fixperms' }
                        ]
                    }
                ]
            }
        ]);
        console.log('✅ Commands registered');
    } catch (error) {
        console.error('Failed to register commands:', error);
    }
}

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options } = interaction;

    if (commandName === 'setup') {
        await interaction.deferReply({ ephemeral: true });

        const guild = interaction.guild;
        if (!guild) return interaction.editReply('❌ Run this in a server.');
        
        const botMember = guild.members.cache.get(client.user.id);
        if (!botMember || !botMember.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.editReply('❌ I need **Administrator** permissions.');
        }

        const action = options.getString('action');

        if (action === 'scan') {
            const report = await scanServer(guild);
            await interaction.editReply({ embeds: [report] });
            return;
        }

        if (action === 'fixperms') {
            await interaction.editReply('🔧 Fixing all channel permissions...');
            await fixAllPermissions(guild);
            await interaction.editReply('✅ **All permissions fixed!**');
            return;
        }

        if (action === 'auto') {
            await interaction.editReply('🔍 Detecting server type...');
            const serverType = await detectServerType(guild);
            await interaction.editReply(`📊 **Server Type Detected:** \`${serverType}\``);
            
            await interaction.editReply(`🔄 Running ${serverType} setup...`);
            await autoSetup(guild, serverType);
            await interaction.editReply(`✅ **${serverType} setup complete!**`);
            return;
        }

        if (action === 'full') {
            await interaction.editReply('🔍 Scanning server...');
            const report = await scanServer(guild);
            await interaction.editReply({ content: '📊 **Server Scan Complete**', embeds: [report] });
            
            await interaction.editReply('🔄 Full setup running...');
            await fullSetup(guild);
            await interaction.editReply('✅ **Full setup complete!**');
        }
    }
});

// ---- DETECT SERVER TYPE ----
async function detectServerType(guild) {
    const memberCount = guild.members.cache.size;
    const botCount = guild.members.cache.filter(m => m.user.bot).size;
    const humanCount = memberCount - botCount;
    
    const channelNames = guild.channels.cache.map(c => c.name.toLowerCase());
    const categoryNames = guild.channels.cache
        .filter(c => c.type === ChannelType.GuildCategory)
        .map(c => c.name.toLowerCase());
    
    const roleNames = guild.roles.cache.map(r => r.name.toLowerCase());
    const serverName = guild.name.toLowerCase();

    let scores = {
        nuke: 0,
        gaming: 0,
        support: 0,
        music: 0,
        events: 0,
        leveling: 0,
        community: 0,
        small: 0
    };

    const nukeKeywords = ['nuke', 'raid', 'destroy', 'pulse', 'hades', 'wipe', 'kill', 'crash', 'trash', 'owned'];
    for (const word of nukeKeywords) {
        if (serverName.includes(word)) scores.nuke += 5;
        if (channelNames.some(c => c.includes(word))) scores.nuke += 3;
        if (categoryNames.some(c => c.includes(word))) scores.nuke += 4;
        if (roleNames.some(r => r.includes(word))) scores.nuke += 2;
    }

    if (channelNames.some(c => c.includes('nuke') || c.includes('raid') || c.includes('destroy'))) scores.nuke += 5;
    if (channelNames.some(c => c.includes('pulse'))) scores.nuke += 4;
    if (serverName.includes('nuke') || serverName.includes('pulse')) scores.nuke += 3;

    const gamingKeywords = ['gaming', 'game', 'play', 'lfg', 'clips', 'tournament', 'esports', 'gamer', 'stream'];
    for (const word of gamingKeywords) {
        if (serverName.includes(word)) scores.gaming += 3;
        if (channelNames.some(c => c.includes(word))) scores.gaming += 2;
        if (categoryNames.some(c => c.includes(word))) scores.gaming += 3;
    }

    const supportKeywords = ['support', 'ticket', 'help', 'faq', 'question', 'assistance'];
    for (const word of supportKeywords) {
        if (serverName.includes(word)) scores.support += 3;
        if (channelNames.some(c => c.includes(word))) scores.support += 2;
        if (categoryNames.some(c => c.includes(word))) scores.support += 3;
    }

    const musicKeywords = ['music', 'song', 'playlist', 'radio', 'dj'];
    for (const word of musicKeywords) {
        if (serverName.includes(word)) scores.music += 3;
        if (channelNames.some(c => c.includes(word))) scores.music += 2;
        if (categoryNames.some(c => c.includes(word))) scores.music += 3;
    }

    const eventsKeywords = ['event', 'giveaway', 'contest', 'competition', 'tournament'];
    for (const word of eventsKeywords) {
        if (serverName.includes(word)) scores.events += 2;
        if (channelNames.some(c => c.includes(word))) scores.events += 2;
        if (categoryNames.some(c => c.includes(word))) scores.events += 3;
    }

    if (channelNames.some(c => c.includes('level') || c.includes('xp') || c.includes('rank'))) scores.leveling += 5;
    if (roleNames.some(r => r.includes('level') || r.includes('rank'))) scores.leveling += 3;

    if (humanCount > 50) scores.community += 3;
    if (humanCount > 100) scores.community += 5;
    if (humanCount > 200) scores.community += 8;
    if (serverName.includes('community') || serverName.includes('hub') || serverName.includes('group')) scores.community += 3;

    if (humanCount < 10) scores.small += 5;
    if (humanCount < 5) scores.small += 8;

    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const top = sorted[0];

    if (top[1] > 0) {
        switch (top[0]) {
            case 'nuke': return 'Nuke Bot Server';
            case 'gaming': return 'Gaming Community';
            case 'support': return 'Support Server';
            case 'music': return 'Music Server';
            case 'events': return 'Events Server';
            case 'leveling': return 'Leveling Server';
            case 'community': return 'Large Community';
            case 'small': return 'Small Server';
            default: return 'Balanced Server';
        }
    }

    if (humanCount > 100) return 'Large Community';
    if (humanCount < 10) return 'Small Server';
    
    return 'Balanced Server';
}

// ---- AUTO SETUP ----
async function autoSetup(guild, serverType) {
    await deleteDuplicateRoles(guild);
    await createRoles(guild);

    let categories = [];

    switch (serverType) {
        case 'Nuke Bot Server':
            categories = getNukeServerLayout();
            break;
        case 'Gaming Community':
            categories = getGamingServerLayout();
            break;
        case 'Support Server':
            categories = getSupportServerLayout();
            break;
        case 'Music Server':
            categories = getMusicServerLayout();
            break;
        case 'Large Community':
            categories = getLargeCommunityLayout();
            break;
        case 'Events Server':
            categories = getEventsServerLayout();
            break;
        case 'Leveling Server':
            categories = getLevelingServerLayout();
            break;
        case 'Small Server':
        default:
            categories = getBalancedLayout();
            break;
    }

    await createChannels(guild, categories);
    await fixAllPermissions(guild);
    await createWelcome(guild, serverType);
    await createInvite(guild);
}

// ---- LAYOUTS ----

function getNukeServerLayout() {
    return [
        {
            name: '📢 INFORMATION',
            channels: [
                { name: '📢 announcements', type: 'text', topic: 'Server announcements', staffOnly: true },
                { name: '📜 rules', type: 'text', topic: 'Rules before using' },
                { name: '📋 server-info', type: 'text', topic: 'About this server' }
            ]
        },
        {
            name: '💬 COMMUNITY',
            channels: [
                { name: '💬 general', type: 'text', topic: 'Chat here' },
                { name: '📸 media', type: 'text', topic: 'Share media' },
                { name: '🤣 memes', type: 'text', topic: 'Post memes' }
            ]
        },
        {
            name: '🤖 BOT ZONE',
            channels: [
                { name: '🤖 N4ke-Bot', type: 'text', topic: 'N4ke-Bot commands', botOnly: true },
                { name: '🤖 bot-commands', type: 'text', topic: 'Other bot commands', botOnly: true },
                { name: '📊 bot-logs', type: 'text', topic: 'Bot logs', staffOnly: true }
            ]
        },
        {
            name: '🛠️ STAFF',
            channels: [
                { name: '👑 staff-chat', type: 'text', topic: 'Staff only', staffOnly: true },
                { name: '📋 mod-logs', type: 'text', topic: 'Moderation logs', staffOnly: true }
            ]
        },
        {
            name: '🔊 VOICE CHANNELS',
            channels: [
                { name: '🎤 General Voice', type: 'voice' },
                { name: '🔇 AFK', type: 'voice' }
            ]
        }
    ];
}

function getGamingServerLayout() {
    return [
        {
            name: '📢 INFORMATION',
            channels: [
                { name: '📢 announcements', type: 'text', topic: 'Server announcements', staffOnly: true },
                { name: '📜 rules', type: 'text', topic: 'Read before playing' },
                { name: '📋 server-info', type: 'text', topic: 'All about the server' }
            ]
        },
        {
            name: '🎮 GAMING',
            channels: [
                { name: '💬 general', type: 'text', topic: 'Chat about games' },
                { name: '🎮 lfg', type: 'text', topic: 'Find players' },
                { name: '📸 clips', type: 'text', topic: 'Share gameplay clips' },
                { name: '🤣 memes', type: 'text', topic: 'Gaming memes' }
            ]
        },
        {
            name: '🤖 BOT ZONE',
            channels: [
                { name: '🤖 N4ke-Bot', type: 'text', topic: 'N4ke-Bot commands', botOnly: true },
                { name: '🤖 bot-commands', type: 'text', topic: 'Other bot commands', botOnly: true }
            ]
        },
        {
            name: '🛠️ STAFF',
            channels: [
                { name: '👑 staff-chat', type: 'text', topic: 'Staff only', staffOnly: true },
                { name: '📋 mod-logs', type: 'text', topic: 'Moderation logs', staffOnly: true }
            ]
        },
        {
            name: '🔊 VOICE CHANNELS',
            channels: [
                { name: '🎤 General Voice', type: 'voice' },
                { name: '🎮 Gaming Voice', type: 'voice' },
                { name: '🔇 AFK', type: 'voice' }
            ]
        }
    ];
}

function getSupportServerLayout() {
    return [
        {
            name: '📢 INFORMATION',
            channels: [
                { name: '📢 announcements', type: 'text', topic: 'Announcements', staffOnly: true },
                { name: '📜 rules', type: 'text', topic: 'Support rules' },
                { name: '📋 server-info', type: 'text', topic: 'About this server' }
            ]
        },
        {
            name: '🎫 SUPPORT',
            channels: [
                { name: '💬 general', type: 'text', topic: 'General chat' },
                { name: '🎫 create-ticket', type: 'text', topic: 'React to create a ticket' },
                { name: '📊 ticket-logs', type: 'text', topic: 'Ticket logs', staffOnly: true }
            ]
        },
        {
            name: '🤖 BOT ZONE',
            channels: [
                { name: '🤖 N4ke-Bot', type: 'text', topic: 'N4ke-Bot commands', botOnly: true },
                { name: '🤖 bot-commands', type: 'text', topic: 'Bot commands', botOnly: true }
            ]
        },
        {
            name: '🛠️ STAFF',
            channels: [
                { name: '👑 staff-chat', type: 'text', topic: 'Staff only', staffOnly: true },
                { name: '📋 mod-logs', type: 'text', topic: 'Moderation logs', staffOnly: true }
            ]
        },
        {
            name: '🔊 VOICE CHANNELS',
            channels: [
                { name: '🎤 Support Voice', type: 'voice' }
            ]
        }
    ];
}

function getMusicServerLayout() {
    return [
        {
            name: '📢 INFORMATION',
            channels: [
                { name: '📢 announcements', type: 'text', topic: 'Announcements', staffOnly: true },
                { name: '📜 rules', type: 'text', topic: 'Music server rules' }
            ]
        },
        {
            name: '🎵 MUSIC',
            channels: [
                { name: '💬 general', type: 'text', topic: 'Music chat' },
                { name: '🎵 now-playing', type: 'text', topic: 'Currently playing' },
                { name: '📸 media', type: 'text', topic: 'Share music media' }
            ]
        },
        {
            name: '🤖 BOT ZONE',
            channels: [
                { name: '🤖 N4ke-Bot', type: 'text', topic: 'N4ke-Bot commands', botOnly: true },
                { name: '🎵 music-commands', type: 'text', topic: 'Music bot commands', botOnly: true },
                { name: '🤖 bot-commands', type: 'text', topic: 'Other bot commands', botOnly: true }
            ]
        },
        {
            name: '🛠️ STAFF',
            channels: [
                { name: '👑 staff-chat', type: 'text', topic: 'Staff only', staffOnly: true },
                { name: '📋 mod-logs', type: 'text', topic: 'Moderation logs', staffOnly: true }
            ]
        },
        {
            name: '🔊 VOICE CHANNELS',
            channels: [
                { name: '🎵 Music Voice', type: 'voice' },
                { name: '🎤 General Voice', type: 'voice' }
            ]
        }
    ];
}

function getLargeCommunityLayout() {
    return [
        {
            name: '📢 INFORMATION',
            channels: [
                { name: '📢 announcements', type: 'text', topic: 'Server announcements', staffOnly: true },
                { name: '📜 rules', type: 'text', topic: 'Community rules' },
                { name: '📋 server-info', type: 'text', topic: 'All about the server' }
            ]
        },
        {
            name: '💬 COMMUNITY',
            channels: [
                { name: '💬 general', type: 'text', topic: 'Chat about anything' },
                { name: '📸 media', type: 'text', topic: 'Share photos and videos' },
                { name: '🤣 memes', type: 'text', topic: 'Memes' },
                { name: '💻 tech', type: 'text', topic: 'Tech discussions' }
            ]
        },
        {
            name: '🎉 EVENTS',
            channels: [
                { name: '🎉 events', type: 'text', topic: 'Upcoming events' },
                { name: '📊 polls', type: 'text', topic: 'Community polls' }
            ]
        },
        {
            name: '🤖 BOT ZONE',
            channels: [
                { name: '🤖 N4ke-Bot', type: 'text', topic: 'N4ke-Bot commands', botOnly: true },
                { name: '🤖 bot-commands', type: 'text', topic: 'Bot commands', botOnly: true }
            ]
        },
        {
            name: '🛠️ STAFF',
            channels: [
                { name: '👑 staff-chat', type: 'text', topic: 'Staff only', staffOnly: true },
                { name: '📋 mod-logs', type: 'text', topic: 'Moderation logs', staffOnly: true }
            ]
        },
        {
            name: '🔊 VOICE CHANNELS',
            channels: [
                { name: '🎤 General Voice', type: 'voice' },
                { name: '🎵 Music Voice', type: 'voice' },
                { name: '🔇 AFK', type: 'voice' }
            ]
        }
    ];
}

function getEventsServerLayout() {
    return [
        {
            name: '📢 INFORMATION',
            channels: [
                { name: '📢 announcements', type: 'text', topic: 'Event announcements', staffOnly: true },
                { name: '📜 rules', type: 'text', topic: 'Event rules' }
            ]
        },
        {
            name: '🎉 EVENTS',
            channels: [
                { name: '💬 general', type: 'text', topic: 'Chat' },
                { name: '🎉 upcoming-events', type: 'text', topic: 'Upcoming events' },
                { name: '🏆 event-results', type: 'text', topic: 'Event winners' },
                { name: '📊 polls', type: 'text', topic: 'Vote on events' }
            ]
        },
        {
            name: '🤖 BOT ZONE',
            channels: [
                { name: '🤖 N4ke-Bot', type: 'text', topic: 'N4ke-Bot commands', botOnly: true },
                { name: '🤖 bot-commands', type: 'text', topic: 'Bot commands', botOnly: true }
            ]
        },
        {
            name: '🛠️ STAFF',
            channels: [
                { name: '👑 staff-chat', type: 'text', topic: 'Staff only', staffOnly: true },
                { name: '📋 mod-logs', type: 'text', topic: 'Moderation logs', staffOnly: true }
            ]
        },
        {
            name: '🔊 VOICE CHANNELS',
            channels: [
                { name: '🎤 Event Voice', type: 'voice' }
            ]
        }
    ];
}

function getLevelingServerLayout() {
    return [
        {
            name: '📢 INFORMATION',
            channels: [
                { name: '📢 announcements', type: 'text', topic: 'Announcements', staffOnly: true },
                { name: '📜 rules', type: 'text', topic: 'Server rules' },
                { name: '📊 leaderboard', type: 'text', topic: 'Level leaderboards' }
            ]
        },
        {
            name: '💬 CHAT',
            channels: [
                { name: '💬 general', type: 'text', topic: 'Chat and level up' },
                { name: '📸 media', type: 'text', topic: 'Share media' },
                { name: '🎵 music-requests', type: 'text', topic: 'Request music' }
            ]
        },
        {
            name: '🤖 BOT ZONE',
            channels: [
                { name: '🤖 N4ke-Bot', type: 'text', topic: 'N4ke-Bot commands', botOnly: true },
                { name: '🤖 bot-commands', type: 'text', topic: 'Bot commands', botOnly: true }
            ]
        },
        {
            name: '🛠️ STAFF',
            channels: [
                { name: '👑 staff-chat', type: 'text', topic: 'Staff only', staffOnly: true },
                { name: '📋 mod-logs', type: 'text', topic: 'Moderation logs', staffOnly: true }
            ]
        },
        {
            name: '🔊 VOICE CHANNELS',
            channels: [
                { name: '🎤 General Voice', type: 'voice' },
                { name: '🎵 Music Voice', type: 'voice' }
            ]
        }
    ];
}

function getBalancedLayout() {
    return [
        {
            name: '📢 INFORMATION',
            channels: [
                { name: '📢 announcements', type: 'text', topic: 'Server announcements', staffOnly: true },
                { name: '📜 rules', type: 'text', topic: 'Read the rules' },
                { name: '📋 server-info', type: 'text', topic: 'About this server' }
            ]
        },
        {
            name: '💬 COMMUNITY',
            channels: [
                { name: '💬 general', type: 'text', topic: 'Chat here' },
                { name: '📸 media', type: 'text', topic: 'Share media' },
                { name: '🤣 memes', type: 'text', topic: 'Memes' }
            ]
        },
        {
            name: '🤖 BOT ZONE',
            channels: [
                { name: '🤖 N4ke-Bot', type: 'text', topic: 'N4ke-Bot commands', botOnly: true },
                { name: '🤖 bot-commands', type: 'text', topic: 'Bot commands', botOnly: true }
            ]
        },
        {
            name: '🛠️ STAFF',
            channels: [
                { name: '👑 staff-chat', type: 'text', topic: 'Staff only', staffOnly: true },
                { name: '📋 mod-logs', type: 'text', topic: 'Moderation logs', staffOnly: true }
            ]
        },
        {
            name: '🔊 VOICE CHANNELS',
            channels: [
                { name: '🎤 General Voice', type: 'voice' },
                { name: '🎵 Music Voice', type: 'voice' },
                { name: '🔇 AFK', type: 'voice' }
            ]
        }
    ];
}

// ---- DELETE DUPLICATE ROLES ----
async function deleteDuplicateRoles(guild) {
    const roleNames = ['👑 Owner', '🔰 Admin', '🛡️ Mod', '🎮 Member', '🤖 Bot', '🔇 Muted'];
    
    for (const name of roleNames) {
        const matchingRoles = guild.roles.cache.filter(r => r.name === name);
        if (matchingRoles.size > 1) {
            const keepRole = matchingRoles.first();
            const toDelete = matchingRoles.filter(r => r.id !== keepRole.id);
            for (const role of toDelete.values()) {
                try {
                    await role.delete();
                    console.log(`🗑️ Deleted duplicate role: ${role.name}`);
                } catch (e) {}
            }
        }
    }
}

// ---- SCAN SERVER ----
async function scanServer(guild) {
    const serverType = await detectServerType(guild);
    const existingCategories = guild.channels.cache
        .filter(c => c.type === ChannelType.GuildCategory)
        .map(c => c.name);
    
    const existingChannels = guild.channels.cache
        .filter(c => c.type === ChannelType.GuildText || c.type === ChannelType.GuildVoice)
        .map(c => c.name);

    const existingRoles = guild.roles.cache.map(r => r.name);

    const requiredRoles = ['👑 Owner', '🔰 Admin', '🛡️ Mod', '🎮 Member', '🤖 Bot', '🔇 Muted'];
    const missingRoles = requiredRoles.filter(r => !existingRoles.some(e => e === r));

    const embed = new EmbedBuilder()
        .setTitle('📊 Server Scan Report')
        .setColor(0x00AAFF)
        .addFields(
            { name: '🔍 Detected Server Type', value: `\`${serverType}\``, inline: false },
            { name: '📂 Categories', value: existingCategories.length > 0 ? existingCategories.join('\n') : 'None', inline: false },
            { name: '📋 Channels', value: existingChannels.length > 0 ? existingChannels.join('\n') : 'None', inline: false },
            { name: '👑 Roles', value: existingRoles.length > 0 ? existingRoles.join('\n') : 'None', inline: false },
            { name: '👑 Missing Roles', value: missingRoles.length > 0 ? missingRoles.join('\n') : '✅ All set!', inline: false }
        )
        .setFooter({ text: 'Use /setup action:auto for automatic setup based on server type!' });

    return embed;
}

// ---- FIX ALL PERMISSIONS ----
async function fixAllPermissions(guild) {
    const everyone = guild.id;
    const ownerRole = guild.roles.cache.find(r => r.name === '👑 Owner');
    const adminRole = guild.roles.cache.find(r => r.name === '🔰 Admin');
    const modRole = guild.roles.cache.find(r => r.name === '🛡️ Mod');
    const botRole = guild.roles.cache.find(r => r.name === '🤖 Bot');
    const mutedRole = guild.roles.cache.find(r => r.name === '🔇 Muted');

    const channels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText || c.type === ChannelType.GuildVoice);

    for (const channel of channels.values()) {
        const channelName = channel.name.toLowerCase();

        try {
            // Delete old permission overwrites
            const overwrites = channel.permissionOverwrites.cache;
            for (const [id, overwrite] of overwrites) {
                const role = guild.roles.cache.get(id);
                if (role && !['👑 Owner', '🔰 Admin', '🛡️ Mod', '🎮 Member', '🤖 Bot', '🔇 Muted'].includes(role.name)) {
                    try { await channel.permissionOverwrites.delete(id); } catch(e) {}
                }
            }

            // Staff channels
            if (channelName.includes('staff') || channelName.includes('mod') || channelName.includes('admin') || 
                channelName.includes('mod-logs') || channelName.includes('announcements') || channelName.includes('staff-announcements')) {
                await channel.permissionOverwrites.edit(everyone, { ViewChannel: false });
                if (adminRole) await channel.permissionOverwrites.edit(adminRole, { ViewChannel: true, SendMessages: true });
                if (modRole) await channel.permissionOverwrites.edit(modRole, { ViewChannel: true, SendMessages: true });
                if (ownerRole) await channel.permissionOverwrites.edit(ownerRole, { ViewChannel: true, SendMessages: true });
                continue;
            }

            // Bot channels - only bots can send
            if (channelName.includes('n4ke-bot') || channelName.includes('bot-commands') || channelName.includes('music-commands')) {
                await channel.permissionOverwrites.edit(everyone, { SendMessages: false, AddReactions: false });
                if (botRole) await channel.permissionOverwrites.edit(botRole, { SendMessages: true, AddReactions: true });
                if (adminRole) await channel.permissionOverwrites.edit(adminRole, { SendMessages: true });
                if (modRole) await channel.permissionOverwrites.edit(modRole, { SendMessages: true });
                continue;
            }

            // Media channels - no attachments
            if (channelName.includes('media')) {
                await channel.permissionOverwrites.edit(everyone, { SendMessages: true, AttachFiles: false });
                if (adminRole) await channel.permissionOverwrites.edit(adminRole, { AttachFiles: true });
                if (modRole) await channel.permissionOverwrites.edit(modRole, { AttachFiles: true });
                continue;
            }

            // Rules channel - everyone can view, only staff can send
            if (channelName.includes('rules')) {
                await channel.permissionOverwrites.edit(everyone, { ViewChannel: true, SendMessages: false });
                if (adminRole) await channel.permissionOverwrites.edit(adminRole, { SendMessages: true });
                if (modRole) await channel.permissionOverwrites.edit(modRole, { SendMessages: true });
                continue;
            }

            // Voice channels
            if (channel.type === ChannelType.GuildVoice) {
                await channel.permissionOverwrites.edit(everyone, { Connect: true, Speak: true, Stream: false });
                if (mutedRole) await channel.permissionOverwrites.edit(mutedRole, { Connect: false, Speak: false });
                continue;
            }

            // Regular text channels - everyone can send
            await channel.permissionOverwrites.edit(everyone, {
                ViewChannel: true,
                SendMessages: true,
                AddReactions: true,
                CreatePublicThreads: false,
                CreatePrivateThreads: false,
                UseExternalEmojis: true
            });

            if (mutedRole) {
                await channel.permissionOverwrites.edit(mutedRole, { SendMessages: false, AddReactions: false });
            }

        } catch (e) {
            console.log(`❌ Failed to fix ${channel.name}: ${e.message}`);
        }
    }

    console.log('✅ All permissions fixed');
}

// ---- CREATE ROLES ----
async function createRoles(guild) {
    const roleData = [
        { name: '👑 Owner', color: '#FF0000', perms: PermissionsBitField.Flags.Administrator, mentionable: true, hoist: true },
        { name: '🔰 Admin', color: '#FF5500', perms: [PermissionsBitField.Flags.ManageGuild, PermissionsBitField.Flags.ManageChannels, PermissionsBitField.Flags.KickMembers, PermissionsBitField.Flags.BanMembers, PermissionsBitField.Flags.ManageMessages, PermissionsBitField.Flags.ManageNicknames, PermissionsBitField.Flags.ManageRoles, PermissionsBitField.Flags.MentionEveryone, PermissionsBitField.Flags.ViewAuditLog], mentionable: true, hoist: true },
        { name: '🛡️ Mod', color: '#00AAFF', perms: [PermissionsBitField.Flags.ManageMessages, PermissionsBitField.Flags.KickMembers, PermissionsBitField.Flags.MuteMembers, PermissionsBitField.Flags.MoveMembers, PermissionsBitField.Flags.ManageNicknames], mentionable: true, hoist: true },
        { name: '🎮 Member', color: '#00FF00', perms: [], mentionable: true, hoist: true },
        { name: '🤖 Bot', color: '#9966FF', perms: [], mentionable: false, hoist: false },
        { name: '🔇 Muted', color: '#555555', perms: [], mentionable: false, hoist: false }
    ];

    for (const data of roleData) {
        let role = guild.roles.cache.find(r => r.name === data.name);
        if (role) {
            try {
                await role.edit({ color: data.color, permissions: data.perms, mentionable: data.mentionable, hoist: data.hoist });
                console.log(`✅ Updated role: ${data.name}`);
            } catch (e) {}
        } else {
            try {
                await guild.roles.create({ name: data.name, color: data.color, permissions: data.perms, mentionable: data.mentionable, hoist: data.hoist });
                console.log(`✅ Created role: ${data.name}`);
            } catch (e) {}
        }
    }
}

// ---- CREATE CHANNELS ----
async function createChannels(guild, categories) {
    for (const cat of categories) {
        let category = guild.channels.cache.find(c => c.name === cat.name && c.type === ChannelType.GuildCategory);
        if (!category) {
            try {
                category = await guild.channels.create({ name: cat.name, type: ChannelType.GuildCategory });
                console.log(`✅ Created category: ${cat.name}`);
            } catch (e) { continue; }
        }

        for (const chData of cat.channels) {
            const exists = guild.channels.cache.find(c => c.name === chData.name);
            if (exists) continue;

            try {
                const channel = await guild.channels.create({
                    name: chData.name,
                    type: chData.type === 'voice' ? ChannelType.GuildVoice : ChannelType.GuildText,
                    parent: category.id,
                    topic: chData.topic || ''
                });
                console.log(`✅ Created channel: ${chData.name}`);
            } catch (e) {}
        }
    }
}

// ---- CREATE WELCOME ----
async function createWelcome(guild, serverType) {
    const channel = guild.channels.cache.find(c => c.name === '💬 general');
    if (channel) {
        try {
            await channel.send(`# 🎉 Welcome to **${guild.name}**!\n\n## 📊 Server Type: \`${serverType}\`\n\n## 📌 Read the rules in <#${guild.channels.cache.find(c => c.name === '📜 rules')?.id}>\n## 📢 Check <#${guild.channels.cache.find(c => c.name === '📢 announcements')?.id}> for updates\n\n### Enjoy your stay!`);
        } catch (e) {}
    }
}

// ---- CREATE INVITE ----
async function createInvite(guild) {
    try {
        const channel = guild.channels.cache.find(c => c.type === ChannelType.GuildText);
        if (channel) {
            await channel.createInvite({ maxAge: 0, maxUses: 0 });
        }
    } catch (e) {}
}

// ---- FULL SETUP ----
async function fullSetup(guild) {
    const serverType = await detectServerType(guild);
    await autoSetup(guild, serverType);
}

// ---- BOT STARTUP ----
client.once('ready', async () => {
    console.log(`🤖 ${client.user.tag} is online!`);
    await registerCommands();
});

client.login(TOKEN);
