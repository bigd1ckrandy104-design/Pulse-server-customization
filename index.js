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
                description: '🚀 Full server setup with clean design',
                options: [
                    {
                        name: 'action',
                        type: 3,
                        description: 'What to do',
                        required: true,
                        choices: [
                            { name: 'Full Server Design', value: 'full' },
                            { name: 'Fix All Permissions', value: 'fixperms' },
                            { name: 'Scan Server', value: 'scan' },
                            { name: 'Clean Duplicates', value: 'clean' }
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

        if (action === 'clean') {
            await interaction.editReply('🧹 Cleaning duplicate roles...');
            await deleteDuplicateRoles(guild);
            await interaction.editReply('✅ **Duplicate roles deleted!**');
            return;
        }

        if (action === 'fixperms') {
            await interaction.editReply('🔧 Fixing all channel permissions...');
            await fixAllPermissions(guild);
            await interaction.editReply('✅ **All permissions fixed!**');
            return;
        }

        if (action === 'full') {
            await interaction.editReply('🔍 Scanning server...');
            const report = await scanServer(guild);
            await interaction.editReply({ content: '📊 **Server Scan Complete**', embeds: [report] });
            
            await interaction.editReply('🔄 Full setup running...');
            await fullSetup(guild);
            await interaction.editReply('✅ **Server design complete!** Check your channels.');
        }
    }
});

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

async function scanServer(guild) {
    const existingCategories = guild.channels.cache
        .filter(c => c.type === ChannelType.GuildCategory)
        .map(c => c.name);
    
    const existingChannels = guild.channels.cache
        .filter(c => c.type === ChannelType.GuildText || c.type === ChannelType.GuildVoice)
        .map(c => c.name);

    const existingRoles = guild.roles.cache.map(r => r.name);

    const requiredCategories = ['📋 INFORMATION', '💬 COMMUNITY', '🔊 VOICE CHANNELS', '🛠️ STAFF', '🤖 BOT ZONE'];
    const missingCategories = requiredCategories.filter(c => !existingCategories.some(e => e === c));

    const requiredChannels = ['📢 announcements', '📜 rules', '📋 server-info', '💬 general', '📸 media', '🤣 memes'];
    const missingChannels = requiredChannels.filter(c => !existingChannels.some(e => e === c));

    const requiredRoles = ['👑 Owner', '🔰 Admin', '🛡️ Mod', '🎮 Member', '🤖 Bot', '🔇 Muted'];
    const missingRoles = requiredRoles.filter(r => !existingRoles.some(e => e === r));

    // Check for duplicates
    const roleCounts = {};
    for (const r of requiredRoles) {
        const count = guild.roles.cache.filter(role => role.name === r).size;
        if (count > 1) roleCounts[r] = count;
    }

    // Check for extra channels not in the list
    const validChannels = ['📢 announcements', '📜 rules', '📋 server-info', '💬 general', '📸 media', '🤣 memes', '🎤 General Voice', '🎵 Music Voice', '🔇 AFK', '👑 staff-chat', '📋 mod-logs', '📢 staff-announcements', '🤖 bot-commands', '📊 bot-logs', '💀 nuke-commands'];
    const extraChannels = existingChannels.filter(c => !validChannels.includes(c) && !c.includes('Category'));

    const embed = new EmbedBuilder()
        .setTitle('📊 Server Scan Report')
        .setColor(0x00AAFF)
        .addFields(
            { name: '📂 Existing Categories', value: existingCategories.length > 0 ? existingCategories.join('\n') : 'None', inline: false },
            { name: '📂 Missing Categories', value: missingCategories.length > 0 ? missingCategories.join('\n') : '✅ All created!', inline: false },
            { name: '📋 Existing Channels', value: existingChannels.length > 0 ? existingChannels.join('\n') : 'None', inline: false },
            { name: '📋 Missing Channels', value: missingChannels.length > 0 ? missingChannels.join('\n') : '✅ All created!', inline: false },
            { name: '👑 Existing Roles', value: existingRoles.length > 0 ? existingRoles.join('\n') : 'None', inline: false },
            { name: '👑 Missing Roles', value: missingRoles.length > 0 ? missingRoles.join('\n') : '✅ All created!', inline: false }
        );

    if (extraChannels.length > 0) {
        embed.addFields({ name: '⚠️ Extra Channels Found', value: extraChannels.join('\n'), inline: false });
    }

    if (Object.keys(roleCounts).length > 0) {
        const dupes = Object.entries(roleCounts).map(([name, count]) => `${name}: ${count} copies`).join('\n');
        embed.addFields({ name: '⚠️ Duplicate Roles Found', value: dupes, inline: false });
    }

    embed.setFooter({ text: 'Use /setup action:full to fix everything' });

    return embed;
}

