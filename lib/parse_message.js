var ircColors = require('irc-colors');
var replyFor = require('./codes');

/**
 * parseMessage(line, stripColors)
 *
 * takes a raw "line" from the IRC server and turns it into an object with
 * useful keys
 * @param {String} line Raw message from IRC server.
 * @param {Boolean} stripColors If true, strip IRC colors.
 * @return {Object} A parsed message object.
 */
module.exports = function parseMessage(line, stripColors) {
    var message = {};
    var match;

    if (stripColors) {
        line = ircColors.stripColorsAndStyle(line);
    }


    // The first thing we check for is IRCv3.2 message tags.
    // http://ircv3.atheme.org/specification/message-tags-3.2
    // cherry picked from https://github.com/sigkell/irc-message/
    if (line.charCodeAt(0) === 64) {
        var nextspace = line.indexOf(' ')

        if (nextspace === -1) {
            // Malformed IRC message.
            return null
        }

        // Tags are split by a semi colon.
        var rawTags = line.slice(1, nextspace).split(';')
        message.tags = {};

        for (var i = 0; i < rawTags.length; i++) {
            // Tags delimited by an equals sign are key=value tags.
            // If there's no equals, we assign the tag a value of true.
            var tag = rawTags[i]
            var pair = tag.split('=')

            // this is a patch for tag name containing a -
            // makes parsing them later much easier…
            message.tags[pair[0].replace(/-/g, '_')] = pair[1] || true
        }

        if (typeof message.tags['emotes'] === 'string') {
            var emoticons = message.tags['emotes'].split('/');
            var emotes = {};

            for (var i = 0; i < emoticons.length; i++) {
                var parts = emoticons[i].split(':');
                emotes[parts[0]] = parts[1].split(',');
            }
            message.tags.emote = emotes;
        }

        if (typeof message.tags['badges'] === 'string') {
            var badges = message.tags['badges'].split(',');
            message.tags.badges = badges;
        }

        position = nextspace + 1

        // strip the message back to non IRCv3
        // to easy pass to the base parser
        line = line.substr(position);
    }

    // Parse prefix
    match = line.match(/^:([^ ]+) +/);
    if (match) {
        message.prefix = match[1];
        line = line.replace(/^:[^ ]+ +/, '');
        match = message.prefix.match(/^([_a-zA-Z0-9\~\[\]\\`^{}|-]*)(!([^@]+)@(.*))?$/);
        if (match) {
            message.nick = match[1];
            message.user = match[3];
            message.host = match[4];
        }
        else {
            message.server = message.prefix;
        }
    }

    // Parse command
    match = line.match(/^([^ ]+) */);
    message.command = match[1];
    message.rawCommand = match[1];
    message.commandType = 'normal';
    line = line.replace(/^[^ ]+ +/, '');

    if (replyFor[message.rawCommand]) {
        message.command     = replyFor[message.rawCommand].name;
        message.commandType = replyFor[message.rawCommand].type;
    }

    message.args = [];
    var middle, trailing;

    // Parse parameters
    if (line.search(/^:|\s+:/) != -1) {
        match = line.match(/(.*?)(?:^:|\s+:)(.*)/);
        middle = match[1].trimRight();
        trailing = match[2];
    }
    else {
        middle = line;
    }

    if (middle.length)
        message.args = middle.split(/ +/);

    if (typeof (trailing) != 'undefined' && trailing.length)
        message.args.push(trailing);

    return message;
}
