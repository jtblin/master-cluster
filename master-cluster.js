'use strict';

var cluster = require('cluster');
var debug = require('debug')('master-cluster');
var reloader = require('./reloader');
var setup = {};

function start (options) {
  if (! cluster.isMaster) throw new Error('Start can only be run on master!');
  options = options || {};
  if (options.isCluster === false) {
    setup = options;
    if (options.exec) require(options.exec);
    return;
  }
  if (! options.size) options.size = require('os').cpus().length;
  setup.logger = options.logger;

  cluster.setupMaster(options);

  var counter = 0;
  var reload = options.reload || options.reload === false ? options.reload : /^dev/.test(process.env.NODE_ENV);

  if (reload ) {
    reloader.reload(options);
    cluster.reset = function () {
      eachCluster(options.size, fork);
      counter = 0;
    }
  }

  eachCluster(options.size, fork);

  cluster.on('disconnect', function (worker) {
    debug('Worker %d with pid %s disconnected', worker.id, worker.process.pid);
    if (! reload) {
      fork();
      return;
    }
    if (counter > options.size * 3) {
      logError('Application is crashing. Waiting for file change.');
      return;
    }
    if (counter === 0)
      setTimeout(function () {
        counter = 0;
      }, 2000);
    counter++;
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
  if (typeof setup.run === 'undefined') throw new Error('There is nothing to run!');
  if (typeof setup.error === 'undefined') setup.error = function () {};

  var d = require('domain').create(), args = arguments;
  d.on('error', onWorkerError);
  for (var i = 0; i < arguments.length; i++) d.add(arguments[i]);
  d.run(function () {
    setup.run.apply(this, args);
  });
}

function createHttpServer (handler, port, onShutdown) {
  var http = require('http');
  setFnHandlers (handler, onShutdown);
  return http.createServer(run).listen(port);
}

function setFnHandlers (runFn, errorFn) {
  setup.run = runFn;
  setup.error = errorFn || function () {};
  return this;
}

function setOptions (options) {
  setup.logger = options.logger;
  return this;
}

function onWorkerError (err) {
  logError('Worker uncaught exception\n%s', err.stack);

  try {
    // make sure we close down within 30 seconds
    var killtimer = setTimeout(function() {
      process.exit(1)
    }, 30000);
    // But don't keep the process open just for that!
    if (typeof killtimer.unref === 'function')
      killtimer.unref();

    // Let the master know we're dead.  This will trigger a
    // 'disconnect' in the cluster master, and then it will fork
    // a new worker.
    if (cluster.worker && !(cluster.worker.exitedAfterDisconnect || cluster.worker.suicide))
      cluster.worker.disconnect();

    // stop everything
    if (typeof setup.error === 'function')
      setup.error(err);

  } catch (er2) {
    // oh well, not much we can do at this point.
    logError('Error closing worker down!\n%s', er2.stack);
  }
}

exports.start = start;
exports.cluster = cluster;
exports.run = run;
exports.createHttpServer = createHttpServer;
exports.setFnHandlers = setFnHandlers;
exports.setOptions = setOptions;
