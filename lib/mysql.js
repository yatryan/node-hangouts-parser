'use strict';

var mysql = require('promise-mysql');
var Logger = require('./logger');
var Hangouts = require('./hangouts');
var connection;

module.exports = {
  sendConversations: function(loginObj, conversations) {
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
        ' `googleID` varchar(100) NOT NULL, '+
        ' `body` text NOT NULL, '+
        ' `date` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, '+
        ' `incoming` tinyint(1) NOT NULL, '+
        ' `type` int(11) NOT NULL, '+
        ' PRIMARY KEY (`id`) '+
        ' );';

      return connection.query(sql);
    })
    .then(function() {
      // Get dates
      var sql = 'SELECT `date` FROM `sg_messages` ORDER BY `sg_messages`.`date`  ASC';
      return connection.query(sql);
    })
    .then(function(results) {
      // Get dates
      dates = {};
      for (var k = 0; k < results.length; k++) {
        var date = new Date(results[k].date);
        dates[date.toString()] = true;
      }
      return dates;
    })
    .then(function() {
      // Send Data
      var first = true;
      var sql = 'INSERT INTO `sg_messages` (`personID`, `googleID`, `body`, `date`) VALUES ';
      for (var i = 0; i < conversations.length; i++) {
        var messages = conversations[i].messages
        for (var j = 0; j < messages.length; j++) {
          var message = Hangouts.messageFormatter(messages[j]);
          if (dates[message.date.toString()]) {
            continue;
          }

          // dates[message.date.toString()] = true;

          var temp = '(?, ?, ?, ?)';
          var parts = [message.personID,message.googleID,message.body,message.date];
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

  }
};
