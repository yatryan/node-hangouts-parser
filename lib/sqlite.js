'use strict';

var fs = require('fs');
var Promise = require('bluebird');
var sqlite3 = require('sqlite3').verbose();
var Logger = require('./logger');
var Hangouts = require('./hangouts');
var Facebook = require('./facebook');
var Person = require('./Person');
var moment = require('moment');
var sha1 = require("crypto-js/sha1");
var people = {};
var hashes = {};
var unknownArray = [];
var peopleToAdd = [];
let UNKNOWN = 1;

var db;

var sha1Hash = function(message) {
  var shaMessage = message.body+''+message.timestamp;
  return sha1(shaMessage);
};

var personForID = function(data) {
  for (var id in people) {
    if (people[id].getGoogle().indexOf(data) >= 0) {
      return people[id].id;
    }
    if (people[id].getPhones().indexOf(data) >= 0) {
      return people[id].id;
    }
    if (people[id].getFacebook().indexOf(data) >= 0) {
      return people[id].id;
    }
  }
  return -1;
};

var addPerson = function(person) {
  return db.getAsync('SELECT * FROM sg_people WHERE name=$name', { $name:person.getName() }).then(function(result) {
    if (!!result) {
      person.id = result.id;
      return person;
    }

    return new Promise(function (resolve, reject) {
      db.run('INSERT INTO sg_people(name) VALUES (?)', person.getName(), function() {
        person.id = this.lastID;
        resolve(person);
      })
    });

  }).then(function(person) {
    // facebook
    var stmt = db.prepare('INSERT INTO sg_facebook(personID,facebook) VALUES (?,?)');
    var facebooks = person.getFacebook();

    return new Promise(function (resolve, reject) {
      for (var i = 0; i < facebooks.length; i++) {
        if (!person.id) {
          console.log('Error with ',person);
          continue;
        }
        stmt.run(person.id, facebooks[i]);
      }
      stmt.finalize(function() {
        if (facebooks.length > 0) {
          console.log('Added Facebooks for '+person.getName());
        }

        resolve(person);
      });
    });
  }).then(function(person) {
    // google
    var stmt = db.prepare('INSERT INTO sg_google(personID,googleID) VALUES (?,?)');
    var googles = person.getGoogle();
    for (var i = 0; i < googles.length; i++) {
      stmt.run(person.id, googles[i]);
    }
    stmt.finalize();
    if (googles.length > 0) {
      console.log('Added Googles for '+person.getName());
    }
    return person;
  });

};

var loadPeople = function() {
  people = {};
  var sql = [
    'CREATE TABLE IF NOT EXISTS `sg_people` ( `id` INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, `name` TEXT NOT NULL DEFAULT "unknown"); ',
    'INSERT OR IGNORE INTO sg_people(id) VALUES('+UNKNOWN+')',
    'CREATE TABLE IF NOT EXISTS `sg_google` ( `id` INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, `personID` INTEGER NOT NULL DEFAULT "0", `googleID` TEXT NOT NULL); ',
    'CREATE TABLE IF NOT EXISTS `sg_phones` ( `id` INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, `personID` INTEGER NOT NULL DEFAULT "0", `phone` TEXT NOT NULL);',
    'CREATE TABLE IF NOT EXISTS `sg_facebook` ( `id` INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, `personID` INTEGER NOT NULL DEFAULT "0", `facebook` TEXT NOT NULL);'
  ];

  var promise = db.runAsync(sql[0])
  .then(function() {
    // Add unknown user if needed
    return db.runAsync(sql[1]);
  })
  .then(function() {
    // Create google table
    return db.runAsync(sql[2]);
  })
  .then(function() {
    // Create phones table
    return db.runAsync(sql[3]);
  })
  .then(function() {
    // Create facebook table
    return db.runAsync(sql[4]);
  })
  .then(function() {
    return db.allAsync('SELECT * FROM  `sg_people`');
  }).then(function(rows) {
    var promises = [];

    for (var i = 0; i < rows.length; i++) {
      var tempPerson = new Person(rows[i].id,rows[i].name);
      people[tempPerson.id] = tempPerson;
      promises.push(db.allAsync('SELECT * FROM  `sg_phones` WHERE  `personID` = '+tempPerson.id+';'));
      promises.push(db.allAsync('SELECT * FROM  `sg_google` WHERE  `personID` = '+tempPerson.id+';'));
      promises.push(db.allAsync('SELECT * FROM  `sg_facebook` WHERE  `personID` = '+tempPerson.id+';'));
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
        if (data.hasOwnProperty('facebook')) {
          people[data.personID]._facebook.push(data.facebook);
        }
      }
    }
  })
  .then(function() {
    return people;
  })

  return promise;
};

