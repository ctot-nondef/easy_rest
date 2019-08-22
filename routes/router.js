const express = require('express');
const uid = require('uniqid');
const asyncHandler = require('express-async-handler');

const USER = require('../lib/auth.js');
const SCHEMA = require('../lib/schema.js');
const ASSETS = require('../lib/asset.js');
const CONFIG =  require('../config.json');

const router = express.Router();
SCHEMA.initSchemas();
USER.initUser();

/**
 * @swagger
 * definitions:
 *   UserLogin:
 *     type: object
 *     required:
 *       - username
 *       - password
 *     properties:
 *       username:
 *         type: string
 *       password:
 *         type: string
 *         format: password
 *   NewUser:
 *     allOf:
 *       - $ref: '#/definitions/UserLogin'
 *       - required:
 *         - email
 *         - passwordConf
 *       - properties:
 *           email:
 *             type: string
 *             format: email
 *           passwordConf:
 *             type: string
 *             format: password
 */

router.get(`/api/v${CONFIG.version}/swagger.json`, function(req, res, next) {
  res.json(SCHEMA.swaggerSpec);
});

/**
 * @swagger
 * /:
 *   get:
 *     description: API root. Returns JSON Object of Metadata and available Entities
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: Metadata on A
 */
router.get(`/api/v${CONFIG.version}/`, function (req, res, next) {
  return res.json({
    'data':SCHEMA.getResObject(req),
    'meta':CONFIG.meta,
    'version':CONFIG.version
  })
});

/**
 * @swagger
 * /login:
 *   post:
 *     description: Login to the application
 *     produces:
 *       - application/json
 *     consumes:
 *       - application/json
 *     parameters:
 *       - name: user
 *         description: Login Data.
 *         in: body
 *         required: true
 *         schema: {
 *            "$ref":"#/definitions/UserLogin"
 *          }
 *     responses:
 *       200:
 *         description: login
 *       400:
 *         description: malformed input
 *       401:
 *         description: invalid credentials
*/
router.post(`/api/v${CONFIG.version}/login`, function (req, res, next) {
  if (req.body.username && req.body.password) {
    USER.User.authenticate(req.body.username, req.body.password, function (error, user) {
      if (error || !user) {
        res.status(401).json({'error':'Wrong Username or Password.'});
      } else {
        req.session.user = user._doc;
        const {password, _history, _id, __v, ...userout} = user._doc;
        return res.json({"user": userout,"session": req.sessionID});
      }
    });
  } else {
    res.status(400).json({'error':'Username and Password required.'});
  }
});

/**
 * @swagger
 * /logout:
 *   get:
 *     description: Logout of the application
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: logout successfull
 */
router.get(`/api/v${CONFIG.version}/logout`, function (req, res, next) {
  if (req.session) {
    // delete session object
    req.session.destroy(function (err) {
      if (err) {
        return next(err);
      } else {
        res.clearCookie('userid');
        res.json({'res':'Logout successfull.'});
      }
    });
  }
});

//POST route for registration, to be shout off for prduction
//TODO: this will not be a public route for now, in order for this to be
// a documented route, we would need to add
// * a check if the username exists
// * a workflow for assigning appropriate rights after signup
// (right now it's full rights)

/**
 * @swagger
 * /register:
 *   post:
 *     description: New User Registration
 *     produces:
 *       - application/json
 *     consumes:
 *       - application/json
 *     parameters:
 *       - name: user
 *         description: Login Data.
 *         in: body
 *         required: true
 *         schema: {
 *            "$ref":"#/definitions/NewUser"
 *          }
 *     responses:
 *       200:
 *         description: Registration and Login
 *       400:
 *         description: malformed input
*/
router.post(`/api/v${CONFIG.version}/register`, function (req, res, next) {
  if (req.body.password !== req.body.passwordConf) {
    res.status(400).json({'error':'The Passwords don\'t match'});
  }

  if (req.body.email &&
    req.body.username &&
    req.body.password &&
    req.body.passwordConf) {

    let userData = {
      email: req.body.email,
      username: req.body.username,
      password: req.body.password
    };

    USER.User.create(userData, function (error, user) {
      if (error) {
        return next(error);
      } else {
        req.session.userId = user._id;
        res.json(req.session);
        console.log('user', req.body.username, 'created');
      }
    });

  } else {
    res.status(400).json({'error':'Username, Email and Password required.'});
  }
});

/**
 * @swagger
 * /jsonschema/{name}:
 *   get:
 *     description: Serves an Entities JSONSchema by Name
 *     produces:
 *       - application/json
 *     parameters:
 *       - in: path
 *         name: name
 *         description: Schema Name.
 *         required: true
 *         type: string
 *     responses:
 *       200:
 *         description: The JSONSchema as requested
 *       400:
 *         description: malformed input
 *       404:
 *         description: Schema Name is not known
*/
router.get(`/api/v${CONFIG.version}/jsonschema/:name`, function(req, res, next) {
  if (req.params.name) {
    let s = SCHEMA.jsonSchemaByName(req.params.name);
    if (s) {
        res.json(s);
    } else {
        res.status(404).json({'error':`'${req.params.name}' is not known as a Schema`});
    }
  } else {
    res.status(400).json({'error':'Schema name required.'});
  }
});

/**
 * @swagger
 * /upload/:
 *   post:
 *     description: Retrieves Image and returns corresponding AssetRef
 *     produces:
 *       - application/json
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - name: image
 *         type: file
 *         description: File Object from upload.
 *         in: formData
 *         required: true
 *     responses:
 *       200:
 *         description: Image Uploaded, Assetref Created
 *       400:
 *         description: Invalid or missing Image Data
 *       500:
 *         description: Image processing failed
*/
router.post(`/api/v${CONFIG.version}/upload`, asyncHandler(async (req, res, next) => {
  if (req.files && req.files.file) {
    let file = req.files.file;
    let name = `${uid()}_${file.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`
    let thumbPath = '';
    file.mv(`${CONFIG.assets.dir}/${name}.${file.name.split('.')[1]}`, async function(err) {
      console.log(err);
      if(file.mimetype.split('/')[0] == 'image') {
        thumbPath = await ASSETS.makeImgThumb(`${name}.${file.name.split('.')[1]}`, {width: 220, height: 220}, 90, 'thumb');
        ASSETS.makeImgThumb(`${name}.${file.name.split('.')[1]}`, {width: 1500, height: 1500}, 90, 'preview');
      }
      else if(file.mimetype == 'application/pdf'){
        ASSETS.makePDFThumb(`${name}.${file.name.split('.')[1]}`, 0, {width: 1500, height: 1500}, 90, 'preview');
        thumbPath = await ASSETS.makePDFThumb(`${name}.${file.name.split('.')[1]}`, 0, {width: 220, height: 220}, 90, 'thumb');
      }
      if (err) return res.status(500).json({error:'Processing failed'});
      SCHEMA.mongooseModelByName('assetref').create({
        name: `${name}`,
        path: `${CONFIG.assets.dir}/${name}.${file.name.split('.')[1]}`,
        mimetype: file.mimetype,
      }, (err, doc) => {
        if (err) return res.status(500).json({error: 'Processing failed'});
        res.json(doc);
      })
    });
  }
  else {
    res.status(400).json({'error':'No Files Uploaded.'});
  }
}));

module.exports = router;