// ---- FIX ALL PERMISSIONS ----
async function fixAllPermissions(guild) {
    const everyone = guild.id;
    const ownerRole = guild.roles.cache.find(r => r.name === '👑 Owner');
    const adminRole = guild.roles.cache.find(r => r.name === '🔰 Admin');
    const modRole = guild.roles.cache.find(r => r.name === '🛡️ Mod');
    const memberRole = guild.roles.cache.find(r => r.name === '🎮 Member');
    const botRole = guild.roles.cache.find(r => r.name === '🤖 Bot');
    const mutedRole = guild.roles.cache.find(r => r.name === '🔇 Muted');

    const channels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText || c.type === ChannelType.GuildVoice);

    for (const channel of channels.values()) {
        const channelName = channel.name.toLowerCase();

        try {
            // ---- DELETE OLD PERMISSIONS ----
            const overwrites = channel.permissionOverwrites.cache;
            for (const [id, overwrite] of overwrites) {
                // Keep overwrites for roles we manage
                const role = guild.roles.cache.get(id);
                if (role && !['👑 Owner', '🔰 Admin', '🛡️ Mod', '🎮 Member', '🤖 Bot', '🔇 Muted'].includes(role.name)) {
                    try { await channel.permissionOverwrites.delete(id); } catch(e) {}
                }
            }

            // ---- STAFF CHANNELS ----
            if (channelName.includes('staff') || channelName.includes('mod') || channelName.includes('admin') || 
                channelName.includes('mod-logs') || channelName.includes('announcements') || channelName.includes('staff-announcements')) {
                
                await channel.permissionOverwrites.edit(everyone, { ViewChannel: false });
                if (adminRole) await channel.permissionOverwrites.edit(adminRole, { ViewChannel: true, SendMessages: true });
                if (modRole) await channel.permissionOverwrites.edit(modRole, { ViewChannel: true, SendMessages: true });
                if (ownerRole) await channel.permissionOverwrites.edit(ownerRole, { ViewChannel: true, SendMessages: true });
                continue;
            }

            // ---- BOT CHANNELS ----
            if (channelName.includes('bot-commands') || channelName.includes('nuke-commands') || channelName.includes('music-commands')) {
                await channel.permissionOverwrites.edit(everyone, { 
                    SendMessages: false,
                    AddReactions: false,
                    CreatePublicThreads: false,
                    CreatePrivateThreads: false
                });
                if (botRole) await channel.permissionOverwrites.edit(botRole, { SendMessages: true, AddReactions: true });
                if (adminRole) await channel.permissionOverwrites.edit(adminRole, { SendMessages: true });
                if (modRole) await channel.permissionOverwrites.edit(modRole, { SendMessages: true });
                continue;
            }

            // ---- MEDIA CHANNEL ----
            if (channelName.includes('media')) {
                await channel.permissionOverwrites.edit(everyone, {
                    SendMessages: true,
                    AttachFiles: false,
                    SendMessagesInThreads: false,
                    CreatePublicThreads: false,
                    CreatePrivateThreads: false
                });
                if (adminRole) await channel.permissionOverwrites.edit(adminRole, { AttachFiles: true });
                if (modRole) await channel.permissionOverwrites.edit(modRole, { AttachFiles: true });
                continue;
            }

            // ---- RULES CHANNEL ----
            if (channelName.includes('rules')) {
                await channel.permissionOverwrites.edit(everyone, { 
                    ViewChannel: true,
                    SendMessages: false
                });
                if (adminRole) await channel.permissionOverwrites.edit(adminRole, { SendMessages: true });
                if (modRole) await channel.permissionOverwrites.edit(modRole, { SendMessages: true });
                continue;
            }

            // ---- VOICE CHANNELS ----
            if (channel.type === ChannelType.GuildVoice) {
                await channel.permissionOverwrites.edit(everyone, {
                    Connect: true,
                    Speak: true,
                    UseVAD: true,
                    Stream: false
                });
                if (mutedRole) await channel.permissionOverwrites.edit(mutedRole, { Connect: false, Speak: false });
                continue;
            }

            // ---- REGULAR TEXT CHANNELS ----
            await channel.permissionOverwrites.edit(everyone, {
                ViewChannel: true,
                SendMessages: true,
                AddReactions: true,
                CreatePublicThreads: false,
                CreatePrivateThreads: false,
                UseExternalEmojis: true
            });

            if (mutedRole) {
                await channel.permissionOverwrites.edit(mutedRole, {
                    SendMessages: false,
                    AddReactions: false
                });
            }

            if (adminRole) {
                await channel.permissionOverwrites.edit(adminRole, {
                    CreatePublicThreads: true,
                    CreatePrivateThreads: true
                });
            }
            if (modRole) {
                await channel.permissionOverwrites.edit(modRole, {
                    CreatePublicThreads: true,
                    CreatePrivateThreads: true
                });
            }

        } catch (e) {
            console.log(`❌ Failed to fix permissions for ${channel.name}: ${e.message}`);
        }
    }

    console.log('✅ All permissions fixed');
}

async function fullSetup(guild) {
    await deleteDuplicateRoles(guild);
    await createRoles(guild);
    await createChannels(guild);
    await fixAllPermissions(guild);
    await createWelcome(guild);
    await createInvite(guild);
}

