const { Client, GatewayIntentBits, Collection, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField, ModalBuilder, TextInputBuilder, TextInputStyle, InteractionType } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

// Konfiguracja
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

client.once('ready', () => {
    console.log(`✅ FragZone Tickets Online! Zalogowano jako ${client.user.tag}`);
});

// Obsługa komend Slash
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'Błąd podczas wykonywania komendy!', ephemeral: true });
    }
});

// --- SYSTEM TICKETÓW ---
client.on('interactionCreate', async interaction => {
    const CATEGORIES = {
        minecraft: { label: 'Minecraft', emoji: '⛏️', prefix: 'mc' },
        discord: { label: 'Discord', emoji: '💬', prefix: 'dc' },
        rekrutacja: { label: 'Rekrutacja', emoji: '📝', prefix: 'podanie' },
        inne: { label: 'Inne', emoji: '⚙️', prefix: 'inne' }
    };

    // 1. Otwieranie ticketu
    if (interaction.isButton() && interaction.customId.startsWith('t_')) {
        const key = interaction.customId.replace('t_', '');
        const configData = CATEGORIES[key];

        // Pobieranie roli Staff z config.json
        let staffPermissions = [];
        try {
            const configPath = path.join(__dirname, 'config.json');
            if (fs.existsSync(configPath)) {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                if (config.staffRoleId) {
                    staffPermissions.push({
                        id: config.staffRoleId,
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.AttachFiles]
                    });
                }
            }
        } catch (e) { console.log("Brak roli Staff w config.json"); }

        const channel = await interaction.guild.channels.create({
            name: `${configData.prefix}-${interaction.user.username}`,
            type: ChannelType.GuildText,
            parent: CATEGORY_ID,
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.AttachFiles] },
                ...staffPermissions
            ],
        });

        const welcomeEmbed = new EmbedBuilder()
            .setTitle('🛡️ Nowe Zgłoszenie')
            .setDescription(`Witaj ${interaction.user}! Opisz dokładnie swój problem.\n\n**Kategoria:** ${configData.emoji} ${configData.label}\n**Status:** Oczekiwanie na administrację...`)
            .setColor('#2ecc71')
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('close_req').setLabel('Zamknij').setEmoji('🔒').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('claim').setLabel('Przejmij').setEmoji('📜').setStyle(ButtonStyle.Secondary)
        );

        await channel.send({ content: `${interaction.user} | @everyone`, embeds: [welcomeEmbed], components: [row] });
        await interaction.reply({ content: `Otwarto ticket: ${channel}`, ephemeral: true });
    }

    // 2. Obsługa CLAIM (Przejęcie)
    if (interaction.isButton() && interaction.customId === 'claim') {
        // Blokada przycisków
        const disabledRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('close_req').setLabel('Zamknij').setEmoji('🔒').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('claimed').setLabel('Przejęte').setStyle(ButtonStyle.Secondary).setDisabled(true)
        );

        // --- AKTUALIZACJA EMBEDA POWITALNEGO ---
        try {
            const messages = await interaction.channel.messages.fetch({ limit: 20 });
            const welcomeMsg = messages.find(m => m.author.id === client.user.id && m.embeds.length > 0);

            if (welcomeMsg) {
                const oldEmbed = welcomeMsg.embeds[0];
                const updatedEmbed = EmbedBuilder.from(oldEmbed)
                    .setDescription(oldEmbed.description.replace('Oczekiwanie na administrację...', `Przyjęte przez: **${interaction.user.username}** ✅`))
                    .setColor('#3498db'); // Zmiana koloru na niebieski przy obsłudze
                
                await welcomeMsg.edit({ embeds: [updatedEmbed] });
            }
        } catch (err) { console.error("Błąd edycji embeda:", err); }

        const claimEmbed = new EmbedBuilder()
            .setTitle('🛡️ Ticket Przejęty')
            .setDescription(`To zgłoszenie jest teraz obsługiwane przez: **${interaction.user.username}**`)
            .setColor('#2ecc71')
            .setTimestamp();

        await interaction.update({ components: [disabledRow] });
        await interaction.channel.send({ embeds: [claimEmbed] });
    }

    // 3. Rozpoczęcie zamykania (MODAL)
    if (interaction.isButton() && interaction.customId === 'close_req') {
        const modal = new ModalBuilder().setCustomId('modal_close').setTitle('Zamykanie Ticketu');
        const input = new TextInputBuilder()
            .setCustomId('reason')
            .setLabel("Podaj powód zamknięcia:")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
    }

    // 4. Finalne zamknięcie
    if (interaction.type === InteractionType.ModalSubmit && interaction.customId === 'modal_close') {
        const reason = interaction.fields.getTextInputValue('reason');
        const ownerName = interaction.channel.name.split('-')[1];
        const owner = interaction.guild.members.cache.find(m => m.user.username === ownerName);

        const dmEmbed = new EmbedBuilder()
            .setTitle('🎫 Twój Ticket został zamknięty')
            .addFields(
                { name: '📄 Kanał', value: `\`${interaction.channel.name}\``, inline: true },
                { name: '👤 Przez', value: `${interaction.user.tag}`, inline: true },
                { name: '💬 Powód', value: `\`\`\`${reason}\`\`\`` }
            )
            .setColor('#2ecc71')
            .setTimestamp();

        if (owner) { await owner.send({ embeds: [dmEmbed] }).catch(() => {}); }

        await interaction.reply('✅ Zapisano powód. Kanał zostanie usunięty za 5 sekund.');
        setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
    }
});

client.login(TOKEN);
