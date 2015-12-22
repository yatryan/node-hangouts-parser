var config = require('./package.json');
var prompt = require('prompt');
var program = require('commander');
var colors = require('colors');
var Hangouts = require('./lib/hangouts');
var hangoutParser = Hangouts.parser;

program
  .version(config.version)
  .usage('[options] <file>')
  .parse(process.argv);

if (program.args.length == 1) {
  hangoutParser.parse(program.args[0]);
}