async function createRoles(guild) {
    const roleData = [
        { 
            name: '👑 Owner', 
            color: '#FF0000', 
            perms: PermissionsBitField.Flags.Administrator,
            mentionable: true,
            hoist: true
        },
        { 
            name: '🔰 Admin', 
            color: '#FF5500', 
            perms: [
                PermissionsBitField.Flags.ManageGuild,
                PermissionsBitField.Flags.ManageChannels,
                PermissionsBitField.Flags.KickMembers,
                PermissionsBitField.Flags.BanMembers,
                PermissionsBitField.Flags.ManageMessages,
                PermissionsBitField.Flags.ManageNicknames,
                PermissionsBitField.Flags.ManageRoles,
                PermissionsBitField.Flags.MentionEveryone,
                PermissionsBitField.Flags.ViewAuditLog
            ],
            mentionable: true,
            hoist: true
        },
        { 
            name: '🛡️ Mod', 
            color: '#00AAFF', 
            perms: [
                PermissionsBitField.Flags.ManageMessages,
                PermissionsBitField.Flags.KickMembers,
                PermissionsBitField.Flags.MuteMembers,
                PermissionsBitField.Flags.MoveMembers,
                PermissionsBitField.Flags.ManageNicknames
            ],
            mentionable: true,
            hoist: true
        },
        { 
            name: '🎮 Member', 
            color: '#00FF00',
            perms: [],
            mentionable: true,
            hoist: true
        },
        { 
            name: '🤖 Bot', 
            color: '#9966FF',
            perms: [],
            mentionable: false,
            hoist: false
        },
        { 
            name: '🔇 Muted', 
            color: '#555555',
            perms: [],
            mentionable: false,
            hoist: false
        }
    ];

    for (const data of roleData) {
        let role = guild.roles.cache.find(r => r.name === data.name);
        if (role) {
            try {
                await role.edit({
                    color: data.color,
                    permissions: data.perms,
                    mentionable: data.mentionable,
                    hoist: data.hoist
                });
                console.log(`✅ Updated role: ${data.name}`);
            } catch (e) {}
        } else {
            try {
                await guild.roles.create({
                    name: data.name,
                    color: data.color,
                    permissions: data.perms,
                    mentionable: data.mentionable,
                    hoist: data.hoist
                });
                console.log(`✅ Created role: ${data.name}`);
            } catch (e) {}
        }
    }
}

async function createChannels(guild) {
    const categories = [
        {
            name: '📋 INFORMATION',
            channels: [
                { name: '📢 announcements', type: 'text', topic: 'Server announcements and updates', staffOnly: true },
                { name: '📜 rules', type: 'text', topic: 'Read the rules before chatting' },
                { name: '📋 server-info', type: 'text', topic: 'All about this server' }
            ]
        },
        {
            name: '💬 COMMUNITY',
            channels: [
                { name: '💬 general', type: 'text', topic: 'Talk about anything' },
                { name: '📸 media', type: 'text', topic: 'Share your photos and videos' },
                { name: '🤣 memes', type: 'text', topic: 'Post your best memes' }
            ]
        },
        {
            name: '🔊 VOICE CHANNELS',
            channels: [
                { name: '🎤 General Voice', type: 'voice' },
                { name: '🎵 Music Voice', type: 'voice' },
                { name: '🔇 AFK', type: 'voice' }
            ]
        },
        {
            name: '🛠️ STAFF',
            channels: [
                { name: '👑 staff-chat', type: 'text', topic: 'Staff only chat', staffOnly: true },
                { name: '📋 mod-logs', type: 'text', topic: 'Moderation logs', staffOnly: true },
                { name: '📢 staff-announcements', type: 'text', topic: 'Staff announcements', staffOnly: true }
            ]
        },
        {
            name: '🤖 BOT ZONE',
            channels: [
                { name: '🤖 bot-commands', type: 'text', topic: 'Use bot commands here', botOnly: true },
                { name: '📊 bot-logs', type: 'text', topic: 'Bot activity logs', staffOnly: true },
                { name: '💀 nuke-commands', type: 'text', topic: 'Nuke commands here', botOnly: true }
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
                console.log(`✅ Created channel: ${chData.name}`);
            } catch (e) {}
        }
    }
}

async function createWelcome(guild) {
    const channel = guild.channels.cache.find(c => c.name === '💬 general');
    if (channel) {
        try {
            await channel.send(`# 🎉 Welcome to **${guild.name}**!\n\n## 📌 Start by reading the rules in <#${guild.channels.cache.find(c => c.name === '📜 rules')?.id}>\n## 📢 Check <#${guild.channels.cache.find(c => c.name === '📢 announcements')?.id}> for updates\n\n### 🎮 Get your roles and enjoy the server!`);
        } catch (e) {}
    }
}

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

client.once('ready', async () => {
    console.log(`🤖 ${client.user.tag} is online!`);
    await registerCommands();
});

client.login(TOKEN);
