const fs = require('fs');
const mongoose = require('mongoose');
const generator = require('mongoose-gen');
const bcrypt = require('bcrypt');

const CONFIG =  require('../config.json');


module.exports = {
  rawjson : {},
  UserSchema: {},
  User: {},
  initUser() {
    this.rawjson = JSON.parse(fs.readFileSync(`${CONFIG.schemas.dir}/${CONFIG.auth.usercol}.json`, 'utf8'));
    this.UserSchema = new mongoose.Schema(generator.convert(this.rawjson));
    //authenticate input against database
    this.UserSchema.statics.authenticate = function (username, password, callback) {
      User.findOne({ username: username })
        .exec(function (err, user) {
          if (err) {
            return callback(err)
          } else if (!user) {
            var err = new Error('User not found.');
            err.status = 401;
            return callback(err);
          }
          bcrypt.compare(password, user.password, function (err, result) {
            if (result === true) {
              return callback(null, user);
            } else {
              return callback();
            }
          })
        });
    };
    //hashing a password before saving it to the database
    this.UserSchema.pre('save', function (next) {
      var user = this;
      bcrypt.hash(user.password, 10, function (err, hash) {
        if (err) {
          return next(err);
        }
        user.password = hash;
        next();
      })
    });
    User = mongoose.model(`${CONFIG.auth.usercol}`, this.UserSchema);
    this.User = User;
  },
  chkSession(req,res,next) {
    if(req.session && req.session.user) {
      req.body.__lastAccessedBy = JSON.parse(JSON.stringify(req.session.user.username));
      req.body.__lastAccessedIn = Date.now();
      return next();
    } else {
      res.status(401).json({error:'Session expired or invalid. Please Log in.'});
    }
  },
  chkUser(req,res,next) {
    if(req.session && req.session.user) {
      User.findOne({ username: req.session.user.username })
        .exec(function (err, user) {
          if (err) {
            return res.status(502).json({error:'Database error.'});
          } else if (!user) {
            res.status(502).json({error:'User Data not found.'});
          }
          return next();
        });
    } else {
      res.status(401).json({error:'Session expired or invalid. Please Log in.'});
    }
  },
}
