'use strict';

var config = require('./package.json');
var fs = require('fs');
var program = require('commander');
var colors = require('colors');
var Promise = require('bluebird');
var Logger = require('./lib/logger');
var Hangouts = require('./lib/hangouts');
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
  .option('--sqlite [database]', 'Sqlite database','hangouts')
  .option('-o, --output [file]', 'Output to file', 'output.json')
  .parse(process.argv);

if (program.args.length != 1) {
  program.help(colors.red);
}

var conversations = hangoutParser.parse(program.args[0]);

sqlite.sendConversations(conversations);

sqlite.loadMessages()
.then(function(messages) {
  var compiled = Graph.compile(messages);
  fs.writeFileSync(program.output,JSON.stringify(compiled, null, 2));
  fs.writeFileSync('web/json/output.json',JSON.stringify(compiled, null, 2));
  Logger.info('Wrote compiled to '+program.output);

  // Graph.generateLineGraph(compiled, 'month');
  Graph.generateC3LineGraph(compiled, 'month');
  // Graph.generateLineGraph(compiled);
  Graph.generateC3LineGraph(compiled);
  // Graph.generatePieGraph(compiled);

  return 1;
});
