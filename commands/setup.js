const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Wysyła profesjonalny panel ticketów FragZone'),
    async execute(interaction) {
        // Tworzymy rozbudowany, ładny opis
        const embed = new EmbedBuilder()
            .setTitle('🎫 CENTRUM POMOCY FRAGZONE')
            .setDescription(
                'Witaj w oficjalnym systemie wsparcia technicznego **FragZone**! 🛡️\n\n' +
                'Jeśli potrzebujesz pomocy, masz pytanie lub chcesz zgłosić problem, nasi administratorzy są tutaj dla Ciebie. ' +
                'Wybierz odpowiednią kategorię poniżej, aby otworzyć **prywatny kanał komunikacji**.\n\n' +
                '📌 **Zasady zgłoszeń:**\n' +
                '• Opisz swój problem **jak najdokładniej** w pierwszej wiadomości.\n' +
                '• Przygotuj ewentualne **zrzuty ekranu** lub dowody.\n' +
                '• Prosimy o cierpliwość – każda sprawa zostanie rozpatrzona! ✅\n\n' +
                '---\n' +
                '*System obsługiwany przez FragZone Tickets*'
            )
            .setColor('#2ecc71') // Twój neonowy zielony
            .setThumbnail(interaction.guild.iconURL())
            .setFooter({ 
                text: 'FragZone Support • Działamy dla społeczności', 
                iconURL: interaction.client.user.displayAvatarURL() 
            })
            .setTimestamp();

        // Przyciski kategorii
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('t_minecraft').setLabel('Minecraft').setEmoji('⛏️').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('t_discord').setLabel('Discord').setEmoji('💬').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('t_rekrutacja').setLabel('Rekrutacja').setEmoji('📝').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('t_inne').setLabel('Inne').setEmoji('⚙️').setStyle(ButtonStyle.Danger)
        );

        // Wysyłamy jako osobną wiadomość (dzięki temu nie ma napisu "użyto komendy")
        await interaction.channel.send({ embeds: [embed], components: [row] });

        // Odpowiedź widoczna tylko dla Ciebie (potwierdzenie)
        await interaction.reply({ content: '✅ Panel został wysłany bez śladu komendy!', ephemeral: true });
    },
};
