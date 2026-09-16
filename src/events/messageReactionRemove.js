const { Events } = require('discord.js');
const { handleReactionChange } = require('../utils/starboard');

module.exports = {
    name: Events.MessageReactionRemove,
    async execute(reaction, user) {
        await handleReactionChange(reaction, user).catch(() => {});
    },
};
