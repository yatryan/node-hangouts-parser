'use strict';

var Promise = require('bluebird');
var Logger = require('./logger');
var fs = require('fs');

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
    var people = {
      '_months':{},
      '_years':{}
    };

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

    delete people._months;
    delete people._years;

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
    mode = mode || 'year';
    var returnArr = [];
    var returnObj = {
      '_labels': [],
      '_data': [],
      '_people': []
    };
    console.log(people);

    switch (mode) {
      case 'month':
        var months = [];

        for (var i = 0; i < people.length; i++) {
          var person = people[i];
          var id = person.id;
          if (id === '1' || id === '_months' || id === '_years' || id === 'people') {
            continue;
          }
          var array = [person.name];
          for (var j = 0; j < person.months.length; j++) {
            var count = 0;
            if(person.months && person.months[j]){
              count = person.months[j].length;
            }
            array.push(count);
          }
          returnArr.push(array);
        }

        // for (var id in people) {
        //   if (people.hasOwnProperty(id)) {
        //     if (id === '1' || id === '_months' || id === '_years' || id === 'people') {
        //       continue;
        //     }
        //
        //     var array = [people[id].name];
        //     for (var i = 0; i < returnObj._labels.length; i++) {
        //       var count = 0;
        //       if(people[id].months && people[id].months[returnObj._labels[i]]){
        //         count = people[id].months[returnObj._labels[i]].length;
        //       }
        //       array.push(count);
        //     }
        //     returnArr.push(array);
        //   }
        // }
        
        // returnArr.unshift(people._months.unshift('x'));

        fs.writeFileSync('web/json/months-c3.json',JSON.stringify(returnArr, null, 2));
        Logger.info('Wrote months to web/json/months-c3.json');
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
        fs.writeFileSync('web/json/years-c3.json',JSON.stringify(returnObj, null, 2));
        Logger.info('Wrote years to web/json/years-c3.json');
        break;
    }

    return returnObj;
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

    fs.writeFileSync('web/json/pie.json',JSON.stringify(returnObj, null, 2));
    Logger.info('Wrote Pie to web/json/pie.json');

    return returnObj;
  }
};
