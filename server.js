'use strict';

global.config = Object.assign(
    require('./config-default'),
    require('./config')
);

const Bot = require('./lib/Bot.js');
const bot = new Bot();
bot.start();
