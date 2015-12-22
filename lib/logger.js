'use strict';

var colors = require('colors');

module.exports = {
  info: function(text) {
    text = text.toString();
    console.log('  Info: '.cyan + text.cyan);
  },
  warn: function(text) {
    text = text.toString();
    console.log('  Warning: '.yellow + text.yellow);
  },
  error: function(text) {
    text = text.toString();
    console.log('  Error: '.red + text.red);
  }
}
