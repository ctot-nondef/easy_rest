const nodemon = require('nodemon');
const fs = require('fs');

nodemon({
  script: "./server.js",
  ignore: ["asset/*"],
  stdout: false // important: this tells nodemon not to output to console
}).on('readable', function() { // the `readable` event indicates that data is ready to pick up
  this.stdout.pipe(fs.createWriteStream('output.txt'));
  this.stderr.pipe(fs.createWriteStream('err.txt'));
});
