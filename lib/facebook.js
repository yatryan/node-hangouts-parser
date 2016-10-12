'use strict';

var fs = require('fs');
var cheerio = require('cheerio');
var moment = require('moment');

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

      var threads = [];
      let fileContents = fs.readFileSync(file, 'utf-8');

      var $ = cheerio.load(fileContents);
      $("div.thread").each(function(index) {
          var thread = {};
          var messages_per_thread = [];

          var thread_node = $(this);
          var text = thread_node.text();

          thread_node.children('div.message').each(function() {
              var message_tag = $(this);
              var message_header = message_tag.children().first();
              var user = message_header.children().eq(0).text();
              var date = message_header.children().eq(1).text();
              var message_text = message_tag.next().text();

              var dateWrapper = moment(date, "dddd, MMMM DD, YYYY [at] hh:mma");

              var message = {
                  user : user,
                  date : date,
                  datetime: dateWrapper,
                  timestamp : dateWrapper.valueOf()*1000,
                  text : message_text
              }

              if (message_text !== '') {
                messages_per_thread.push(message);
              }
          });
          thread.messages = messages_per_thread;
          thread_node.children().remove();
          thread.users = thread_node.text();
          if (thread.messages.length > 0) {
            threads.push(thread);
          }
      });

      return threads;
    }
  },
  messageFormatter: function (message) {
    return {
      sender: message.user,
      personID: message.user,
      facebookID: message.user,
      body: message.text,
      date: message.datetime,
      timestamp: message.timestamp
    };
  }
};