var sendHangouts = function(db, conversations) {
  // Send Data
  var p = new Promise(function (resolve, reject) {

    var stmt = db.prepare('INSERT INTO `sg_messages` (`personID`, `body`, `date`, `timestamp`) VALUES (?, ?, ?, ?)');

    for (var i = 0; i < conversations.length; i++) {
      var messages = conversations[i].messages
      for (var j = 0; j < messages.length; j++) {
        var message = Hangouts.messageFormatter(messages[j]);
        message.personID = personForID(message.personID, people);
        if (message.personID === -1 && unknownArray.indexOf(message.googleID) === -1) {
          unknownArray.push(message.googleID);
          console.log('Could not find person for ',message.sender, '(',message.googleID,')');
        }

        if (unknownArray.indexOf(message.googleID) > -1) {
          continue;
        }

        var shaHash = sha1Hash(message);
        if (hashes[shaHash]) {
          continue;
        }
        hashes[shaHash] = true;

        var dateWrapper = moment(message.date);
        stmt.run(message.personID,message.body,dateWrapper.format(),message.timestamp);
      }
    }

    stmt.finalize(resolve);
  });

  return p;
};

var sendFacebook = function(db, threads) {
  var p = new Promise(function (resolve, reject) {

    var stmt = db.prepare('INSERT INTO `sg_messages` (`personID`, `body`, `date`, `timestamp`) VALUES (?, ?, ?, ?)');

    for (var i = 0; i < threads.length; i++) {
      var messages = threads[i].messages;

      for (var j = 0; j < messages.length; j++) {
        var message = Facebook.messageFormatter(messages[j]);
        message.personID = personForID(message.personID, people);

        if (message.personID === -1 && unknownArray.indexOf(message.facebookID) === -1) {
          unknownArray.push(message.facebookID);
          console.log('Could not find person for ',message.sender);

          var promise = Facebook.getPersonForMessage(message).then(function(res) {
            var newPerson = new Person(res.id, res.name);
            newPerson._facebook.push(res.email);
            return newPerson;
          }, function(err){
            // Error
            if (err) {
              console.log('err',err);
            }
          });

          peopleToAdd.push(promise);
        }

        var shaHash = sha1Hash(message);
        if (hashes[shaHash]) {
          continue;
        }
        hashes[shaHash] = true;

        var dateWrapper = moment(message.date);
        stmt.run(message.personID,message.body,dateWrapper.format(),message.timestamp);

      }
    }

    stmt.finalize(resolve);

  });

  return p;
};

module.exports = {
  init: function() {
    db = Promise.promisifyAll(new sqlite3.Database('hangouts.sqlite3'));
  },
  close: function() {
    return db.closeAsync();
  },
  loadPeople: loadPeople,
  sendConversations: function(data, type) {

    if (type === undefined) {
        type = 'hangouts';
    }

    hashes = {};
    unknownArray = [];

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

    return db.runAsync(sql).then(function() {
      return db.allAsync('SELECT body,timestamp FROM sg_messages ORDER BY sg_messages.timestamp  ASC');
    }).then(function(rows) {
      // Get hashes
      hashes = {};
      for (var k = 0; k < rows.length; k++) {
        hashes[sha1Hash(rows[k])] = true;
      }
      return hashes;
    }).then(function() {
      // Get people
      return loadPeople();
    }).then(function() {

      //Handle Different Types of data
      if (type === 'hangouts') {
        return sendHangouts(db, data);
      } else if (type === 'facebook') {
        return sendFacebook(db, data);
      }

      return -1;
    }).then(function() {

      Promise.all(peopleToAdd).then(function(results) {
        for (var i = 0; i < results.length; i++) {
          if (results[i]) {
            addPerson(results[i]);
          }
        }
      });

    });

  },
  loadMessages: function() {
    var conversations = {};

    var promise = db.allAsync('SELECT * FROM  `sg_messages`;')
    .then(function(results) {

      for (var i = 0; i < results.length; i++) {
        var personID = results[i].personID;
        if (personID == 2) {
          continue;
        }
        if (!conversations[personID]) {
          conversations[personID] = []
        }
        conversations[personID].push(results[i]);
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
  },
  addPerson: addPerson
};
