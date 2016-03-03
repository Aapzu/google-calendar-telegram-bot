'use strict';

const moment = require('moment');
const TelegramBot = require('node-telegram-bot-api');
const GoogleAuth = require('google-auth-library');
const auth = new GoogleAuth();
const gplug = new (require('./GPlug.js').GPlug);
const fs = require('fs');

moment.locale('es');

class Bot {

    constructor(telegramBotToken) {
        const credentials = JSON.parse(fs.readFileSync(config.clientCredentialsFile));
        this.appCredentials = {
            id: credentials.installed.client_id,
            secret: credentials.installed.client_secret,
            redirectUrl: credentials.installed.redirect_uris[0]
        };

        this.bot = new TelegramBot(telegramBotToken, {polling: true});
        this.bot.on('message', msg => {
            const userId = msg.from.id;
            const eventData = {};
            const authCode = /^[\w-/]+$/.test(msg.text) ? msg.text : null;
            let msgMatch = msg.text.match(/^\/(list)/);
            const cmd = msgMatch ? msgMatch[1] : null;
            console.log(msgMatch)
            if (authCode) {
                this._forceAuth(userId, authCode)
                    .then(oauth2Client => {
                        /*gplug.addEvent(oauth2Client, eventData).then(eventDetails => {
                            this.bot.sendMessage(userId, '');
                        })
                        .catch(this._handleError);*/
                        console.log(authCode, 'authCode')
                        gplug.listEvents(oauth2Client).then(eventDetails => {
                            this.bot.sendMessage(userId, eventDetails);
                        })
                        .catch(err => {
                            this.bot.sendMessage(userId, err.message);
                            console.log(err.stack);
                        });
                    })
                    .catch(err => {
                        console.log(err.stack);
                        this.bot.sendMessage(userId, err.message);
                    });
            } else {
                this._sendAuthUrl(userId);
            }
        });
    }

    _createAuthClient() {
        return new auth.OAuth2(this.appCredentials.id, this.appCredentials.secret, this.appCredentials.redirectUrl);
    }

    _forceAuth(userId, authCode) {
        return new Promise((resolve, reject) => {
            fs.readFile(config.userCredentialsFile, 'utf8', (err, data) => {
                if (err) {
                    return reject(err);
                }
                const credentials = data ? JSON.parse(data) : {};
                const oauth2Client = this._createAuthClient();
                if (credentials[userId]) {
                    oauth2Client.setCredentials(credentials[userId]);
                    resolve(oauth2Client);
                } else {
                    resolve(this._getAccessToken(userId, authCode));
                }
            });
        });
    }

    _getAccessToken(userId, authCode) {
        return new Promise((resolve, reject) => {
            const oauth2Client = this._createAuthClient();
            oauth2Client.getToken(authCode, (err, tokens) => {
                if (err) {
                    return reject(new Error('Error trying to retrieve access token: ' + err.message));
                }
                oauth2Client.setCredentials(tokens);
                const json = {};
                json[userId] = credentials;
                fs.writeFileSync(config.userCredentialsFile, JSON.stringify(json));
                resolve(oauth2Client);
            });
        });
    }

    _sendAuthUrl(userId) {
        const oauth2Client = this._createAuthClient();
        var authUrl = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: 'https://www.googleapis.com/auth/calendar'
        });
        this.bot.sendMessage(userId, 'You must first authorize me! Open the following link and send me the activation code: ' + authUrl);
    }
}

module.exports = Bot;
