require('dotenv').config();
var _ = require('underscore');
var Promise = require('bluebird');
var GoogleContacts = require('google-contacts').GoogleContacts;
var c = new GoogleContacts({
  token: process.env.TOKEN
});

c.params.thin = false;

var contacts = [];

module.exports = {
  init: function() {
    var p = new Promise(function (resolve, reject) {

      if (contacts !== []) {
        resolve(contacts);
      }

      c.getContacts(function (err, contacts) {

        _.each(contacts, function(feedContact) {
          if (feedContact.title['$t'] !== '') {
            var contact = {
              name: feedContact.title['$t'],
              phones: []
            };

            var feedPhones = feedContact['gd$phoneNumber'];

            _.each(feedPhones, function(phone) {
              contact.phones.push(phone.uri.replace(/\D/g, ''));
            });
            contacts.push(contact);
          }
        });

        resolve(contacts);
      });
    });

    return p;
  },
  nameForPhone: function(phone) {
    var phoneNumber = phone.replace(/\D/g, '');

    for (var i = 0; i < contacts.length; i++) {
      var contact = contacts[i];
      if (contact.phones.indexOf(phoneNumber) >= 0) {
        return contact;
      }
    }

    return -1;
  }
}
