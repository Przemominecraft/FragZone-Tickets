const { Client, GatewayIntentBits, Collection, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField, ModalBuilder, TextInputBuilder, TextInputStyle, InteractionType } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

// Pobieranie danych z Variables na Railway
const TOKEN = process.env.DISCORD_TOKEN;
const CATEGORY_ID = '1474735192064131082'; // Twoja kategoria na Discordzie

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

// Obsługa komend Slash (/setup)
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

// --- OBSŁUGA SYSTEMU TICKETÓW ---
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
        const config = CATEGORIES[key];

        const channel = await interaction.guild.channels.create({
            name: `${config.prefix}-${interaction.user.username}`,
            type: ChannelType.GuildText,
            parent: CATEGORY_ID,
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.AttachFiles] },
            ],
        });

        const welcomeEmbed = new EmbedBuilder()
            .setTitle('🛡️ Nowe Zgłoszenie')
            .setDescription(`Witaj ${interaction.user}! Opisz dokładnie swój problem.\n\n**Kategoria:** ${config.emoji} ${config.label}\n**Status:** Oczekiwanie na administrację...`)
            .setColor('#2ecc71')
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('close_req').setLabel('Zamknij').setEmoji('🔒').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('claim').setLabel('Przejmij').setEmoji('📜').setStyle(ButtonStyle.Secondary)
        );

        await channel.send({ content: `${interaction.user} | @everyone`, embeds: [welcomeEmbed], components: [row] });
        await interaction.reply({ content: `Otwarto ticket: ${channel}`, ephemeral: true });
    }

    // 2. Obsługa przejmowania (CLAIM)
    if (interaction.isButton() && interaction.customId === 'claim') {
        const claimEmbed = new EmbedBuilder()
            .setTitle('🛡️ Ticket Przejęty')
            .setDescription(`To zgłoszenie jest teraz obsługiwane przez: **${interaction.user.username}**`)
            .setColor('#2ecc71')
            .setTimestamp();

        const disabledRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('close_req').setLabel('Zamknij').setEmoji('🔒').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('claimed').setLabel('Przejęte').setStyle(ButtonStyle.Secondary).setDisabled(true)
        );

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

    // 4. Finalne zamknięcie (Wysłanie DM i usunięcie)
    if (interaction.type === InteractionType.ModalSubmit && interaction.customId === 'modal_close') {
        const reason = interaction.fields.getTextInputValue('reason');
        const ownerName = interaction.channel.name.split('-')[1];
        const owner = interaction.guild.members.cache.find(m => m.user.username === ownerName);

        const dmEmbed = new EmbedBuilder()
            .setTitle('🎫 Twój Ticket został zamknięty')
            .addFields(
                { name: '📄 Nazwa kanału', value: `\`${interaction.channel.name}\`` },
                { name: '👤 Zamknięty przez', value: `${interaction.user.tag}` },
                { name: '💬 Powód', value: `\`\`\`${reason}\`\`\`` }
            )
            .setColor('#2ecc71')
            .setTimestamp();

        if (owner) {
            await owner.send({ embeds: [dmEmbed] }).catch(() => {});
        }

        await interaction.reply('✅ Zapisano powód. Kanał zostanie usunięty za chwilę.');
        setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
    }
});

client.login(TOKEN);
