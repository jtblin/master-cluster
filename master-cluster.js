var cluster = require("cluster")
  , reloader = require("./reloader")
  , setup = {};

function start (options) {
  if (! cluster.isMaster) throw new Error('Start can only be run on master!');
  options = options || {};
  if (options.isCluster === false) {
    setup = options;
    if (options.exec) require(options.exec);
    return
  }
  if (! options.size) options.size = require("os").cpus().length;

  cluster.setupMaster(options);

  var reload = options.reload || process.env.NODE_ENV.match(/^dev/), counter = 0;
  if (reload ) {
    reloader.reload(options);
    cluster.reset = function () {
      eachCluster(options.size, cluster.fork);
      counter = 0
    }
  }

  eachCluster(options.size, cluster.fork);

  cluster.on('disconnect', function (worker) {
    if (! reload) {
      cluster.fork();
      return
    }
    if (counter > options.size * 3) {
      console.error('Application is crashing. Waiting for file change.');
      return
    }
    if (counter === 0)
      setTimeout(function () {
        counter = 0;
      }, 2000);
    counter++;
    cluster.fork();
  });
}

function eachCluster (size, exec) {
  for (var i = 0; i < size; i++) {
    process.nextTick(exec)
  }
}

function run () {
  if (typeof setup.run === 'undefined') throw new Error('There is nothing to run!');
  if (typeof setup.error === 'undefined') setup.error = function () {};

  var d = require("domain").create(), args = arguments;
  d.on('error', onWorkerError);
  for (var i = 0; i < arguments.length; i++) d.add(arguments[i]);
  d.run(function () {
    setup.run.apply(this, args);
  })
  setup.domain = d
}

function createHttpServer (handler, port, onShutdown) {
  var http = require('http');
  setFnHandlers (handler, onShutdown);
  http.createServer(run).listen(port)
}

function setFnHandlers (runFn, errorFn) {
  setup.run = runFn, setup.error = errorFn;
  return this
}

function onWorkerError (err) {
  console.error('master-cluster', 'Worker uncaught exception', err.stack);

  try {
    // make sure we close down within 30 seconds
    var killtimer = setTimeout(function() {
      process.exit(1)
    }, 30000);
    // But don't keep the process open just for that!
    if (typeof killtimer.unref === 'function') killtimer.unref();

    // Let the master know we're dead.  This will trigger a
    // 'disconnect' in the cluster master, and then it will fork
    // a new worker.
    if (cluster.worker && !cluster.worker.suicide) cluster.worker.disconnect();

    // stop everything
    setup.error(err)
  } catch (er2) {
    // oh well, not much we can do at this point.
    console.error('master-cluster', 'Error closing worker down!', er2.stack);
  }
}

exports.start = start;
exports.cluster = cluster;
exports.run = run;
exports.createHttpServer = createHttpServer;
exports.setFnHandlers = setFnHandlers;
