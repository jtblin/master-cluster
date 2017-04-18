'use strict';

var assert = require('assert');
var cluster = require('cluster');
var http = require('http');
var os = require('os');
var debug = require('debug')('master-cluster');
var reloader = require('./reloader');

var setup = {};
var noop = function () {}

function start (options) {
  assert(cluster.isMaster, 'Start can only be run on master!');

  options = options || {};
  if (options.isCluster === false) {
    assert(options.exec, 'exec option must be specified to run in non-cluster mode');

    require(options.exec);
    return;
  }
  if (! options.size) options.size = os.cpus().length;
  setup.logger = options.logger;

  cluster.setupMaster(options);

  var counterReloadWorkerFails = 0;
  var reload = options.reload || options.reload === false ? options.reload : /^dev/.test(process.env.NODE_ENV);

  if (reload ) {
    reloader.reload(options);
  }

  eachCluster(options.size, fork);

  cluster.on('fork', function (worker) {
    debug('Worker forked, id %d', worker.id);
  });

  cluster.on('disconnect', function (worker) {
    debug('Worker %d with pid %s disconnected', worker.id, worker.process.pid);
    if (! reload) {
      fork();
      return;
    }
    if (counterReloadWorkerFails > options.size * 3) {
      logError('Application is crashing. Waiting for file change.');
      return;
    }
    if (counterReloadWorkerFails === 0)
      // reset `counterReloadWorkerFails` in reload mode
      // if there's no errors for more than 2 seconds
      setTimeout(function () {
        counterReloadWorkerFails = 0;
      }, 2000);

    counterReloadWorkerFails++;
    fork();
  });
}

function logError (/* arguments */) {
  if (setup.logger) {
    setup.logger.error.apply(setup.logger, arguments);
  } else {
    debug.apply(debug, arguments);
  }
}

function eachCluster (size, exec) {
  for (var i = 0; i < size; i++) {
    process.nextTick(exec);
  }
}

function fork () {
  cluster.fork().on('error', onWorkerError);
}

function run () {
  assert(cluster.isWorker, 'run can be executed only inside worker process');
  assert(typeof setup.run === 'function', 'There is nothing to run!');

  if (typeof setup.error === 'undefined') setup.error = noop;
  setup.run.apply(null, arguments);
}

function createHttpServer (handler, port, onShutdown, onListening) {
  setFnHandlers (handler, onShutdown);

  if (!onListening) onListening = noop;
  return http.createServer(run).listen(port, onListening);
}

function setFnHandlers (runFn, errorFn) {
  setup.run = runFn;
  setup.error = errorFn || noop;
  return this;
}

function setOptions (options) {
  setup.killTimeout = options.killTimeout || 30000;
  setup.logger = options.logger;
  return this;
}

function onWorkerError (err) {
  logError('Worker uncaught exception\n%s', err.stack);

  try {
    // make sure we close down within timeout (30 seconds default)
    var killtimer = setTimeout(function() {
      if (cluster.worker && ! cluster.worker.isDead()) cluster.worker.kill();
    }, setup.killTimeout);
    // But don't keep the process open just for that!
    if (typeof killtimer.unref === 'function') killtimer.unref();

    // Let the master know we're dead.  This will trigger a
    // 'disconnect' in the cluster master, and then it will fork
    // a new worker.
    if (cluster.worker && !(cluster.worker.exitedAfterDisconnect || cluster.worker.suicide))
      cluster.worker.disconnect();

    // stop everything
    if (typeof setup.error === 'function') {
      setup.error(err, function (er2) {
        if (er2) logError('Shutdown exception\n%s', er2.stack);
        clearTimeout(killtimer);
        if (cluster.worker && ! cluster.worker.isDead()) cluster.worker.kill();
      });
    }

  } catch (er3) {
    // oh well, not much we can do at this point.
    logError('Error closing worker down!\n%s', er3.stack);
  }
}

exports.start = start;
exports.cluster = cluster;
exports.run = run;
exports.createHttpServer = createHttpServer;
exports.setFnHandlers = setFnHandlers;
exports.setOptions = setOptions;
