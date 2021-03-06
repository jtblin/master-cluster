(function () {
  'use strict';

  var MC = require('../master-cluster');

  function index (req, res) {
    // do something with the request and response
    console.log('Worker %d received request for "%s"', MC.cluster.worker.id, req.url);
    if (req.url === '/error') {
      throw new Error('Boom!');
    }
    res.end('OK');
  }

  exports.index = index;
})();
