var mysql      = require('mysql');
var Promise = require('bluebird');
var moment = require('moment');
var fs = require('fs');
var sha1 = require("crypto-js/sha1");
var sqlite3 = require('sqlite3').verbose();

var messages = []
var db = Promise.promisifyAll(new sqlite3.Database('hangouts.sqlite3'));

var connection = mysql.createConnection({
  host     : 'localhost',
  user     : 'hangouts',
  password : 'hangouts',
  database : 'hangouts'
});

var sha1Hash = function(message) {
  var shaMessage = message.body+''+message.timestamp;
  return sha1(shaMessage);
};

connection.connect();

connection.query('SELECT * FROM `message`', function(err, rows, fields) {
  if (err) throw err;

  for (var i = 0; i < rows.length; i++) {
    var date = (rows[i].date+978321600)*1000
    var message = {
      handle: rows[i].handle_id,
      body: rows[i].text,
      timestamp: date,
      date: new Date(date),
      fromMe: rows[i].is_from_me
    }

    messages.push(message);
  }

  connection.query('SELECT `ROWID`,`id` FROM `handle`', function(erro, rows, fields){
    var handles = {}
    for (var i = 0; i < rows.length; i++) {
      handles[ rows[i].ROWID ] = rows[i].id
    }

    fs.writeFileSync('handles.json',JSON.stringify(handles, null, 2));

    for (var i = 0; i < messages.length; i++) {
      var message = messages[i];
      message.senderID = handles[message.handle]
    }

    connection.query('SELECT * FROM `sg_phones`', function(erro, rows, fields) {
      var phones = {}
      for (var i = 0; i < rows.length; i++) {
        phones[rows[i].phone] = rows[i].personID
      }

      for (var i = 0; i < messages.length; i++) {
        var message = messages[i];
        message.sender = phones[message.senderID]
      }

      connection.query('SELECT * FROM `oldToNew`', function(erro, rows, fields) {
        var ids = {}
        for (var i = 0; i < rows.length; i++) {
          ids[rows[i].oldId] = rows[i].newId
        }

        var stmt = db.prepare('INSERT INTO `sg_messages` (`personID`, `body`, `date`, `timestamp`) VALUES (?, ?, ?, ?)');
        connection.end();
        for (var i = 0; i < messages.length; i++) {
          var message = messages[i];
          message.personID = message.fromMe ? 2 : ids[message.sender];
          var dateWrapper = moment(message.date);
          if (!message.personID) {
            console.log(message)
            continue;
          }
          stmt.run(message.personID,message.body,dateWrapper.format(),message.timestamp);
        }

        fs.writeFileSync('output.json',JSON.stringify(messages, null, 2));

        stmt.finalize(function() {
        });
        db.close();
      })

    });
  });

})
// fs.writeFileSync('output.json',JSON.stringify(messages, null, 2));
