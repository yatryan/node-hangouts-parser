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
  },
  generateC3LineGraph: function(people, mode) {
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
  generatePieGraph: function(people) {
    var returnObj = {
      '_labels': [],
      '_data': [],
      '_people': []
    };
    var labels = people._years;

    for (var id in people) {
      if (people.hasOwnProperty(id)) {
        if (id === '1' || id === '_months' || id === '_years' || id === 'people') {
          continue;
        }

        returnObj._people.push(id);

        var sum = 0;
        for (var i = 0; i < labels.length; i++) {
          if(people[id].years && people[id].years[labels[i]]){
            sum += people[id].years[labels[i]].length;
          }
        }

        returnObj._data.push(sum);
      }
    }

    fs.writeFileSync('lib/api/json/pie.json',JSON.stringify(returnObj, null, 2));
    Logger.info('Wrote Pie to lib/api/json/pie.json');

    return returnObj;
  }
};
