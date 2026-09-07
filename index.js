const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const express = require('express');
const app = express();

const TOKEN = process.env.TOKEN;
const PORT = process.env.PORT || 3000;

if (!TOKEN) {
    console.error('❌ TOKEN environment variable is required!');
    process.exit(1);
}

// ---- ONLY USE BASIC INTENTS - NO PRIVILEGED ONES ----
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ]
});

app.get('/', (req, res) => res.send('✅ Pulse Setup Bot is running!'));
app.listen(PORT, () => console.log(`🌐 Web server on port ${PORT}`));

// ---- COMMAND REGISTRATION ----
async function registerCommands() {
    try {
        await client.application.commands.set([
            {
                name: 'setup',
                description: '🚀 Full server setup with clean design',
                options: [
                    {
                        name: 'action',
                        type: 3,
                        description: 'What to do',
                        required: true,
                        choices: [
                            { name: 'Full Server Design', value: 'full' },
                            { name: 'Create New Channels', value: 'channels' },
                            { name: 'Create Roles', value: 'roles' },
                            { name: 'Scan Server', value: 'scan' }
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

// ---- MAIN COMMAND HANDLER ----
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options } = interaction;

    if (commandName === 'setup') {
        await interaction.deferReply({ ephemeral: true });

        const guild = interaction.guild;
        if (!guild) return interaction.editReply('❌ Run this in a server.');
        
        // Check if bot has admin
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

        if (action === 'full') {
            await interaction.editReply('🔍 Scanning server...');
            const report = await scanServer(guild);
            await interaction.editReply({ content: '📊 **Server Scan Complete**', embeds: [report] });
            
            await interaction.editReply('🔄 Building missing channels and roles...');
            await fullSetup(guild);
            await interaction.editReply('✅ **Server design complete!** Check your channels.');
        } else if (action === 'channels') {
            await interaction.editReply('📂 Creating missing channels...');
            await createChannels(guild);
            await interaction.editReply('✅ **Channels created!**');
        } else if (action === 'roles') {
            await interaction.editReply('📋 Creating missing roles...');
            await createRoles(guild);
            await interaction.editReply('✅ **Roles created!**');
        }
    }
});

// ---- SCAN SERVER ----
async function scanServer(guild) {
    const existingCategories = guild.channels.cache
        .filter(c => c.type === ChannelType.GuildCategory)
        .map(c => c.name);
    
    const existingChannels = guild.channels.cache
        .filter(c => c.type === ChannelType.GuildText || c.type === ChannelType.GuildVoice)
        .map(c => c.name);

    const existingRoles = guild.roles.cache.map(r => r.name);

    const requiredCategories = ['📋 INFORMATION', '💬 COMMUNITY', '🎵 VOICE CHANNELS', '🎉 FUN & EVENTS', '🛠️ STAFF', '🤖 BOT ZONE'];
    const missingCategories = requiredCategories.filter(c => !existingCategories.some(e => e === c));

    const requiredChannels = ['📢 announcements', '📜 rules', '📋 server-info', '💬 general', '📸 media', '🎮 gaming', '💻 tech'];
    const missingChannels = requiredChannels.filter(c => !existingChannels.some(e => e === c));

    const requiredRoles = ['👑 Owner', '🔰 Admin', '🛡️ Mod', '🎮 Member', '🤖 Bot', '🔇 Muted'];
    const missingRoles = requiredRoles.filter(r => !existingRoles.some(e => e === r));

    const embed = new EmbedBuilder()
        .setTitle('📊 Server Scan Report')
        .setColor(0x00AAFF)
        .addFields(
            { name: '📂 Existing Categories', value: existingCategories.length > 0 ? existingCategories.join('\n') : 'None', inline: false },
            { name: '📂 Missing Categories', value: missingCategories.length > 0 ? missingCategories.join('\n') : '✅ All created!', inline: false },
            { name: '📋 Existing Channels', value: existingChannels.length > 0 ? existingChannels.join('\n') : 'None', inline: false },
            { name: '📋 Missing Channels', value: missingChannels.length > 0 ? missingChannels.join('\n') : '✅ All created!', inline: false },
            { name: '👑 Existing Roles', value: existingRoles.length > 0 ? existingRoles.join('\n') : 'None', inline: false },
            { name: '👑 Missing Roles', value: missingRoles.length > 0 ? missingRoles.join('\n') : '✅ All created!', inline: false },
            { name: '📊 Summary', value: `**${missingCategories.length + missingChannels.length + missingRoles.length}** items missing`, inline: true }
        )
        .setFooter({ text: 'Use /setup action:full to fix everything' });

    return embed;
}

// ---- FULL SETUP ----
async function fullSetup(guild) {
    await createRoles(guild);
    await createChannels(guild);
    await createWelcome(guild);
    await createInvite(guild);
}

// ---- CREATE ROLES ----
async function createRoles(guild) {
    const roleData = [
        { name: '👑 Owner', color: '#FF0000', perms: PermissionsBitField.Flags.Administrator },
        { name: '🔰 Admin', color: '#FF5500', perms: PermissionsBitField.Flags.ManageGuild },
        { name: '🛡️ Mod', color: '#00AAFF', perms: PermissionsBitField.Flags.ManageMessages },
        { name: '🎮 Member', color: '#00FF00' },
        { name: '🤖 Bot', color: '#9966FF' },
        { name: '🔇 Muted', color: '#555555' }
    ];

    for (const data of roleData) {
        const existing = guild.roles.cache.find(r => r.name === data.name);
        if (!existing) {
            try {
                await guild.roles.create({
                    name: data.name,
                    color: data.color,
                    permissions: data.perms || []
                });
                console.log(`✅ Created role: ${data.name}`);
            } catch (e) {}
        }
    }
}

// ---- CREATE CHANNELS ----
async function createChannels(guild) {
    const categories = [
        {
            name: '📋 INFORMATION',
            channels: [
                { name: '📢 announcements', type: 'text', topic: 'Server announcements and updates' },
                { name: '📜 rules', type: 'text', topic: 'Read the rules before chatting' },
                { name: '📋 server-info', type: 'text', topic: 'All about this server' }
            ]
        },
        {
            name: '💬 COMMUNITY',
            channels: [
                { name: '💬 general', type: 'text', topic: 'Talk about anything' },
                { name: '📸 media', type: 'text', topic: 'Share your photos and videos' },
                { name: '🎮 gaming', type: 'text', topic: 'Gaming discussions' },
                { name: '💻 tech', type: 'text', topic: 'Tech and programming talk' }
            ]
        },
        {
            name: '🎵 VOICE CHANNELS',
            channels: [
                { name: '🎤 General Voice', type: 'voice' },
                { name: '🎮 Gaming Voice', type: 'voice' },
                { name: '🎵 Music Voice', type: 'voice' },
                { name: '🔇 AFK', type: 'voice' }
            ]
        },
        {
            name: '🎉 FUN & EVENTS',
            channels: [
                { name: '🎉 events', type: 'text', topic: 'Upcoming events and giveaways' },
                { name: '🎲 games', type: 'text', topic: 'Play games and have fun' },
                { name: '📊 polls', type: 'text', topic: 'Vote on things' },
                { name: '🤣 memes', type: 'text', topic: 'Post your best memes' }
            ]
        },
        {
            name: '🛠️ STAFF',
            channels: [
                { name: '👑 staff-chat', type: 'text', topic: 'Staff only chat' },
                { name: '📋 mod-logs', type: 'text', topic: 'Moderation logs' },
                { name: '📢 staff-announcements', type: 'text', topic: 'Staff announcements' }
            ]
        },
        {
            name: '🤖 BOT ZONE',
            channels: [
                { name: '🤖 bot-commands', type: 'text', topic: 'Use bot commands here' },
                { name: '📊 bot-logs', type: 'text', topic: 'Bot activity logs' },
                { name: '🎵 music-commands', type: 'text', topic: 'Music bot commands' }
            ]
        }
    ];

    for (const cat of categories) {
        let category = guild.channels.cache.find(c => c.name === cat.name && c.type === ChannelType.GuildCategory);
        if (!category) {
            try {
                category = await guild.channels.create({
                    name: cat.name,
                    type: ChannelType.GuildCategory
                });
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

                if (chData.name.includes('staff') || chData.name.includes('mod')) {
                    await channel.permissionOverwrites.create(guild.id, { ViewChannel: false });
                    const modRole = guild.roles.cache.find(r => r.name.includes('🛡️ Mod'));
                    if (modRole) {
                        await channel.permissionOverwrites.create(modRole, { ViewChannel: true, SendMessages: true });
                    }
                    const adminRole = guild.roles.cache.find(r => r.name.includes('🔰 Admin'));
                    if (adminRole) {
                        await channel.permissionOverwrites.create(adminRole, { ViewChannel: true, SendMessages: true });
                    }
                }

                if (chData.name.includes('bot-commands')) {
                    await channel.permissionOverwrites.create(guild.id, { SendMessages: false });
                    const botRole = guild.roles.cache.find(r => r.name.includes('🤖 Bot'));
                    if (botRole) {
                        await channel.permissionOverwrites.create(botRole, { SendMessages: true });
                    }
                }
            } catch (e) {}
        }
    }
}

// ---- CREATE WELCOME ----
async function createWelcome(guild) {
    const channel = guild.channels.cache.find(c => c.name === '💬 general');
    if (channel) {
        try {
            await channel.send(`# 🎉 Welcome to **${guild.name}**!\n\n## 📌 Start by reading the rules in <#${guild.channels.cache.find(c => c.name === '📜 rules')?.id}>\n## 📢 Check <#${guild.channels.cache.find(c => c.name === '📢 announcements')?.id}> for updates\n\n### 🎮 Get your roles and enjoy the server!`);
        } catch (e) {}
    }
}

// ---- CREATE INVITE ----
async function createInvite(guild) {
    try {
        const channel = guild.channels.cache.find(c => c.type === ChannelType.GuildText);
        if (channel) {
            await channel.createInvite({
                maxAge: 0,
                maxUses: 0
            });
        }
    } catch (e) {}
}

// ---- BOT STARTUP ----
client.once('ready', async () => {
    console.log(`🤖 ${client.user.tag} is online!`);
    await registerCommands();
});

client.login(TOKEN);
