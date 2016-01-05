'use strict';

var Promise = require('bluebird');

module.exports = {
  compile: function(messages) {
    var people = {
      '_months':{},
      '_years':{}
    };

    for (var id in messages) {
      if (messages.hasOwnProperty(id)) {
        people[id] = {
          messages: messages[id]
        };

        people[id].months = {};
        people[id].years = {};

        for (var i = 0; i < messages[id].length; i++) {
          var message = messages[id][i];
          var messageDate = new Date(message.date);
          var dateString = (messageDate.getMonth()+1) + " " + messageDate.getFullYear();
          var yearString = messageDate.getFullYear();
          people._months[dateString] = true;
          people._years[yearString] = true;

          if (!people[id].months[dateString]) {
            people[id].months[dateString] = [];
          }
          people[id].months[dateString].push(message);

          if (!people[id].years[yearString]) {
            people[id].years[yearString] = [];
          }
          people[id].years[yearString].push(message);
        }

      }
    }

    people._months = Object.keys(people._months).sort(function(a, b) {
      var arrayA = a.split(' ');
      var arrayB = b.split(' ');

      if (arrayA[1] === arrayB[1]) {
        return arrayA[0] - arrayB[0];
      }

      return arrayA[1] - arrayB[1];
    });
    people._years  = Object.keys(people._years).sort();

    for (var id in people) {
      if (people.hasOwnProperty(id) && messages.people.hasOwnProperty(id)) {
        people[id].name = messages.people[id].getName();
      }
    }

    return people;
  }
};
