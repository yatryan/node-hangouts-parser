'use strict';

require('dotenv').config();
var Promise = require('bluebird');
var express = require('express');
var passport = require('passport');
var GoogleStrategy = require( 'passport-google-oauth2' ).Strategy;
var opener = require('opener');
var waitUntil = require('wait-until');

var server, token;

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: process.env.REDIRECT_URL,
    passReqToCallback : false
  },
  function(accessToken, refreshToken, profile, done) {
    token = accessToken;
    return done(null, profile);
  }
));

// Minimal Express server
var app = express();
app.use(passport.initialize());

app.get('/auth/google', passport.authenticate('google', {
  scope: [
    'https://www.googleapis.com/auth/plus.login',
    'https://www.googleapis.com/auth/plus.me'
  ]
}));

app.get( '/auth/google/callback', passport.authenticate( 'google', {
  successRedirect: '/auth/google/success',
  failureRedirect: '/auth/google/failure',
  session: false
}));

app.get('/auth/google/success', function(req, res) {
  // Authenticated successfully
  stopServer();
  res.send('You may now close the browser');
});

app.get('/auth/google/failure', function(req, res) {
  // Authentication Failed
  console.log('fail');
  stopServer();
  res.send('An error has occured');
});


var startServer = function() {

  var p = new Promise(function (resolve, reject) {
    server = app.listen(process.env.PORT || 3000, function() {
      console.log("Listening...");
      resolve();
    });
  });

  return p;
};

var stopServer = function() {
  setTimeout(function () {
    server.close();
  }, 3000);
};

var getToken = function() {

  return startServer().then(function() {
    opener('http://localhost:3000/auth/google');
  }).then(function() {
    var p = new Promise(function (resolve, reject) {
      waitUntil(500, 10, function condition() {
        return !!token;
      }, function done(result) {
        if (result) {
          resolve(token);
        } else {
          reject();
        }
      });
    });
    return p;
  });

};

module.exports = {
  startServer: startServer,
  stopServer: stopServer,
  getToken: getToken
};
