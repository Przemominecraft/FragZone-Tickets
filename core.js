const { Client, GatewayIntentBits, Collection, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField, ModalBuilder, TextInputBuilder, TextInputStyle, InteractionType } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

const TOKEN = process.env.DISCORD_TOKEN;
const CATEGORY_ID = '1474735192064131082';

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers
    ] 
});

// --- ŁADOWANIE KOMEND ---
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');

if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        }
    }
}

// Funkcja do pobierania konfiguracji
function getConfig() {
    const configPath = path.join(__dirname, 'config.json');
    if (!fs.existsSync(configPath)) return {};
    try {
        return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (e) {
        return {};
    }
}

client.once('ready', () => {
    console.log(`✅ FragZone Pro Tickets Online!`);
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try { 
        await command.execute(interaction); 
    } catch (e) { 
        console.error(e); 
    }
});

// --- SYSTEM TICKETÓW ---
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton() && interaction.type !== InteractionType.ModalSubmit) return;

    const config = getConfig();
    const staffRole = config.staffRoleId;

    const CATEGORIES = {
        minecraft: { label: 'Minecraft', emoji: '⛏️', prefix: 'mc' },
        discord: { label: 'Discord', emoji: '💬', prefix: 'dc' },
        rekrutacja: { label: 'Rekrutacja', emoji: '📝', prefix: 'podanie' },
        inne: { label: 'Inne', emoji: '⚙️', prefix: 'inne' }
    };

    // 1. OTWIERANIE TICKETU
    if (interaction.isButton() && interaction.customId.startsWith('t_')) {
        const existingChannel = interaction.guild.channels.cache.find(c => 
            c.parentId === CATEGORY_ID && 
            c.name.includes(interaction.user.username.toLowerCase())
        );

        if (existingChannel) {
            return interaction.reply({ content: `❌ Masz już otwarte zgłoszenie: ${existingChannel}`, ephemeral: true });
        }

        const key = interaction.customId.replace('t_', '');
        const cat = CATEGORIES[key];

        const channel = await interaction.guild.channels.create({
            name: `${cat.prefix}-${interaction.user.username}`,
            type: ChannelType.GuildText,
            parent: CATEGORY_ID,
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.AttachFiles] },
                ...(staffRole ? [{ id: staffRole, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.AttachFiles] }] : [])
            ],
        });

        const welcomeEmbed = new EmbedBuilder()
            .setTitle('🛡️ FragZone Support')
            .setDescription(`Witaj ${interaction.user}!\nOpisz swój problem.\n\n**Kategoria:** ${cat.emoji} ${cat.label}\n**Status:** ⏳ Oczekiwanie na administrację...`)
            .setColor('#2ecc71')
            .setFooter({ text: 'Tylko administracja może zarządzać tym ticketem' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('claim').setLabel('Przejmij').setEmoji('📜').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('close_req').setLabel('Zamknij').setEmoji('🔒').setStyle(ButtonStyle.Danger)
        );

        await channel.send({ content: `${interaction.user} | <@&${staffRole || ''}>`, embeds: [welcomeEmbed], components: [row] });
        await interaction.reply({ content: `✅ Otwarto ticket: ${channel}`, ephemeral: true });
    }

    // 2. OBSŁUGA PRZEJMOWANIA
    if (interaction.isButton() && interaction.customId === 'claim') {
        if (staffRole && !interaction.member.roles.cache.has(staffRole)) {
            return interaction.reply({ content: "❌ Tylko administracja może przejmować zgłoszenia!", ephemeral: true });
        }

        const messages = await interaction.channel.messages.fetch({ limit: 10 });
        const welcomeMsg = messages.find(m => m.author.id === client.user.id && m.embeds.length > 0);
        
        if (welcomeMsg) {
            const oldEmbed = welcomeMsg.embeds[0];
            const newEmbed = EmbedBuilder.from(oldEmbed)
                .setDescription(oldEmbed.description.replace('⏳ Oczekiwanie na administrację...', `✅ Przyjęte przez: **${interaction.user.username}**`))
                .setColor('#3498db');
            await welcomeMsg.edit({ embeds: [newEmbed] });
        }

        const claimEmbed = new EmbedBuilder()
            .setTitle('🛡️ System FragZone')
            .setDescription(`Zgłoszenie jest teraz obsługiwane przez: **${interaction.user.username}**`)
            .setColor('#3498db');

        const disabledRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('claimed').setLabel('Przejęte').setStyle(ButtonStyle.Secondary).setDisabled(true),
            new ButtonBuilder().setCustomId('close_req').setLabel('Zamknij').setEmoji('🔒').setStyle(ButtonStyle.Danger)
        );

        await interaction.update({ components: [disabledRow] });
        await interaction.channel.send({ embeds: [claimEmbed] });
    }

    // 3. ZAMYKANIE
    if (interaction.isButton() && interaction.customId === 'close_req') {
        if (staffRole && !interaction.member.roles.cache.has(staffRole)) {
            return interaction.reply({ content: "❌ Gracze nie mogą sami zamykać ticketów.", ephemeral: true });
        }

        const modal = new ModalBuilder().setCustomId('modal_close').setTitle('Zamykanie Ticketu');
        const input = new TextInputBuilder().setCustomId('reason').setLabel("Powód zamknięcia:").setStyle(TextInputStyle.Paragraph).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
    }

    // 4. FINALNE USUNIĘCIE
    if (interaction.type === InteractionType.ModalSubmit && interaction.customId === 'modal_close') {
        const reason = interaction.fields.getTextInputValue('reason');
        const ownerName = interaction.channel.name.split('-')[1];
        const owner = interaction.guild.members.cache.find(m => m.user.username === ownerName);

        const dmEmbed = new EmbedBuilder()
            .setTitle('🎫 Ticket Zamknięty - FragZone')
            .addFields(
                { name: '👤 Zamknięty przez', value: `${interaction.user.tag}`, inline: true },
                { name: '💬 Powód', value: `\`\`\`${reason}\`\`\`` }
            )
            .setColor('#e74c3c')
            .setTimestamp();

        if (owner) await owner.send({ embeds: [dmEmbed] }).catch(() => {});
        
        await interaction.reply("✅ Zamykanie kanału za 5 sekund...");
        setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
    }
});

client.login(TOKEN);
