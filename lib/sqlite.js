'use strict';

var fs = require('fs');
var Promise = require('bluebird');
var Database = require('better-sqlite3');
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

  var stmt = db.prepare('SELECT * FROM sg_people WHERE name = ?');

  result = stmt.get(person.getName());

  if (!!result) {
    person.id = result.id;
    return person;
  }

  stmt = db.prepare('INSERT INTO sg_people(name) VALUES (?)');
  var info = stmt.run(person.getName());
  person.id = info.lastInsertROWID;

  // facebook
  stmt = db.prepare('INSERT INTO sg_facebook(personID,facebook) VALUES (?,?)');
  var facebooks = person.getFacebook();

  for (var i = 0; i < facebooks.length; i++) {
    if (!person.id) {
      console.log('Error with ',person);
      continue;
    }
    stmt.run(person.id, facebooks[i]);
  }
  if (facebooks.length > 0) {
    console.log('Added Facebooks for '+person.getName());
  }

  // google
  stmt = db.prepare('INSERT INTO sg_google(personID,googleID) VALUES (?,?)');
  var googles = person.getGoogle();
  for (var i = 0; i < googles.length; i++) {
    stmt.run(person.id, googles[i]);
  }
  if (googles.length > 0) {
    console.log('Added Googles for '+person.getName());
  }

  return person;
};

var loadPeople = function() {
  people = {};
  var sql = [
    'CREATE TABLE IF NOT EXISTS `sg_people` ( `id` INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, `name` TEXT NOT NULL DEFAULT "unknown"); ',
    'INSERT OR IGNORE INTO sg_people(id) VALUES('+UNKNOWN+');',// Add unknown user if needed
    'CREATE TABLE IF NOT EXISTS `sg_google` ( `id` INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, `personID` INTEGER NOT NULL DEFAULT "0", `googleID` TEXT NOT NULL); ',// Create google table
    'CREATE TABLE IF NOT EXISTS `sg_phones` ( `id` INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, `personID` INTEGER NOT NULL DEFAULT "0", `phone` TEXT NOT NULL);',// Create phones table
    'CREATE TABLE IF NOT EXISTS `sg_facebook` ( `id` INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, `personID` INTEGER NOT NULL DEFAULT "0", `facebook` TEXT NOT NULL);'// Create facebook table
  ];

  for (var i = 0; i < sql.length; i++) {
    db.exec(sql[i]);
  }

  var rows = db.prepare('SELECT * FROM  `sg_people`').all();

  var results = [];

  for (var i = 0; i < rows.length; i++) {
    var tempPerson = new Person(rows[i].id,rows[i].name);
    people[tempPerson.id] = tempPerson;

    results.push(db.prepare('SELECT * FROM  `sg_phones` WHERE  `personID` = ?;').all(tempPerson.id));
    results.push(db.prepare('SELECT * FROM  `sg_google` WHERE  `personID` = ?;').all(tempPerson.id));
    results.push(db.prepare('SELECT * FROM  `sg_facebook` WHERE  `personID` = ?;').all(tempPerson.id));  
  }

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

  return people;
};

var sendHangouts = function(db, conversations) {
  // Send Data
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
};

var sendFacebook = function(db, threads) {
  var begin = db.prepare('BEGIN');
  var commit = db.prepare('COMMIT');
  var count = 0;

  begin.run();
  var stmt = db.prepare('INSERT INTO `sg_messages` (`personID`, `body`, `date`, `timestamp`) VALUES (?, ?, ?, ?)');

  for (var i = 0; i < threads.length; i++) {
    var messages = threads[i].messages;

    for (var j = 0; j < messages.length; j++) {
      var message = Facebook.messageFormatter(messages[j]);
      message.personID = personForID(message.personID, people);

      if (message.personID === -1 && unknownArray.indexOf(message.facebookID) === -1) {
        unknownArray.push(message.facebookID);
        console.log('Could not find person for ',message.sender, '(',message.facebookID,')');

        res = Facebook.getPersonForMessage(message);
        var newPerson = new Person(res.id, res.name);
        newPerson._facebook.push(res.email);
        peopleToAdd.push(newPerson);
      }

      var shaHash = sha1Hash(message);
      if (hashes[shaHash]) {
        continue;
      }
      hashes[shaHash] = true;

      var dateWrapper = moment(message.date);
      stmt.run(message.personID,message.body,dateWrapper.format(),message.timestamp);
      count++;

      if (count % 1000 == 0) {
        commit.run();
        console.log('Commiting '+count);
        begin.run();
      }

    }
  }

  commit.run();
  console.log('Commiting '+count);
};

var sendFacebookV2 = function(db, threads) {
  var begin = db.prepare('BEGIN');
  var commit = db.prepare('COMMIT');
  var count = 0;

  begin.run();
  var stmt = db.prepare('INSERT INTO `sg_messages` (`personID`, `body`, `date`, `timestamp`) VALUES (?, ?, ?, ?)');

  for (var i = 0; i < threads.length; i++) {
    var messages = threads[i].messages;

    for (var j = 0; j < messages.length; j++) {
      var message = Facebook.messageFormatterV2(messages[j]);
      message.personID = personForID(message.personID, people);

      if (message.personID === -1 && unknownArray.indexOf(message.facebookID) === -1) {
        unknownArray.push(message.facebookID);
        console.log('Could not find person for ',message.sender, '(',message.facebookID,')');

        var res = Facebook.getPersonForMessage(message);
        if (res) {
          var newPerson = new Person(res.id, res.name);
          newPerson._facebook.push(res.email);
          peopleToAdd.push(newPerson);
        }
      }

      var shaHash = sha1Hash(message);
      if (hashes[shaHash]) {
        continue;
      }
      hashes[shaHash] = true;

      var dateWrapper = moment(message.date);
      stmt.run(message.personID,message.body,dateWrapper.format(),message.timestamp);

      count++;

      if (count % 1000 == 0) {
        commit.run();
        console.log('Commiting '+count);
        begin.run();
      }

    }
  }

  commit.run();
  console.log('Commiting '+count);
};

module.exports = {
  init: function() {
    db = new Database('hangouts.sqlite3');
    // db = Promise.promisifyAll(new sqlite3.Database('hangouts.sqlite3'));
  },
  close: function() {
    return db.close();
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

    var stmt = db.prepare(sql);
    stmt.run();

    // Get rows
    stmt = db.prepare('SELECT body,timestamp FROM sg_messages ORDER BY sg_messages.timestamp  ASC');
    var rows = stmt.all();

    // Get hashes
    hashes = {};
    for (var k = 0; k < rows.length; k++) {
      hashes[sha1Hash(rows[k])] = true;
    }

    // Get people
    loadPeople();

    //Handle Different Types of data
    if (type === 'hangouts') {
      sendHangouts(db, data);
    } else if (type === 'facebook') {
      sendFacebook(db, data);
    } else if (type === 'facebookv2') {
      sendFacebookV2(db, data);
    }

    // for (var i = 0; i < results.length; i++) {
    //   if (results[i]) {
    //     addPerson(results[i]);
    //   }
    // }

  },
  loadMessages: function() {
    var conversations = {};

    var stmt = db.prepare('SELECT * FROM  `sg_messages`;');
    var results = stmt.all();

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

    // Get people
    people = loadPeople();

    conversations.people = people;

    return conversations;
  },
  addPerson: addPerson
};
