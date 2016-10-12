var Person = function (id, name) {
  this.id = id;
  this._name = name;
  this._phones = [];
  this._google = [];
  this._facebook = [];
};

Person.prototype.getPhones = function () {
    return this._phones;
};

Person.prototype.getGoogle = function () {
    return this._google;
};

Person.prototype.getFacebook = function () {
    return this._facebook;
};

Person.prototype.getName = function () {
    return this._name;
};

module.exports = Person;
