'use strict';

var config = require('./package.json');
var fs = require('fs');
var program = require('commander');
var colors = require('colors');
var Promise = require('bluebird');
var Logger = require('./lib/logger');
var Hangouts = require('./lib/hangouts');
var Facebook = require('./lib/facebook');
var sqlite = require('./lib/sqlite');
var Graph = require('./lib/graph');
var hangoutParser = Hangouts.parser;
var facebookParser = Facebook.parser;

program
  .version(config.version)
  .usage('[options] <file>')
  .option('--sqlite [database]', 'Sqlite database','hangouts')
  .option('-o, --output [file]', 'Output to file', 'output.json')
  .option('-t, --type [type]', 'Input file type (hangouts, facebook)', 'hangouts')
  .parse(process.argv);

if (program.args.length != 1) {
  program.help(colors.red);
}

var conversations;

console.log('Parsing '+program.type+' file.');

if (program.type === 'facebook') {
  conversations = facebookParser.parse(program.args[0]);
} else {
  conversations = hangoutParser.parse(program.args[0]);
}

sqlite.sendConversations(conversations, program.type)
.then(function() {
  return sqlite.loadMessages();
})
.then(function(messages) {
  var compiled = Graph.compile(messages);
  fs.writeFileSync(program.output,JSON.stringify(compiled, null, 2));

  // if (!fs.existsSync('web/json')){
  //   fs.mkdirSync('web/json');
  // }
  // fs.writeFileSync('web/json/output.json',JSON.stringify(compiled, null, 2));

  Logger.info('Wrote compiled to '+program.output);

  return 1;
});
