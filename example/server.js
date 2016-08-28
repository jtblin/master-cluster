(function () {
  'use strict';

  var MC = require('../master-cluster')
    , app = require('./app')
    , http = require('http');

  // set the handler that will be used for all new requests
  MC.setFnHandlers(app.index, shutdown).setOptions({ logger: console });

  // create the server and pass MC run handler
  // each request will be wrap in a domain for exception handling
  // so that workers are restarted automatically on crash
  var server = http.createServer(MC.run);
  server.listen(3000, function () {
    console.log('Worker %d listening on %d', MC.cluster.worker.id, 3000);
  });

  function shutdown (err, cb) {
    // optional - cleanly close db connections and other resources
    if (err) console.error(err);
    cb(new Error('Boom^2'))
  }
})();
