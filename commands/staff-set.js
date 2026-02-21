const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('staff-set')
        .setDescription('Zarządzaj uprawnieniami Staff (Dodaj/Usuń rolę)')
        .addRoleOption(option => 
            option.setName('rola')
                .setDescription('Wybierz rolę, którą chcesz dodać lub usunąć z systemu ticketów')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const role = interaction.options.getRole('rola');
        const configPath = path.join(__dirname, '../config.json');
        
        // Inicjalizacja podstawowej struktury
        let config = { staffRoles: [] };

        // 1. Próba odczytania istniejącego pliku
        if (fs.existsSync(configPath)) {
            try {
                const fileData = fs.readFileSync(configPath, 'utf8');
                config = JSON.parse(fileData);
                // Upewniamy się, że staffRoles to tablica
                if (!Array.isArray(config.staffRoles)) {
                    config.staffRoles = [];
                }
            } catch (error) {
                console.error("Błąd odczytu config.json, tworzę nowy.");
                config = { staffRoles: [] };
            }
        }

        // 2. Logika Toggle (Przełącznik)
        const roleIndex = config.staffRoles.indexOf(role.id);

        if (roleIndex === -1) {
            // Roli nie ma na liście -> Dodajemy
            config.staffRoles.push(role.id);
            
            try {
                fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
                await interaction.reply({ 
                    content: `✅ Rola **${role.name}** została pomyślnie **DODANA** do listy Staff.\nOsoby z tą rangą mogą teraz widzieć i obsługiwać nowe tickety.`, 
                    ephemeral: true 
                });
            } catch (error) {
                await interaction.reply({ content: `❌ Błąd zapisu konfiguracji!`, ephemeral: true });
            }

        } else {
            // Rola jest na liście -> Usuwamy
            config.staffRoles.splice(roleIndex, 1);
            
            try {
                fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
                await interaction.reply({ 
                    content: `🗑️ Rola **${role.name}** została **USUNIĘTA** z listy Staff.\nOsoby z tą rangą nie będą już miały dostępu do nowych ticketów.`, 
                    ephemeral: true 
                });
            } catch (error) {
                await interaction.reply({ content: `❌ Błąd zapisu konfiguracji!`, ephemeral: true });
            }
        }
    },
};
