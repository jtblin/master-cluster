(function () {
  'use strict';

  var MC = require('../master-cluster')
    , worker = require.resolve('./server.js');
  MC.start({exec: worker});
})();
