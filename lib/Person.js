var Person = function (id, name) {
  this.id = id;
  this._name = name;
  this._phones = [];
  this._google = [];
};

Person.prototype.getPhones = function () {
    return this._phones;
};

Person.prototype.getGoogle = function () {
    return this._google;
};

Person.prototype.getName = function () {
    return this._name;
};

module.exports = Person;
