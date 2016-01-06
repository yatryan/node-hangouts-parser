'use strict';

var Promise = require('bluebird');
var Logger = require('./logger');
var fs = require('fs');

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
  },
  generateLineGraph: function(people, mode) {
    // default mode: year
    mode = mode || 'year';
    var returnObj = {
      '_labels': [],
      '_data': [],
      '_people': []
    };

    switch (mode) {
      case 'month':
        returnObj._labels = people._months;

        for (var id in people) {
          if (people.hasOwnProperty(id)) {
            if (id === '1' || id === '_months' || id === '_years' || id === 'people') {
              continue;
            }

            returnObj._people.push(id);

            var array = [];
            for (var i = 0; i < returnObj._labels.length; i++) {
              var count = 0;
              if(people[id].months && people[id].months[returnObj._labels[i]]){
                count = people[id].months[returnObj._labels[i]].length;
              }
              array.push(count);
            }
            returnObj._data.push(array);
          }
        }
        fs.writeFileSync('web/json/months.json',JSON.stringify(returnObj, null, 2));
        Logger.info('Wrote months to web/json/months.json');
        break;
      default:
        // Year
        returnObj._labels = people._years;

        for (var id in people) {
          if (people.hasOwnProperty(id)) {
            if (id === '1' || id === '_months' || id === '_years' || id === 'people') {
              continue;
            }

            returnObj._people.push(id);

            var array = [];
            for (var i = 0; i < returnObj._labels.length; i++) {
              var count = 0;
              if(people[id].years && people[id].years[returnObj._labels[i]]){
                count = people[id].years[returnObj._labels[i]].length;
              }
              array.push(count);
            }
            returnObj._data.push(array);
          }
        }
        fs.writeFileSync('web/json/years.json',JSON.stringify(returnObj, null, 2));
        Logger.info('Wrote years to web/json/years.json');
        break;
    }

    return returnObj;
  }
};
