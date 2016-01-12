'use strict';

var Promise = require('bluebird');
var sqlite3 = require('sqlite3').verbose();
var Logger = require('./logger');
var Hangouts = require('./hangouts');
var Person = require('./Person');
var moment = require('moment');
var people = {};
let UNKNOWN = 4;

var personForID = function(data) {
  for (var id in people) {
    if (people[id].getGoogle().indexOf(data) >= 0) {
      return people[id].id;
    }
    if (people[id].getPhones().indexOf(data) >= 0) {
      return people[id].id;
    }
  }
  return UNKNOWN;
};

var loadPeople = function() {
  var db = Promise.promisifyAll(new sqlite3.Database('hangouts.sqlite3'));

  people = {};
  var sql = 'CREATE TABLE IF NOT EXISTS `sg_people` ( `id` INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, `name` TEXT NOT NULL DEFAULT "unknown"); '+
    'CREATE TABLE IF NOT EXISTS `sg_google` ( `id` INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, `personID` INTEGER NOT NULL DEFAULT "0", `googleID` TEXT NOT NULL); '+
    'CREATE TABLE IF NOT EXISTS `sg_phones` ( `id` INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, `personID` INTEGER NOT NULL DEFAULT "0", `phone` TEXT NOT NULL);';

  var promise = db.runAsync(sql)
  .then(function() {
    return db.allAsync('SELECT * FROM  `sg_people`');
  }).then(function(rows) {
    var promises = [];

    for (var i = 0; i < rows.length; i++) {
      var tempPerson = new Person(rows[i].id,rows[i].name);
      people[tempPerson.id] = tempPerson;
      promises.push(db.allAsync('SELECT * FROM  `sg_phones` WHERE  `personID` = '+tempPerson.id+';'));
      promises.push(db.allAsync('SELECT * FROM  `sg_google` WHERE  `personID` = '+tempPerson.id+';'));
    }
    return Promise.all(promises);
  })
  .then(function(results) {
    // Save phones and google ids to persons
    for (var i = 0; i < results.length; i++) {
      for (var j = 0; j < results[i].length; j++) {
        var data = results[i][j];
        var personID = data.personID;
        if (data.hasOwnProperty('phone')) {
          people[data.personID]._phones.push(data.phone);
        }
        if (data.hasOwnProperty('googleID')) {
          people[data.personID]._google.push(data.googleID);
        }
      }
    }
  })
  .then(function() {
    // Close up everything
    db.close();
  })
  .then(function() {
    return people;
  })

  return promise;
};

module.exports = {
  loadPeople: loadPeople,
  sendConversations: function(conversations) {
    var dates = [];
    var db = Promise.promisifyAll(new sqlite3.Database('hangouts.sqlite3'));

    // Setup table
    var sql = 'CREATE TABLE IF NOT EXISTS `sg_messages` ( '+
        '`id` INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, '+
        '`personID` INTEGER NOT NULL,   '+
        '`body` TEXT NOT NULL,   '+
        '`date` TEXT NOT NULL,   '+
        '`timestamp` INTEGER NOT NULL,   '+
        '`incoming` INTEGER NOT NULL DEFAULT 0,   '+
        '`type` INTEGER NOT NULL DEFAULT 0 '+
      ');';

    var promise = db.runAsync(sql).then(function() {
      return db.allAsync('SELECT timestamp FROM sg_messages ORDER BY sg_messages.timestamp  ASC');
    }).then(function(rows) {
      // Get dates
      dates = {};
      for (var k = 0; k < rows.length; k++) {
        dates[rows[k].timestamp] = true;
      }
      return dates;
    }).then(function() {
      // Get people
      return loadPeople();
    }).then(function() {
      // Send Data
      var unknownArray = [];

      var p = new Promise(function (resolve, reject) {

        var stmt = db.prepare('INSERT INTO `sg_messages` (`personID`, `body`, `date`, `timestamp`) VALUES (?, ?, ?, ?)');

        for (var i = 0; i < conversations.length; i++) {
          var messages = conversations[i].messages
          for (var j = 0; j < messages.length; j++) {
            var message = Hangouts.messageFormatter(messages[j]);
            message.personID = personForID(message.personID, people);
            if (message.personID === UNKNOWN && unknownArray.indexOf(message.googleID) === -1) {
              unknownArray.push(message.googleID);
              console.log('Could not find person for ',message.sender, '(',message.googleID,')');
            }

            if (dates[message.timestamp]) {
              continue;
            }
            dates[message.timestamp] = true;

            var dateWrapper = moment(message.date);
            stmt.run(message.personID,message.body,dateWrapper.format(),message.timestamp);
          }
        }

        stmt.finalize(resolve);
      });

      return p;
    }).then(function() {
      return db.closeAsync();
    });

    return promise;

  },
  loadMessages: function() {
    var conversations = {};
    var db = Promise.promisifyAll(new sqlite3.Database('hangouts.sqlite3'));

    var promise = db.allAsync('SELECT * FROM  `sg_messages`;')
    .then(function(results) {
      db.close();

      for (var i = 0; i < results.length; i++) {
        if (!conversations[results[i].personID]) {
          conversations[results[i].personID] = []
        }
        conversations[results[i].personID].push(results[i]);
      }
    })
    .then(function() {
      // Get people
      return loadPeople();
    })
    .then(function(people) {
      conversations.people = people;
      return conversations;
    });

    return promise;
  }
};
