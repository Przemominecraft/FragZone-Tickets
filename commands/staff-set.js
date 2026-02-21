const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('staff-set')
        .setDescription('Dodaje lub usuwa rolę z obsługi ticketów (Toggle)')
        .addRoleOption(option => 
            option.setName('rola')
                .setDescription('Wybierz rolę do przełączenia')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        const role = interaction.options.getRole('rola');
        const configPath = path.join(__dirname, '../config.json');
        
        let config = { staffRoles: [] };

        if (fs.existsSync(configPath)) {
            try {
                config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                if (!config.staffRoles) config.staffRoles = [];
            } catch (e) {
                config = { staffRoles: [] };
            }
        }

        const roleIndex = config.staffRoles.indexOf(role.id);

        if (roleIndex === -1) {
            config.staffRoles.push(role.id);
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            await interaction.reply({ content: `✅ Rola **${role.name}** została **dodana** do listy Staff.`, ephemeral: true });
        } else {
            config.staffRoles.splice(roleIndex, 1);
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            await interaction.reply({ content: `🗑️ Rola **${role.name}** została **usunięta** z listy Staff.`, ephemeral: true });
        }
    },
};
