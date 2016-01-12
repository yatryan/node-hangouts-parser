var express = require('express');
var app = express();
sassMiddleware = require('node-sass-middleware');

var path = __dirname + '/api';
var sassPath = path + '/sass';
var cssPath = path + '/css';

// adding the sass middleware
app.use('/css',
  sassMiddleware({
    src: sassPath,
    dest: cssPath,
    debug: true,
    outputStyle: 'expanded'
  })
);

app.use(express.static(__dirname+'/api'));

var server = app.listen(3000, function () {
  var host = server.address().address;
  var port = server.address().port;

  console.log('App listening on port %s', port);
});
