var express = require('express');
var sassMiddleware = require('node-sass-middleware');
var bodyParser = require('body-parser');
var sqlite = require('./sqlite');
var Graph = require('./graph');

var app = express();
var path = __dirname + '/api';
var sassPath = path + '/sass';
var cssPath = path + '/css';

var port = process.env.PORT || 3001;
var router = express.Router();

// configure app to use bodyParser()
// this will let us get the data from a POST
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

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
app.use('/api', router);

// middleware to use for all requests
router.use(function(req, res, next) {
    // do logging
    console.log('API Call @',new Date());
    next(); // make sure we go to the next routes and don't stop here
});

router.param('limit', function(req, res, next, limit) {
  req.limit = limit;
  next();
});

router.get('/days/:limit?', function (req, res, next) {

  sqlite.loadMessages().then(function(messages) {
    var compiled = Graph.compile(messages);
    var result = Graph.generateC3LineGraph(compiled, 'day');
    res.send(result);
  });
});

router.get('/months/:limit?', function (req, res, next) {

  sqlite.loadMessages().then(function(messages) {
    var compiled = Graph.compile(messages);
    var result = Graph.generateC3LineGraph(compiled, 'month', req.params.limit);
    res.send(result);
  });
});

router.get('/years/:limit?', function (req, res, next) {

  sqlite.loadMessages().then(function(messages) {
    var compiled = Graph.compile(messages);
    var result = Graph.generateC3LineGraph(compiled, 'year', req.params.limit);
    res.send(result);
  });
});

router.get('/timeofday', function(req, res) {
  sqlite.loadMessages().then(function(messages) {
    var compiled = Graph.compile(messages);
    var result = Graph.generateTimeOfDayGraph(compiled);
    res.send(result);
  });
});

router.get('/user/:id', function (req, res, next) {
  console.log('although this matches');
  res.end();
});


var server = app.listen(port, function () {
  console.log('App listening on port %s', port);
});
