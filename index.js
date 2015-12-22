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
  .option('--mysql [database]', 'Send to MySQL database', 'hangouts_dev')
  .option('-o, --output [file]', 'Output to file', 'output.json')
  .parse(process.argv);

if (program.args.length != 1) {
  program.help(colors.red);
}

var conversations = hangoutParser.parse(program.args[0]);
var dbLogin = {};

if (program.mysql) {
  dbLogin.user = program.username || '';
  dbLogin.password = program.password || '';
  dbLogin.database = program.mysql;
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
  fs.writeFileSync(program.output,conversations);
  Logger.info('Wrote conversations to '+program.output);
}

function callback() {
  Logger.info('Saved conversations to database.');
}
