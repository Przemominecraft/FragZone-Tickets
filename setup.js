const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Wysyła panel ticketów FragZone'),
    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('🎫 CENTRUM POMOCY FRAGZONE')
            .setDescription('Wybierz odpowiednią kategorię poniżej, aby porozmawiać z administracją.')
            .setColor('#2ecc71');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('t_minecraft').setLabel('Minecraft').setEmoji('⛏️').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('t_discord').setLabel('Discord').setEmoji('💬').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('t_rekrutacja').setLabel('Rekrutacja').setEmoji('📝').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('t_inne').setLabel('Inne').setEmoji('⚙️').setStyle(ButtonStyle.Danger)
        );

        await interaction.reply({ embeds: [embed], components: [row] });
    },
};