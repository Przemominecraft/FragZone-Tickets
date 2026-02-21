const { Client, GatewayIntentBits, Collection, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField, ModalBuilder, TextInputBuilder, TextInputStyle, InteractionType } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

const TOKEN = process.env.DISCORD_TOKEN;
const CATEGORY_ID = '1474735192064131082';

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] 
});

// Handler komend
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    }
}

client.once('ready', () => console.log(`✅ FragZone Core online!`));

// Obsługa komend Slash (/setup)
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try { await command.execute(interaction); } catch (error) { console.error(error); }
});

// Obsługa logiki ticketów (przyciski i modale)
client.on('interactionCreate', async interaction => {
    const CATEGORIES = {
        minecraft: { label: 'Minecraft', emoji: '⛏️', style: ButtonStyle.Success, prefix: 'mc' },
        discord: { label: 'Discord', emoji: '💬', style: ButtonStyle.Primary, prefix: 'dc' },
        rekrutacja: { label: 'Rekrutacja', emoji: '📝', style: ButtonStyle.Success, prefix: 'podanie' },
        inne: { label: 'Inne', emoji: '⚙️', style: ButtonStyle.Danger, prefix: 'inne' }
    };

    // Otwieranie ticketu
    if (interaction.isButton() && interaction.customId.startsWith('t_')) {
        const key = interaction.customId.replace('t_', '');
        const config = CATEGORIES[key];

        const channel = await interaction.guild.channels.create({
            name: `${config.prefix}-${interaction.user.username}`,
            type: ChannelType.GuildText,
            parent: CATEGORY_ID,
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
            ],
        });

        const welcomeEmbed = new EmbedBuilder()
            .setTitle('Ticket Opened')
            .setDescription(`${interaction.user} stworzył ticket w kategorii **${config.label}**.`)
            .setColor('#2ecc71')
            .setFooter({ text: 'Użyj przycisku poniżej, aby zamknąć.' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('close_req').setLabel('Close Ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger)
        );

        await channel.send({ content: `${interaction.user}`, embeds: [welcomeEmbed], components: [row] });
        await interaction.reply({ content: `Otwarto ticket: ${channel}`, ephemeral: true });
    }

    // Wyświetlanie okienka (Modal) po kliknięciu Close
    if (interaction.isButton() && interaction.customId === 'close_req') {
        const modal = new ModalBuilder().setCustomId('modal_close').setTitle('Zamykanie zgłoszenia');
        const input = new TextInputBuilder().setCustomId('reason').setLabel("Powód zamknięcia:").setStyle(TextInputStyle.Paragraph).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
    }

    // Obsługa formularza (DM do gracza i usuwanie)
    if (interaction.type === InteractionType.ModalSubmit && interaction.customId === 'modal_close') {
        const reason = interaction.fields.getTextInputValue('reason');
        const ownerName = interaction.channel.name.split('-')[1];
        const owner = interaction.guild.members.cache.find(m => m.user.username === ownerName);

        const dmEmbed = new EmbedBuilder()
            .setTitle('Ticket Zamknięty')
            .addFields(
                { name: '📄 Nazwa', value: interaction.channel.name, inline: true },
                { name: '👤 Przez', value: interaction.user.tag, inline: true },
                { name: '💬 Powód', value: reason }
            )
            .setColor('#ff0000').setTimestamp();

        if (owner) await owner.send({ embeds: [dmEmbed] }).catch(() => {});

        await interaction.reply('✅ Powód wysłany. Usuwanie za 5 sekund...');
        setTimeout(() => interaction.channel.delete(), 5000);
    }
});

client.login(TOKEN);