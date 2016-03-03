# Telegram bot using Google Calendar API #

This bot can interact with Google Calendar API, allowing you to easily add/manage events.

## Interaction ##

You can just add an event to your default calendar by sending a message to the bot following these rules:

`<event name> <when> <reminder>`

`<when>` can be specified using multiple formats. Examples:
    * tomorrow 6pm
    * next wednesday
    * next monday 9am
    * april 10
`<reminder>` Examples:
    * 10m *10 minutes before*
    * 1h *1 hour before*
    * 1d *1 day before*

## Setup ##

    * Create a bot: https://core.telegram.org/bots
    * Create a config.json file in the root directory with the following schema:
    * Register your app using Google developers console: https://console.developers.google.com/
    * Download and save your `client_secret.json` in the root directory

    ```
    {
        "telegramBotToken": "..."
    }

    ```
    * `npm install && npm start`
