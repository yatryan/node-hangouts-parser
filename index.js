'use strict';

var config = require('./package.json');
var fs = require('fs');
var prompt = require('prompt');
var program = require('commander');
var colors = require('colors');
var Promise = require('bluebird');
var Logger = require('./lib/logger');
var Hangouts = require('./lib/hangouts');
var mysql = require('./lib/mysql');
var sqlite = require('./lib/sqlite');
var Graph = require('./lib/graph');
var hangoutParser = Hangouts.parser;

var promptSchema = {
  properties: {
    username: {
      required: true
    },
    password: {
      hidden: true,
      required: true
    }
  }
};


program
  .version(config.version)
  .usage('[options] <file>')
  .option('-u, --username <username>', 'Database username')
  .option('-p, --password <password>', 'Database password')
  .option('-h, --host [host]', 'Database host [localhost]', 'localhost')
  .option('--mysql [database]', 'Send to MySQL database')
  .option('--sqlite [database]', 'Sqlite database','hangouts')
  .option('-g, --graph', 'Graph Mode')
  .option('-o, --output [file]', 'Output to file', 'output.json')
  .parse(process.argv);

if (program.args.length != 1) {
  program.help(colors.red);
}

var conversations = hangoutParser.parse(program.args[0]);
var dbLogin = {};

if (program.sqlite) {
  sqlite.sendConversations(conversations);

  sqlite.loadMessages()
  .then(function(messages) {
    var compiled = Graph.compile(messages);
    fs.writeFileSync('output.json',JSON.stringify(compiled, null, 2));
    fs.writeFileSync('web/json/output.json',JSON.stringify(compiled, null, 2));
    Logger.info('Wrote compiled to output.json');

    // Graph.generateLineGraph(compiled, 'month');
    Graph.generateC3LineGraph(compiled, 'month');
    // Graph.generateLineGraph(compiled);
    Graph.generateC3LineGraph(compiled);
    // Graph.generatePieGraph(compiled);

    return 1;
  }).then(function() {
    process.exit(0);
  });
  return;
}

if (program.graph) {
  dbLogin.user = program.username || '';
  dbLogin.password = program.password || '';
  dbLogin.database = (typeof program.mysql) === 'string' ? program.mysql : 'hangouts_dev';
  dbLogin.host = program.host;

  mysql.loadMessages(dbLogin)
  .then(function(messages) {
    var compiled = Graph.compile(messages);
    fs.writeFileSync('output.json',JSON.stringify(compiled, null, 2));
    fs.writeFileSync('web/json/output.json',JSON.stringify(compiled, null, 2));
    Logger.info('Wrote compiled to output.json');

    // Graph.generateLineGraph(compiled, 'month');
    Graph.generateC3LineGraph(compiled, 'month');
    // Graph.generateLineGraph(compiled);
    Graph.generateC3LineGraph(compiled);
    // Graph.generatePieGraph(compiled);

    return 1;
  }).then(function() {
    process.exit(0);
  });
}
else if (program.mysql) {
  dbLogin.user = program.username || '';
  dbLogin.password = program.password || '';
  dbLogin.database = (typeof program.mysql) === 'string' ? program.mysql : 'hangouts_dev';
  dbLogin.host = program.host;

  if (dbLogin.user === '' || dbLogin.password === '') {
    Logger.warn('Database username and password are required.');
    prompt.start();
    prompt.get(promptSchema, function (err, result) {
      dbLogin.user = result.username;
      dbLogin.password = result.password;

      mysql.sendConversations(dbLogin, conversations, callback);
    });
  }
  else {
    mysql.sendConversations(dbLogin, conversations).then(function(){
      Logger.info('Saved conversations to database.');
    }, function(err) {
      console.error(err);
      Logger.error(err);
      process.exit(1);
    });
  }
}
else {
  // Output to file
  fs.writeFileSync(program.output,JSON.stringify(conversations, null, 2));
  Logger.info('Wrote conversations to '+program.output);
  process.exit(0);
}
