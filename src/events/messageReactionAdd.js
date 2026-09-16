const { Events } = require('discord.js');
const { handleReactionChange } = require('../utils/starboard');
const { handleReactionTranslation } = require('../utils/reactionTranslator');

module.exports = {
    name: Events.MessageReactionAdd,
    async execute(reaction, user) {
        // Starboard kontrolü
        await handleReactionChange(reaction, user).catch(() => {});

        // Bayrak emojisi ile anında çeviri kontrolü
        await handleReactionTranslation(reaction, user).catch(() => {});
    },
};
