'use strict';

var fs = require('fs')
  , cluster = require('cluster')
  , debug = require('debug')('master-cluster')
  , moment = require('moment')
  , cooldown = 100
  , last = Date.now()
  ;

function reload (options) {
  var extensions = options.extensions || 'js'
    , rg = new RegExp('\\.(' + extensions + ')$')
    , path = options.path || '.';

  cooldown = options.cooldown || cooldown;

  debug('Watcher started for extensions %s', rg.toString());
  walk(path, rg);
}

function walk (path, rg) {
  if (path === './node_modules') return;
  watch(path, rg);
  fs.readdir(path, function (err, files) {
    if (err || !files.length) return;
    files.forEach(function (name) {
      if (name.match(/^\./)) return;
      var pathname = path + '/' + name;
      fs.stat(pathname, function (err, stat) {
        if (stat && stat.isDirectory()) walk(pathname, rg);
      });
    });
  });
}

function watch (path, rg) {
  debug('Watching files in %s', path);
  fs.watch(path, function (event, filename) {
    if (skipFile(filename, rg)) return;
    debug('%s changed', filename);

    if (Object.keys(cluster.workers).length === 0) {
      debug('Reset cluster');
      cluster.reset();
      return
    }
    eachWorker(function (worker) {
      try {
        debug('Killing worker %d', worker.id);
        worker.disconnect();
        var timeout = setTimeout(worker.kill.bind(worker), 3000);
        worker.on('exit', clearTimeout.bind(null, timeout));
      }
      catch (e) {
        debug('Error killing worker %d: %s', worker.id, e.message);
      }
    })
  })
}

function eachWorker (callback) {
  for (var id in cluster.workers) {
    callback(cluster.workers[id]);
  }
}

function skipFile (filename, rg) {
  var now = Date.now();
  var skip = now - last < cooldown || ! rg.test(filename);
  if (! skip) last = now;
  return skip;
}

exports.reload = reload;
