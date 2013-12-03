var fs = require("fs")
  , cluster = require("cluster")
  , moment = require("moment")
  , cooldown = 100
  , last = moment();

function reload (options) {
  var extensions = options.extensions || 'js'
    , rg = new RegExp('\\.(' + extensions + ')$')
    , path = options.path || '.'

  cooldown = options.cooldown || cooldown

  console.log('Watcher started for extensions', rg)
  walk(path, rg)
}

function walk (path, rg) {
  if (path === './node_modules') return
  watch(path, rg)
  fs.readdir(path, function (err, files) {
    if (err || !files.length) return
    files.forEach(function (name) {
      if (name.match(/^\./)) return
      var pathname = path + '/' + name
      fs.stat(pathname, function (err, stat) {
        if (stat && stat.isDirectory()) walk(pathname, rg)
      })
    })
  })
}
//
function watch(path, rg) {
  console.log('Watching files in', path);
  fs.watch(path, function (event, filename) {
    if (skipFile(filename, rg)) return;
    if (Object.keys(cluster.workers).length === 0) {
      cluster.reset();
      return
    }
    eachWorker(function (worker) {
      try {
        worker.kill()
      }
      catch (e) {}
    })
  })
}
function eachWorker(callback) {
  for (var id in cluster.workers) {
    callback(cluster.workers[id]);
  }
}

function skipFile(filename, rg) {
  var skip = moment().diff(last) < cooldown || !filename.match(rg)
  if (!skip) last = moment()
  return skip
}

exports.reload = reload
