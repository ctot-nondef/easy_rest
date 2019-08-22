const fs = require('fs');
const generator = require('mongoose-gen');
const mongoose = require('mongoose');
require('mongoose-schema-jsonschema')(mongoose);
const swaggerJSDoc = require('swagger-jsdoc');

const mongooseHistory = require('mongoose-history');
const history_options = {
    metadata: [
        {key: 'u', value: '__lastAccessedBy'},
    ]
};

const CONFIG =  require('../config.json');
const options = {
  swaggerDefinition: {
    info: {
      title: CONFIG.meta.title, // Title (required)
      version: CONFIG.version, // Version (required)
    },
  },
  apis: ['routes/router.js'], // Path to the API docs
};

module.exports = {
  rawjson: [],
  schemas: [],
  names: [],
  models: [],
  swaggerSpec: {},
  initSchemas() {
    this.swaggerSpec = swaggerJSDoc(options);
    let fn = fs.readdirSync(CONFIG.schemas.dir);
    for (i = 0; i < fn.length; i++) {
      if(/.*\.json/.test(fn[i]) && !/_.*/.test(fn[i])){
        console.log(fn[i]);
        let s = JSON.parse(fs.readFileSync(`${CONFIG.schemas.dir}/${fn[i]}`, 'utf8'));
        this.rawjson[i] = s;
        this.schemas[i] = new mongoose.Schema(generator.convert(s));
        this.names[i] = fn[i].split('.')[0];
        this.schemas[i].plugin(mongooseHistory, history_options);
        this.models[i] = mongoose.model(this.names[i], this.schemas[i]);
        this.addMongooseAPISpec(this.swaggerSpec, this.names[i], this.schemas[i]);
      }
    }
  },
  getResObject(req) {
    let a = [];
    for (var i = 0; i < this.names.length; i++) {
      if(this.names[i]) a.push({
        type:this.names[i],
        id: `https://${req.get('host')}/api/v${CONFIG.version}/${this.names[i]}`,
        attributes: this.jsonSchemaByName(this.names[i])
      });
    }
    return a;
  },
  jsonSchemaByName(name) {
    for (i = 0; i < this.names.length; i ++) {
      if(name == this.names[i]){
        //we may need put some additional logic here, if front end needs it
        return this.schemas[i].jsonSchema();
      }
    }
    return false;
  },
  mongooseModelByName(name) {
    for (i = 0; i < this.names.length; i ++) {
      if(name == this.names[i]){
        return this.models[i];
      }
    }
    return false;
  },
  addMongooseAPISpec(swaggerSpec, name, schema ) {
    swaggerSpec.paths[`/${name}/count`] = {
      "get" : {
        "description":`Returns the number of documents of type ${name}`,
        "produces":["application/json"],
        "responses":{
          200:{
            "description":`Document Count of ${name}`,
          }
        }
      },
    }
    swaggerSpec.paths[`/${name}`] = {
      "get" : {
        "description":`Returns a List of ${name}s`,
        "produces":["application/json"],
        "parameters":[
          {
            "name":"sort",
            "description":"Key Name to Sort by, preceded by '-' for descending, default: _id",
            "in":"query",
            "type":"string"
          },
          {
            "name":"skip",
            "description":"Number of records to skip from start, default: 0",
            "in":"query",
            "type":"integer"
          },
          {
            "name":"limit",
            "description":"Number of records to return, default: 10",
            "in":"query",
            "type":"integer"
          },
          {
            "name":"query",
            "description":"MongoDB Query as a well formed JSON String, ie {\"name\":\"Bob\"}",
            "in":"query",
            "type":"string"
          },
          {
            "name":"populate",
            "description":"Path to a MongoDB reference to populate, ie [{\"path\":\"customer\"},{\"path\":\"products\"}]",
            "in":"query",
            "type":"string"
          },
        ],
        "responses":{
          200:{
            "description":`Returns a List of ${name}`,
            "schema":{"$ref":`#/definitions/${name}`}
          }
        }
      },
      "post" : {
        "description":`Creates a new instance of ${name}`,
        "produces":["application/json"],
        "consumes":["application/json"],
        "parameters":[{
          "name":name,
          "in":"body",
          "required":true,
          "schema":{"$ref":`#/definitions/${name}`}
        }],
        "responses":{
          200:{
            "description":`The created instance of ${name}`,
            "schema":{"$ref":`#/definitions/${name}`}
          }
        }
      },
      "delete" : {
        "description":`Deletes the entire contents of collection ${name}`,
        "produces":["application/json"],
        "responses":{
          200:{
            "description":`Emptied Collection ${name}`,
          }
        }
      }
    }
    swaggerSpec.paths[`/${name}/{id}`] = {
      "get" : {
        "description":`Returns a List of ${name}s`,
        "produces":["application/json"],
        "parameters":[
          {
            "name":"id",
            "description":"MongoDB document _id",
            "in":"path",
            "type":"string",
            "required":true
          },
        ],
        "responses":{
          200:{
            "description":`Returns document with requested ID from collection ${name}`,
            "schema":{"$ref":`#/definitions/${name}`}
          },
          404:{
            "description":`No document found with requested ID in collection ${name}`,
          }
        }
      },
      "post" : {
        "description":"Updates the document with the given ID",
        "produces":["application/json"],
        "consumes":["application/json"],
        "parameters":[
          {
            "name":"id",
            "description":"MongoDB document _id",
            "in":"path",
            "type":"string",
            "required":true
          },
          {
            "name":name,
            "in":"body",
            "required":true,
            "schema":{"$ref":`#/definitions/${name}`}
          }
        ],
        "responses":{
          200:{
            "description":`The updated instance of ${name}`,
            "schema":{"$ref":`#/definitions/${name}`}
          },
          404:{
            "description":`No document found with requested ID in collection ${name}`,
          }
        }
      },
      "patch" : {
        "description":"Partially updates the document with the given ID",
        "produces":["application/json"],
        "consumes":["application/json"],
        "parameters":[
          {
            "name":"id",
            "description":"MongoDB document _id",
            "in":"path",
            "type":"string",
            "required":true
          },
          {
            "name":name,
            "in":"body",
            "required":true,
            "schema":{"$ref":`#/definitions/${name}`}
          }
        ],
        "responses":{
          200:{
            "description":`The updated instance of ${name}`,
            "schema":{"$ref":`#/definitions/${name}`}
          },
          404:{
            "description":`No document found with requested ID in collection ${name}`,
          }
        }
      },
      "delete" : {
        "description":"Deletes the document with the given ID",
        "produces":["application/json"],
        "parameters":[
          {
            "name":"id",
            "description":"MongoDB document _id",
            "in":"path",
            "type":"string",
            "required":true
          },
        ],
        "responses":{
          200:{
            "description":"Deleted document with given ID",
          },
          404:{
            "description":`No document found with requested ID in collection ${name}`,
          }
        }
      }
    }
    swaggerSpec.definitions[name] = schema.jsonSchema();
  }
};
