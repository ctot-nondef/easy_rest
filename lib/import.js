const fs = require('fs');
const axios = require('axios');
const objectPath = require('object-path');

const CONFIG =  require('../config.json');
const APICONFIG = {
  GND: {
    BASEURL: 'http://lobid.org/gnd/',
    ENDPOINTS: {
      BASE: '',
    },
    TIMEOUT: 15000,
    PARAMS: {
      format: 'json',
    },
    HEADERS: {},
  },
  GEO: {
    BASEURL: 'http://api.geonames.org/getJSON',
    ENDPOINTS: {
      BASE: '',
    },
    TIMEOUT: 15000,
    PARAMS: {
      formatted: 'true',
      username: 'oeaw_adlib'
    },
    HEADERS: {},
  },
};
function buildFetchers(extconf) {
  const fetchers = {};
  if (extconf) Object.assign(APICONFIG, extconf);
  const c = Object.keys(APICONFIG);
  let idx = c.length - 1;
  while (idx + 1) {
    const d = Object.keys(APICONFIG[c[idx]].ENDPOINTS);
    let idy = d.length - 1;
    fetchers[c[idx]] = {};
    while (idy + 1) {
      fetchers[c[idx]][d[idy]] = axios.create({
        baseURL: APICONFIG[c[idx]].BASEURL + APICONFIG[c[idx]].ENDPOINTS[d[idy]],
        timeout: APICONFIG[c[idx]].TIMEOUT,
        params: APICONFIG[c[idx]].PARAMS,
        headers: APICONFIG[c[idx]].HEADERS,
      });
      idy -= 1;
    }
    idx -= 1;
  }
  return fetchers;
}
APIS = buildFetchers();




module.exports = {
  files: [],
  jobs: [],
  mappings: [],
  endpoints: APIS,
  initImports() {

  },
  fetchJobList(importcol) {
    let fn = fs.readdirSync(CONFIG.import.dir);
    for (i = 0; i < fn.length; i++) {
      if(/.*\.json/.test(fn[i])){
        // let s = JSON.parse(fs.readFileSync(`${CONFIG.schemas.dir}/${fn[i]}`, 'utf8'));
        importcol.findOne({name: fn[i].split('.')[0]})
          .exec(function (err, imp) {
            if (err) {
              return err
            } else if (!imp) {
              return [];
            }
            this.jobs.push(imp)
          });
      }
    }
    return this.files;
  },
  fetchAuthRecs(ids, endpoint, queryparam, success, fail, entity) {
    return new Promise(function(resolve, reject){
      if(ids.length > 0) {
        let pathparam = '';
        let a = { params: {}};
        if(queryparam) a.params[queryparam] = `${ids.shift()}`;
        if(!queryparam) pathparam = `${ids.shift()}`;
        endpoint.get(`${pathparam}`, a).then((response) => {
          success.push({
            src: `${response.request.res.responseUrl}`,
            record: response.data,
          })
          console.log("success", response.request.res.responseUrl);
          this.fetchAuthRecs(ids, endpoint, queryparam, success, fail, entity).then(() => {
            Promise.resolve({success, fail});
          });
        }, (error) => {
          fail.push(error.config.url);
          console.log("failure", error);
          this.fetchAuthRecs(ids, endpoint, queryparam,  success, fail, entity).then(() => {
            Promise.resolve({success, fail});
          });
        });
      }
      else {
        fs.writeFileSync(`import/data/source_${entity}_authrecs.json`, JSON.stringify(success, null, 2));
        fs.writeFileSync(`import/data/source_${entity}_fail.json`, JSON.stringify(fail, null, 2));
        Promise.resolve({success, fail});
      }
    }.bind(this));
  },
  fetchSources(keys, uris, paths) {
    return new Promise(function(resolve, reject){
      if(keys.length > 0) {
        axios.get(`${uris.shift()}`).then((res) => {
          const data = objectPath.get(res, paths.shift());
          fs.writeFileSync(`import/data/source_${keys.shift()}.json`, JSON.stringify(data, null, 2));
          console.log("Saving Resource URL", res.request.res.responseUrl);
          this.fetchSources(keys, uris, paths).then(() => {
            Promise.resolve();
          });
        }, (error) => {
          console.log("Failed to save Resource", error);
          keys.shift();
          paths.shift();
          this.fetchSources(keys, uris, paths).then(() => {
            Promise.resolve();
          });
        });
      }
      else {
        Promise.resolve();
      }
    }.bind(this));
  }
}
