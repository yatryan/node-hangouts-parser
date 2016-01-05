'use strict';

var Promise = require('bluebird');
var mysql = require('promise-mysql');
var Logger = require('./logger');
var Hangouts = require('./hangouts');
var Person = require('./Person');
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

var loadPeople = function(loginObj) {
  var database = loginObj.database;
  var connection;
  people = {};
  var promise = mysql.createConnection(loginObj)
  .then(function(conn){
    connection = conn;
  })
  .then(function() {
    // Setup table
    var sql1 = 'CREATE TABLE IF NOT EXISTS `sg_people` ( '+
      ' `id` int(11) NOT NULL AUTO_INCREMENT, '+
      ' `name` varchar(255) NOT NULL DEFAULT "unknown", '+
      ' PRIMARY KEY (`id`) '+
      ' );';

    var sql2 = ' CREATE TABLE IF NOT EXISTS `sg_google` ( '+
      ' `id` int(11) NOT NULL AUTO_INCREMENT, '+
      ' `personID` int(11) NOT NULL DEFAULT "0", '+
      ' `googleID` varchar(255) NOT NULL, '+
      ' PRIMARY KEY (`id`), '+
      ' UNIQUE KEY `googleID` (`googleID`), '+
      ' KEY `person` (`personID`) '+
      ' );';

    var sql3 = ' CREATE TABLE IF NOT EXISTS `sg_phones` ( '+
      ' `id` int(11) NOT NULL AUTO_INCREMENT, '+
      ' `personID` int(11) NOT NULL DEFAULT "0", '+
      ' `phone` varchar(255) NOT NULL, '+
      ' PRIMARY KEY (`id`), '+
      ' KEY `person` (`personID`) '+
      ' );';
    return Promise.all([connection.query(sql1),connection.query(sql2),connection.query(sql3)]);
  })
  .then(function() {
    // Get dates
    var sql = 'SELECT * FROM  `sg_people`';
    return connection.query(sql);
  })
  .then(function(results) {
    var promises = [];

    for (var i = 0; i < results.length; i++) {
      var tempPerson = new Person(results[i].id,results[i].name);
      people[tempPerson.id] = tempPerson;
      var sql1 = 'SELECT * FROM  `sg_phones` WHERE  `personID` = '+tempPerson.id+';';
      var p1 = connection.query(sql1);
      promises.push(p1);

      var sql2 = 'SELECT * FROM  `sg_google` WHERE  `personID` = '+tempPerson.id+';';
      var p2 = connection.query(sql2);
      promises.push(p2);
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
  .then(function(result) {
    // Close up everything
    return connection.end();
  })
  .then(function(result) {
    return people;
  })

  return promise;
};

module.exports = {
  loadPeople: loadPeople,
  sendConversations: function(loginObj, conversations) {
    var connection;
    var database = loginObj.database;
    var dates = [];

    var promise = mysql.createConnection(loginObj)
    .then(function(conn){
        connection = conn;
    })
    .then(function() {
      // Setup table
      var sql = 'CREATE TABLE IF NOT EXISTS `sg_messages` ( '+
        ' `id` int(11) NOT NULL AUTO_INCREMENT, '+
        ' `personID` int(11) NOT NULL, '+
        ' `body` text NOT NULL, '+
        ' `date` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, '+
        ' `timestamp` varchar(100) NOT NULL, '+
        ' `incoming` tinyint(1) NOT NULL, '+
        ' `type` int(11) NOT NULL, '+
        ' PRIMARY KEY (`id`) '+
        ' );';

      return connection.query(sql);
    })
    .then(function() {
      // Get dates
      var sql = 'SELECT `timestamp` FROM `sg_messages` ORDER BY `sg_messages`.`timestamp`  ASC';
      return connection.query(sql);
    })
    .then(function(results) {
      // Get dates
      dates = {};
      for (var k = 0; k < results.length; k++) {
        dates[results[k].timestamp] = true;
      }
      return dates;
    })
    .then(function() {
      // Get people
      return loadPeople(loginObj);
    })
    .then(function(results) {
      // Send Data
      var unknownArray = [];
      var first = true;
      var sql = 'INSERT INTO `sg_messages` (`personID`, `body`, `date`, `timestamp`) VALUES ';
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

          var temp = '(?, ?, ?, ?)';
          var parts = [message.personID,message.body,message.date,message.timestamp];
          if (!first) {
            sql+=',';
          }
          first = false;
          sql += mysql.format(temp, parts);
        }
      }
      if (first) {
        return;
      }
      return connection.query(sql);
    })
    .then(function(result) {
      // Close up everything
      return connection.end();
    });

    return promise;

  },
  loadMessages: function(loginObj) {
    var connection;
    var conversations = {};

    var promise = mysql.createConnection(loginObj)
    .then(function(conn){
        connection = conn;
    })
    .then(function() {
      // Setup table
      var sql = 'SELECT * FROM  `sg_messages`;';

      return connection.query(sql);
    })
    .then(function(results) {
      for (var i = 0; i < results.length; i++) {
        if (!conversations[results[i].personID]) {
          conversations[results[i].personID] = []
        }
        conversations[results[i].personID].push(results[i]);
      }
    })
    .then(function() {
      // Close up everything
      return connection.end();
    })
    .then(function() {
      // Get people
      return loadPeople(loginObj);
    })
    .then(function(people) {
      conversations.people = people;
      return conversations;
    });

    return promise;
  }
};
