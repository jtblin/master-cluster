(function () {
  'use strict';

  var MC = require('../master-cluster')
    , worker = require.resolve('./server');

  MC.start({exec: worker});
})();
