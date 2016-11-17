'use strict';

var Promise = require('bluebird');
var Logger = require('./logger');
var fs = require('fs');
var moment = require('moment');

function sortMonths(a, b) {
  var arrayA = a.name.split(' ');
  var arrayB = b.name.split(' ');

  if (arrayA[1] === arrayB[1]) {
    return arrayA[0] - arrayB[0];
  }

  return arrayA[1] - arrayB[1];
};

function sortYears(a, b) {
  return a.name - b.name;
};

module.exports = {
  compile: function(messages) {
    var months = {};
    var years = {};
    var people = {};

    for (var id in messages) {
      if (messages.hasOwnProperty(id)) {
        people[id] = {
          messages: messages[id]
        };

        if (messages.people.hasOwnProperty(id)) {
          people[id].name = messages.people[id].getName();
        }

        people[id].months = {};
        people[id].years = {};

        for (var i = 0; i < messages[id].length; i++) {
          var message = messages[id][i];
          var messageDate = new Date(message.date);
          var dateString = (messageDate.getMonth()+1) + " " + messageDate.getFullYear();
          var yearString = messageDate.getFullYear();
          months[dateString] = true;
          years[yearString] = true;

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

    months = Object.keys(months).sort(function(a, b) {
      var arrayA = a.split(' ');
      var arrayB = b.split(' ');

      if (arrayA[1] === arrayB[1]) {
        return arrayA[0] - arrayB[0];
      }

      return arrayA[1] - arrayB[1];
    });
    years  = Object.keys(years).sort();

    var array = [];
    for (var id in people) {
      if (people.hasOwnProperty(id) && parseInt(id)){
        var person = {
          id : id,
          name: people[id].name,
          messages: people[id].messages,
          months: [],
          years: []
        };

        for (var month in people[id].months) {
          if (people[id].months.hasOwnProperty(month)) {
            person.months.push({
              name:month,
              messages: people[id].months[month]
            });
          }
        }

        for (var year in people[id].years) {
          if (people[id].years.hasOwnProperty(year)) {
            person.years.push({
              name:year,
              messages: people[id].years[year]
            });
          }
        }

        person.months.sort(sortMonths);
        person.years.sort(sortYears);

        array.push(person);
      }
    }

    array.push({
      id : '0',
      name: '_data_',
      messages: null,
      months: months,
      years: years
    })

    return array;
  },
  generateC3LineGraph: function(people, mode, limit) {
    // default mode: year
    var returnArr = [];

    switch (mode) {
      case 'month':
        var months = people.filter(function( obj ) {
          return obj.id == 0;
        })[0].months;

        for (var i = 0; i < people.length; i++) {
          var person = people[i];
          var id = person.id;
          if (id === '1' || id === '0') {
            continue;
          }
          var array = [person.name];
          for (var j = 0; j < months.length; j++) {
            array.push(0);
          }

          for (var j = 0; j < person.months.length; j++) {
            var index = months.indexOf(person.months[j].name);
            array[index+1] = person.months[j].messages.length;
          }
          returnArr.push(array);
        }

        returnArr.sort(function(a,b) {
          var aSum = a.slice(1).reduce(function(a, b) { return a + b; }, 0);
          var bSum = b.slice(1).reduce(function(a, b) { return a + b; }, 0);
          if (aSum < bSum)
            return 1;
          if (aSum > bSum)
            return -1;
          return 0;
        });

        if (limit != undefined) {
          returnArr = returnArr.slice(0,limit)
        }

        for (var i = 0; i < months.length; i++) {
          months[i] = moment(months[i], 'MM YYYY').format('M YYYY');
        }
        months.unshift('x');
        returnArr.unshift(months);

        var names = {};
        for (var i = 0; i < returnArr.length; i++) {
          names[returnArr[i][0]] = returnArr[i].slice(1);
        }
        returnArr = names;

        break;
      case 'day':
        var months = people.filter(function( obj ) {
          return obj.id == 0;
        })[0].months;

        var days = [];

        for (var i = 0; i < months.length; i++) {
          var date = moment(months[i], 'MM YYYY');
          var month = date.month();
          while (date.month() === month) {
            days.push(date.format('MM DD YYYY'));
            date.add(1, 'd');
          }
        }

        var array = ["Total"];
        for (var j = 0; j < days.length; j++) {
          array.push(null);
        }

        for (var i = 0; i < people.length; i++) {
          var person = people[i];
          var id = person.id;
          if (id === '1' || id === '0') {
            continue;
          }
          for (var j = 0; j < person.messages.length; j++) {
            var message = person.messages[j];
            var date = moment(message.date).format('MM DD YYYY');
            var index = days.indexOf(date);
            if (array[index+1] === null) {
              array[index+1] = 0;
            }
            array[index+1] += 1;
          }
        }

        returnArr.push(array);
        days.unshift('x');
        returnArr.unshift(days);

        var names = {};
        for (var i = 0; i < returnArr.length; i++) {
          names[returnArr[i][0]] = returnArr[i].slice(1);
        }
        returnArr = names;

        break;
      default:
        // Year
        var years = people.filter(function( obj ) {
          return obj.id == 0;
        })[0].years;

        for (var i = 0; i < people.length; i++) {
          var person = people[i];
          var id = person.id;
          if (id === '1' || id === '0') {
            continue;
          }
          var array = [person.name];
          for (var j = 0; j < years.length; j++) {
            array.push(0);
          }

          for (var j = 0; j < person.years.length; j++) {
            var index = years.indexOf(person.years[j].name);
            array[index+1] = person.years[j].messages.length;
          }
          returnArr.push(array);
        }

        console.log(returnArr[0])

        returnArr.sort(function(a,b) {
          var aSum = a.slice(1).reduce(function(a, b) { return a + b; }, 0);
          var bSum = b.slice(1).reduce(function(a, b) { return a + b; }, 0);
          if (aSum < bSum)
            return 1;
          if (aSum > bSum)
            return -1;
          return 0;
        });

        if (limit != undefined) {
          returnArr = returnArr.slice(0,limit)
        }

        years.unshift('x');
        returnArr.unshift(years);

        var names = {};
        for (var i = 0; i < returnArr.length; i++) {
          names[returnArr[i][0]] = returnArr[i].slice(1);
        }
        returnArr = names;

        break;
    }

    return returnArr;
  },
  generateTimeOfDayGraph: function(people) {
    var returnArr = [];

    for (var i = 0; i < 24; i++) {
      returnArr.push(0);
    }

    for (var i = 0; i < people.length; i++) {
      var person = people[i];
      if (person.id === '1' || person.id === '0') {
        continue;
      }

      for (var j = 0; j < person.years.length; j++) {
        var messages = person.years[j].messages;
        for (var k = 0; k < messages.length; k++) {
          returnArr[(new Date(messages[k].date)).getHours()]++;
        }
      }
    }

    return {
      'Hour of Day': returnArr
    };
  }
};
