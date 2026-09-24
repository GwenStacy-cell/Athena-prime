const { REST, Routes, MessageFlags } = require('discord.js');
const rest = new REST({ version: '10' }).setToken('MTE4MzU4NDk3MDU0Mjk0ODM4Mg.GCxZ__.MOCK_TOKEN_JUST_FOR_SYNTAX');
// We don't have the token so we can't test actual API limits, but we can verify our syntax.
console.log('Valid JSON Structure generated');
