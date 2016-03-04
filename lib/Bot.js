'use strict';

const moment = require('moment');
const TelegramBot = require('node-telegram-bot-api');
const GoogleAuth = require('google-auth-library');
const MongoClient = require('mongodb').MongoClient;
const StringParser = require('./StringParser').StringParser;

const auth = new GoogleAuth();
const gplug = new (require('./GPlug.js').GPlug);
const fs = require('fs');

class Bot {

    constructor() {
        const credentials = JSON.parse(fs.readFileSync(config.clientCredentialsFile));
        this.appCredentials = {
            id: credentials.installed.client_id,
            secret: credentials.installed.client_secret,
            redirectUrl: credentials.installed.redirect_uris[0]
        };
        this.stringParser = new StringParser();
        this.timeZone = 'America/Argentina/Buenos_Aires';
        this.lang = 'es';
        moment.locale(this.lang);
    }

    start() {
        MongoClient.connect(config.db).then(db => {
            this.db = db;
            this._initBot();
        })
        .catch(err => {
            console.log(err.stack);
        });
    }

    _initBot() {
        this.bot = new TelegramBot(config.telegramBotToken, {polling: true});
        this.bot.on('message', msg => {
            const userId = msg.from.id;
            const text = msg.text.trim();
            this._checkAuth(userId).then(user => {
                if (!user || text === '/start') {
                    // first message, send auth url
                    this._sendAuthUrl(userId);
                } else if (!user.credentials) {
                    // pending authorization, check code and store credentials
                    this._doAuth(userId, text);
                } else if (!/^\//.test(text)) {
                    // client is authorized, parse text and add event
                    let oauth2Client = this._createAuthClient(user.credentials);
                    let eventData = this._createEventFromInput(text);
                    if (!eventData) {
                        this.bot.sendMessage(userId, 'Unable to parse text, please try again.');
                    } else {
                        this._addEvent(oauth2Client, eventData).then(eventDetails => {
                            this.bot.sendMessage(userId, 'Event successfully created!\n\n' + eventDetails);
                        })
                        .catch(err => {
                            console.log(err.stack);
                            this.bot.sendMessage(userId, 'Unexpected error occurred: ' + err.message);
                        });
                    }
                } else {
                    this._parseCmd(text);
                }
            }).catch(err => {
                console.log(err.stack);
                this.bot.sendMessage(userId, 'Unexpected error occurred: ' + err.message);
            });
        });
    }

    _createAuthClient(credentials) {
        let oauth2Client = new auth.OAuth2(this.appCredentials.id, this.appCredentials.secret, this.appCredentials.redirectUrl);
        if (credentials) {
            oauth2Client.setCredentials(credentials);
        }
        return oauth2Client;
    }

    _checkAuth(userId) {
        return this.db.collection('clients').findOne({userId: userId});
    }

    _addEvent(oauth2Client, eventData) {
        return new Promise((resolve, reject) => {
            eventData.auth = oauth2Client;
            gplug.addEvent(eventData).then((response) => {
                const startDate = moment(response.start.dateTime);
                const endDate = moment(response.end.dateTime);
                let friendlyResponse = response.summary;
                friendlyResponse += '\nComienza: ' + startDate.calendar();
                friendlyResponse += '\nFinaliza: ' + endDate.calendar();
                friendlyResponse += '\nRecordatorios: ' + (response.reminders.useDefault ? 'default, ' : '') + ((response.reminders.overrides || []).map((item) => {
                    return endDate.clone().diff(endDate.clone().subtract(item.minutes, 'minutes'), 'minutes') + ' minutos antes';
                })).join(', ');
                friendlyResponse += '\nLink: ' + response.htmlLink;
                resolve(friendlyResponse);
            }).catch(reject);
        });
    }

    _doAuth(userId, authCode) {
        return new Promise((resolve, reject) => {
            const oauth2Client = this._createAuthClient();
            oauth2Client.getToken(authCode, (err, credentials) => {
                if (err) {
                    return reject(new Error('Error trying to retrieve access token: ' + err.message));
                }
                this.db.collection('clients').updateOne({userId: userId}, {$set: {credentials: credentials}})
                    .then(() => {
                        this.bot.sendMessage(userId, 'Successfully authorized! You can start using me now! Type /help for instructions.');
                    })
                    .catch(err => {
                        console.log(err.stack);
                        this.bot.sendMessage(userId, 'Unexpected error occurred: ' + err.message);
                    });
            });
        });
    }

    _sendAuthUrl(userId) {
        const oauth2Client = this._createAuthClient();
        const authUrl = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: 'https://www.googleapis.com/auth/calendar'
        });
        this.bot.sendMessage(userId, 'You must first authorize me! Open the following link and send me the activation code:\n' + authUrl).then(() => {
            this.db.collection('clients').insertOne({userId: userId}).catch(err => {
                console.log(err.stack);
                this.bot.sendMessage(userId, 'Unexpected error occurred: ' + err.message);
            });
        });
    }

    _createEventFromInput(text) {
        const result = this.stringParser.parse(this.lang, text);
        if (!result) return null;
        let eventData = {
            calendarId: 'primary',
            resource: {
                summary: result.text,
                start: {
                    dateTime: result.start,
                    timeZone: this.timeZone
                },
                end: {
                    dateTime: result.end,
                    timeZone: this.timeZone
                }
            }
        };
        if (result.reminder) {
            eventData.resource.reminders = {
                useDefault: false,
                overrides: [
                    {method: 'popup', minutes: result.reminder}
                ]
            }
        }
        return eventData;
    }

    _parseCmd(text) {

    }
}

module.exports = Bot;
