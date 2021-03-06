'use strict';

require('dotenv').config();
var fs = require('fs');
var Promise = require('bluebird');
// var auth = require('./auth');
// var Google = require('googleapis');
// var OAuth2 = Google.auth.OAuth2;
// var oauth2Client = new OAuth2(process.env.CLIENT_ID, process.env.CLIENT_SECRET, process.env.REDIRECT_URL);
// Google.options({ auth: oauth2Client });
// var plus = Google.plus('v1');

String.prototype.replaceArray = function(find, replace) {
  var replaceString = this;
  var regex;
  for (var i = 0; i < find.length; i++) {
    regex = new RegExp(find[i], "g");
    replaceString = replaceString.replace(regex, replace[i]);
  }
  return replaceString;
};

var replaceSmileys = function(message) {
  return message;
}

module.exports = {
  parser: {
    parse: function(file) {
      // set the desired timestamp format here
      // the default is 'Y-m-d H:i:s' which is YYYY-MM-DD HH:mm:ss.
      let timestamp_format = 'Y-m-d H:i:s';

      let fileContents = fs.readFileSync(file);
      let jsonObject = JSON.parse(fileContents);

      var fileConversations = jsonObject.conversations;
      var conversations = [];

      for (var i = 0; i < fileConversations.length; i++) {
        var rawConversation = fileConversations[i];
        var conversation = rawConversation.conversation.conversation;
        var conversationEvents = rawConversation.events;
        var participantData = conversation.participant_data;

        var type = conversation.type;
        var msgcount = conversationEvents.length;
        var name = conversation.name || "";
        var members = {};
        var messages = [];

        // conversation participants
        for (var j = 0; j < participantData.length; j++) {
          var id = participantData[j].id.chat_id;
          var name = participantData[j].fallback_name || ('unknown_'+id);
          members[id] = name;
        }

        for (var k = 0; k < conversationEvents.length; k++) {
          let rawMessage = conversationEvents[k];
          var message = {
            timestamp: rawMessage.timestamp,
            datetime: rawMessage.timestamp,
            senderId: rawMessage.sender_id.chat_id,
            eventType: rawMessage.event_type
          };
          message.sender = members[message.senderId] ? members[message.senderId] : 'unknown_'+message.senderId;
          message.datetime = new Date(parseInt(parseInt(message.timestamp)/1000));

          switch (message.eventType) {
            case 'RENAME_CONVERSATION':
              var newName = rawMessage.conversation_rename.new_name;
              var oldName = rawMessage.conversation_rename.old_name;
              message.message = 'changed conversation name from \''+oldName+'\' '+'to \''+newName+'\'';
              break;
            case 'HANGOUT_EVENT':
              switch (rawMessage.hangout_event.event_type) {
                case 'START_HANGOUT':
                  message.message = 'started a video chat';
                  break;
                case 'END_HANGOUT':
                  message.message = 'ended a video chat';
                  break;
                default:
                  message.message = rawMessage.hangout_event.event_type;
              }
              break;
            case 'REGULAR_CHAT_MESSAGE':
              message.message = '';
              var msg = '';
              var msghtml = '';
              // join message segments together
              if (rawMessage.chat_message.message_content.segment) {
                var segments = rawMessage.chat_message.message_content.segment;
                for (var key in segments) {
                  if (segments.hasOwnProperty(key)) {
                    var segment = segments[key];
                    if (!segment.text) {
                      continue;
                    }
                    if (segment.type === 'TEXT' || segment.type === 'LINE_BREAK') {
                      msg += segment.text;
                      msghtml += segment.text.replace('\n', '<br>');
                    } else if (segment.type === 'LINK') {
                      msg += segment.text;
                      msghtml += '<a href="'+segment.link_data.link_target+'" target="_blank">'+segment.text+'</a>';
                    }
                  }
                }
              }
              // handle attachments
              else if (rawMessage.chat_message.message_content.attachment) {
                var attachments = rawMessage.chat_message.message_content.attachment;
                for (var key in attachments) {
                  if (attachments.hasOwnProperty(key)) {
                    var attachment = attachments[key];
                    if (attachment.embed_item.type[0] === 'PLUS_PHOTO') {
                      var imgurl = attachment.embed_item.plus_photo.url;
                      msg += imgurl;
                      msghtml += '<a href="'+imgurl+'" target="_blank"><img src="'+imgurl+'" alt="attached image" style="max-width:100%"></a>';
                    }
                  }
                }
              }
              // replace unicode emoticon characters by smileys
              message.message = replaceSmileys(msg);
              message.messageHTML = replaceSmileys(msghtml);
              break;
            case 'ADD_USER':
              var newUserId = rawMessage.membership_change.participant_id[0].chat_id;
              var newUsername = members[newUserId] ? members[newUserId] : 'unknown_'+newUserId;
              message.message = 'added user \''+newUsername+'\' to conversation';
              break;
            case 'REMOVE_USER':
              var newUserId = rawMessage.membership_change.participant_id[0].chat_id;
              var newUsername = members[newUserId] ? members[newUserId] : 'unknown_'+newUserId;
              message.message = 'removed user \''+newUsername+'\' to conversation';
              break;
            case 'SMS':
              var msg = '';
              // join message segments together
              if (rawMessage.chat_message.message_content.segment) {
                var segments = rawMessage.chat_message.message_content.segment;
                for (var key in segments) {
                  if (segments.hasOwnProperty(key)) {
                    var segment = segments[key];
                    if (!segment.text) {
                      continue;
                    }
                    msg += segment.text;
                  }
                }
              }
              message.message = replaceSmileys(msg);
              break;
            case 'OTR_MODIFICATION':
              message.message = 'unknown OTR_MODIFICATION';
              break;
            case 'VOICEMAIL':
              var msg = "new voicemail:\n";
              // join message segments together
              if (rawMessage.chat_message.message_content.segment) {
                var segments = rawMessage.chat_message.message_content.segment;
                for (var key in segments) {
                  if (segments.hasOwnProperty(key)) {
                    var segment = segments[key];
                    if (!segment.text) {
                      continue;
                    }
                    msg += segment.text;
                  }
                }
              }
              // replace unicode emoticon characters by smileys
              message.message = replaceSmileys(msg);
              break;
            default:

          }

          messages.push(message);
        }

        // sort messages by timestamp because for some reason they're cluttered
        messages.sort(function(a, b) {
          return a.timestamp - b.timestamp;
        });
        // add the messages array to the conversation array
        conversations.push({
          type: type,
          msgcount: msgcount,
          members: members,
          messages: messages
        });
      }

      //console.log(conversations.length);
      return conversations;
    }
  },
  messageFormatter: function (message) {
    return {
      sender: message.sender,
      personID: message.senderId,
      googleID: message.senderId,
      body: message.message,
      date: message.datetime,
      timestamp: message.timestamp
    };
  },
  getPersonForMessage: function (message) {
    var user = message.sender;
    var googleID = message.googleID;

    console.log(googleID);

    var p = new Promise(function (resolve, reject) {
      if (!googleID) {
        reject();
        return;
      }

      var request = plus.people.get({ key: API_KEY, userId: googleID }, function(err,user) {

        if (err) {
          reject(err);
          return;
        }

        resolve(user);
      });
    });

    return p;

  },
  oauth: function() {
    auth.getToken().then(function(token) {
      oauth2Client.setCredentials({ access_token: token });

      plus.people.get({ userId: 'me', auth: oauth2Client }, function(err, response) {
        console.log(response.displayName);
      });
    });
  }
};
