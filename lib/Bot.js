'use strict';

const moment = require('moment');
const TelegramBot = require('node-telegram-bot-api');
const GoogleAuth = require('google-auth-library');
const MongoClient = require('mongodb').MongoClient;
const ObjectId = require('mongodb').ObjectID;

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
        MongoClient.connect(config.db).then(db => {
            this.db = db;
            this.bot = new TelegramBot(telegramBotToken, {polling: true});
            this._initBot();
        })
        .catch(err => {
            console.log(err.stack);
        })
    }

    _initBot() {
        this.bot.on('message', msg => {
            const userId = msg.from.id;
            const text = msg.text.trim();
            this._checkAuth(userId).then((user) => {
                console.log(user)
                if (!user) {
                    // first message, send auth url
                    this._sendAuthUrl(userId);
                } else if (!user.credentials) {
                    // pending authorization, check code and store credentials
                    this._doAuth(userId, text);
                } else {
                    let oauth2Client = this._createAuthClient();
                    oauth2Client.setCredentials(user.credentials);
                    // client is authorized, parse text and add event
                    this._addEvent(oauth2Client, this._parseText(text)).then(eventDetails => {
                        this.bot.sendMessage(userId, 'Event successfully created!\n' + require('util').inspect(eventDetails));
                    })
                    .catch(err => {
                        console.log(err.stack);
                        this.bot.sendMessage(userId, err.message);
                    });
                }
            }).catch(err => {
                console.log(err.stack);
                this.bot.sendMessage(userId, err.message);
            });
        });
    }

    _createAuthClient() {
        return new auth.OAuth2(this.appCredentials.id, this.appCredentials.secret, this.appCredentials.redirectUrl);
    }

    _checkAuth(userId) {
        return this.db.collection('clients').findOne({userId: userId});
    }

    _addEvent(oauth2Client, eventData) {
        eventData.auth = oauth2Client;
        return gplug.addEvent(eventData);
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
                        this.bot.sendMessage(userId, 'Successfully authorized! You can start using me now!');
                    })
                    .catch(err => {
                        console.log(err.stack);
                        this.bot.sendMessage(userId, err.message);
                    });
            });
        });
    }

    _sendAuthUrl(userId) {
        const oauth2Client = this._createAuthClient();
        var authUrl = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: 'https://www.googleapis.com/auth/calendar'
        });
        this.bot.sendMessage(userId, 'You must first authorize me! Open the following link and send me the activation code: ' + authUrl).then(() => {
            this.db.collection('clients').insertOne({userId: userId}).catch(this._handleError);
        });
    }

    _parseText(text) {
        // parse and add event
        const eventData = {
            calendarId: 'primary',
            text: 'Psiquiatra at av. maipu 1657 on March 5th 3pm-4pm'
        };
        return eventData;
    }

    _handleError(err) {
        console.log(err.stack);
    }
}

module.exports = Bot;
