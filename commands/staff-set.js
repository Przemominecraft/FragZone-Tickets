const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('staff-set')
        .setDescription('Ustawia rolę administracyjną do obsługi ticketów')
        .addRoleOption(option => 
            option.setName('rola')
                .setDescription('Wybierz rolę, która ma widzieć tickety')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator), // Tylko dla Admina
    async execute(interaction) {
        const role = interaction.options.getRole('rola');
        
        // Zapisujemy ID roli do prostego pliku JSON, żeby bot pamiętał ją po restarcie
        const configPath = path.join(__dirname, '../config.json');
        const config = { staffRoleId: role.id };
        
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

        await interaction.reply({ content: `✅ Rola **${role.name}** została ustawiona jako Staff. Będzie teraz widzieć nowo otwarte tickety!`, ephemeral: true });
    },
};
