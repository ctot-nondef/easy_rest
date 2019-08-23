const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser')
const methodOverride = require('method-override');
const mongoose = require('mongoose');
const cors = require('cors');
const session = require('express-session');

const restify = require('express-restify-mongoose');
const MongoStore = require('connect-mongo')(session);
const fileUpload = require('express-fileupload');

// loading config
const CONFIG =  require('./config.json');
const ROUTER = require('./routes/router.js');

// loading internal libs
const SCHEMA = require('./lib/schema.js');
const AUTH = require('./lib/auth.js');

//instantiate express
const app = express();

app.use(bodyParser.json());
app.use(cookieParser());
app.use(methodOverride());
app.use(cors(CONFIG.cors));
app.use(fileUpload());

// init mongodb
mongoose.connect(`mongodb://${CONFIG.db.user}:${CONFIG.db.pass}@${CONFIG.db.server}/${CONFIG.db.db}?authSource=test`, function(error) {
  console.log(error);
});
var db = mongoose.connection;

//use sessions for tracking logins
app.use(session({
  key: 'userid',
  secret: CONFIG.auth.secret,
  resave: false,
  saveUninitialized: false,
  cookie: {
      expires: 604800000,
      httpOnly: false,
  },
  store: new MongoStore({
    mongooseConnection: db
  })
}));

//clear cookies whose sessionid has disappeared
app.use((req, res, next) => {
    if (req.cookies.userid && !req.session.user) {
        res.clearCookie('userid');
    }
    next();
});

// create API for each schema in schema Folder
for (i = 0; i < SCHEMA.schemas.length; i ++) {
  if(SCHEMA.names[i] && !/_.*/.test(SCHEMA.names[i])) {
    restify.serve(ROUTER, SCHEMA.models[i], {
      preCreate: AUTH.chkSession,
      preUpdate: AUTH.chkSession,
      preDelete: AUTH.chkSession,
      totalCountHeader: true,
    });
  }
};

restify.serve(ROUTER, AUTH.User, {
    preCreate: AUTH.chkUser,
    preUpdate: AUTH.chkUser,
    preDelete: AUTH.chkUser,
    preRead: AUTH.chkSession,
    totalCountHeader: true,
    findOneAndUpdate: false,
});
SCHEMA.addMongooseAPISpec(SCHEMA.swaggerSpec, CONFIG.auth.usercol, AUTH.UserSchema);

// serve asset folder - is this wise?
app.use('/asset', express.static('asset'));

// serve and listen
app.use(ROUTER);
app.listen(CONFIG.env.port, () => {
  console.log(`Express server listening on port ${CONFIG.env.port}`)
});
