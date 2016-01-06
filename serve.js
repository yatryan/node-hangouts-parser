var express = require('express');
var app = express();
sassMiddleware = require('node-sass-middleware');


var srcPath = __dirname + '/web/sass';
var destPath = __dirname + '/web/css';

// adding the sass middleware
app.use('/css',
  sassMiddleware({
    src: srcPath,
    dest: destPath,
    debug: true,
    outputStyle: 'expanded'
  })
);

app.use(express.static('web'));

var server = app.listen(3000, function () {
  var host = server.address().address;
  var port = server.address().port;

  console.log('Example app listening at http://%s:%s', host, port);
});
