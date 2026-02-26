const { 
    Client, 
    GatewayIntentBits, 
    Collection, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ChannelType, 
    PermissionsBitField, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    InteractionType 
} = require('discord.js');

const fs = require('node:fs');
const path = require('node:path');

const TOKEN = process.env.DISCORD_TOKEN;
const CATEGORY_ID = '1474735192064131082';
const GUILD_ID = '1465447308111118520'; // ID Twojego serwera

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

// Funkcja pobierająca konfigurację rang Staffu
function getConfig() {
    const configPath = path.join(__dirname, 'config.json');
    if (!fs.existsSync(configPath)) return { staffRoles: [] };
    try {
        const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        return data.staffRoles ? data : { staffRoles: [] };
    } catch (e) { 
        return { staffRoles: [] }; 
    }
}

// --- START BOTA + TAG SERWEROWY ---
client.once('ready', async () => {
    console.log(`✅ FragZone Pro Online!`);

    const SERWER_TAG = 'FRAG';
    try {
        const guild = client.guilds.cache.get(GUILD_ID);
        if (guild) {
            const botMember = await guild.members.fetch(client.user.id);
            await botMember.setNickname(`${SERWER_TAG} ${client.user.username}`);
            console.log(`🏷️ Tag serwerowy [${SERWER_TAG}] został ustawiony!`);
        }
    } catch (error) {
        console.log("⚠️ Nie udało się ustawić tagu (brak uprawnień?):", error.message);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const command = client.commands.get(interaction.commandName);
    if (command) try { await command.execute(interaction); } catch (e) { console.error(e); }
});

// --- GŁÓWNA OBSŁUGA SYSTEMU TICKETÓW ---
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton() && interaction.type !== InteractionType.ModalSubmit) return;

    const config = getConfig();
    const staffRoles = config.staffRoles;
    
    // Sprawdzanie czy użytkownik to Staff lub Admin (pozwala na zamykanie własnych ticketów przez admina)
    const isStaff = interaction.member.roles.cache.some(role => staffRoles.includes(role.id)) || 
                    interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);

    // 1. KLIKNIĘCIE PRZYCISKU WYBORU KATEGORII -> POKAZUJE MODAL
    if (interaction.isButton() && interaction.customId.startsWith('t_')) {
        const key = interaction.customId.replace('t_', '');
        
        const existing = interaction.guild.channels.cache.find(c => 
            c.parentId === CATEGORY_ID && 
            c.name.includes(interaction.user.username.toLowerCase())
        );

        if (existing) {
            return interaction.reply({ content: `❌ Masz już otwarty ticket: ${existing}`, ephemeral: true });
        }

        const modal = new ModalBuilder()
            .setCustomId(`modal_open_${key}`)
            .setTitle('Formularz zgłoszeniowy');

        const input = new TextInputBuilder()
            .setCustomId('user_input')
            .setRequired(true);

        if (key === 'rekrutacja') {
            input.setLabel("Na jaką rangę kandydujesz?")
                 .setPlaceholder("np. Helper, Moderator, Budowniczy...")
                 .setStyle(TextInputStyle.Short);
        } else {
            input.setLabel("Opisz swój problem:")
                 .setPlaceholder("Napisz tutaj, w czym możemy Ci pomóc...")
                 .setStyle(TextInputStyle.Paragraph);
        }

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return await interaction.showModal(modal);
    }

    // 2. WYSŁANIE FORMULARZA -> TWORZENIE KANAŁU
    if (interaction.type === InteractionType.ModalSubmit && interaction.customId.startsWith('modal_open_')) {
        const key = interaction.customId.replace('modal_open_', '');
        const userInput = interaction.fields.getTextInputValue('user_input');
        
        const CATEGORIES = {
            minecraft: { label: 'Minecraft', emoji: '⛏️', prefix: 'mc' },
            discord: { label: 'Discord', emoji: '💬', prefix: 'dc' },
            rekrutacja: { label: 'Rekrutacja', emoji: '📝', prefix: 'podanie' },
            inne: { label: 'Inne', emoji: '⚙️', prefix: 'inne' }
        };
        const cat = CATEGORIES[key];

        const overwrites = [
            { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
            { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.AttachFiles] }
        ];

        // Dodawanie uprawnień dla wszystkich rang ustawionych przez /staff-set
        staffRoles.forEach(id => {
            overwrites.push({ id: id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.AttachFiles] });
        });

        const channel = await interaction.guild.channels.create({
            name: `${cat.prefix}-${interaction.user.username}`,
            type: ChannelType.GuildText,
            parent: CATEGORY_ID,
            permissionOverwrites: overwrites,
        });

        const infoLabel = key === 'rekrutacja' ? `**Wybrana ranga:**` : `**Opis problemu:**`;

        const welcomeEmbed = new EmbedBuilder()
            .setTitle(`🛡️ FragZone Support - ${cat.label}`)
            .setDescription(`Witaj ${interaction.user}!\n\n${infoLabel}\n${userInput}\n\n**Status:** ⏳ Oczekiwanie na administrację...`)
            .setColor('#2ecc71')
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('claim').setLabel('Przejmij').setEmoji('📜').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('close_req').setLabel('Zamknij').setEmoji('🔒').setStyle(ButtonStyle.Danger)
        );

        // Ping @everyone przy otwarciu
        await channel.send({ content: `@everyone`, embeds: [welcomeEmbed], components: [row] });
        await interaction.reply({ content: `✅ Twój ticket został otwarty: ${channel}`, ephemeral: true });
    }

    // 3. OBSŁUGA PRZEJMOWANIA (CLAIM)
    if (interaction.isButton() && interaction.customId === 'claim') {
        if (!isStaff) return interaction.reply({ content: "❌ Tylko staff może to zrobić!", ephemeral: true });

        const messages = await interaction.channel.messages.fetch({ limit: 10 });
        const welcomeMsg = messages.find(m => m.author.id === client.user.id && m.embeds.length > 0);
        
        if (welcomeMsg) {
            const updatedEmbed = EmbedBuilder.from(welcomeMsg.embeds[0])
                .setDescription(welcomeMsg.embeds[0].description.replace('⏳ Oczekiwanie na administrację...', `✅ Przyjęte przez: **${interaction.user.username}**`))
                .setColor('#3498db');
            await welcomeMsg.edit({ embeds: [updatedEmbed] });
        }

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('claimed').setLabel('Przejęte').setStyle(ButtonStyle.Secondary).setDisabled(true),
            new ButtonBuilder().setCustomId('close_req').setLabel('Zamknij').setEmoji('🔒').setStyle(ButtonStyle.Danger)
        );

        await interaction.update({ components: [buttons] });
        await interaction.channel.send({ 
            embeds: [new EmbedBuilder().setTitle('🛡️ System FragZone').setDescription(`Zgłoszenie obsługuje: **${interaction.user.username}**`).setColor('#3498db')] 
        });
    }

    // 4. MODAL ZAMYKANIA (TYLKO DLA STAFF/ADMIN)
    if (interaction.isButton() && interaction.customId === 'close_req') {
        if (!isStaff) return interaction.reply({ content: "❌ Nie masz uprawnień do zamykania ticketów.", ephemeral: true });

        const modal = new ModalBuilder().setCustomId('modal_close').setTitle('Zamykanie Ticketu');
        const input = new TextInputBuilder()
            .setCustomId('reason')
            .setLabel("Powód zamknięcia:")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
    }

    // 5. FINALNE USUNIĘCIE KANAŁU
    if (interaction.type === InteractionType.ModalSubmit && interaction.customId === 'modal_close') {
        const reason = interaction.fields.getTextInputValue('reason');
        const ownerName = interaction.channel.name.split('-')[1];
        const owner = interaction.guild.members.cache.find(m => m.user.username.toLowerCase() === ownerName.toLowerCase());

        const dm = new EmbedBuilder()
            .setTitle('🎫 Ticket Zamknięty - FragZone')
            .addFields(
                { name: '👤 Przez', value: `${interaction.user.tag}` }, 
                { name: '💬 Powód', value: `\`\`\`${reason}\`\`\`` }
            )
            .setColor('#e74c3c');

        if (owner) await owner.send({ embeds: [dm] }).catch(() => {});
        
        await interaction.reply("✅ Zamykanie za 5 sekund...");
        setTimeout(() => {
            interaction.channel.delete().catch(() => {});
        }, 5000);
    }
});

client.login(TOKEN);

