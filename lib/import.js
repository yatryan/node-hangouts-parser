var mysql      = require('mysql');
var sqlite3 = require('sqlite3').verbose();
var mySqlite = require('./sqlite');
var Promise = require('bluebird');
var moment = require('moment');

var loadPeople = mySqlite.loadPeople;


var connection = mysql.createConnection({
  host     : 'yatryan.com',
  user     : 'taylor',
  password : '61124',
  database : 'hangouts'
});

connection.connect();

connection.query('SELECT * FROM `sg_messages`', function(err, rows, fields) {
  if (err) throw err;

  var array = []
  for (var i = 0; i < rows.length; i++) {
    var message = {
      personID: rows[i].personID,
      body: rows[i].body,
      date: moment(rows[i].date).format(),
      timestamp: moment(rows[i].date).valueOf()*1000
    };
    array.push(message);
  }

  send(array);
});

connection.end();

function send(data){
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

      for (var i = 0; i < data.length; i++) {
        var message = data[i];
        
        if (dates[message.timestamp]) {
          continue;
        }
        dates[message.timestamp] = true;

        var dateWrapper = moment(message.date);
        stmt.run(message.personID,message.body,message.date,message.timestamp);
      }

      stmt.finalize(resolve);
    });

    return p;
  }).then(function() {
    return db.closeAsync();
  });
}
