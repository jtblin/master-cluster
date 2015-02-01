# master-cluster

master-cluster is a utility to facilitate implementing node.js core [cluster](http://nodejs.org/api/cluster.html) module
in any project. I created this module as I use the cluster module in pretty much all my projects and wanted to
remove the boilerplate code. It implements node.js core [domain](http://nodejs.org/api/domain.html) module
for correct exception handling. It also provides hot reloading of files on the worker in development mode
so that workers are restarted when code is changed.

## Usage

In `boot.js`:

    var MC = require('master-cluster')
      , worker = require.resolve('./server.js');
    MC.start({exec: worker});

In `server.js`:

    var MC = require('master-cluster')
      , app = require('./app.js')
      , http = require('http');

    // set the handler that will be used for all new requests
    MC.setFnHandlers(app.index, shutdown);

    // create the server and pass MC run handler
    // each request will be wrap in a domain for exception handling
    // so that workers are restarted automatically on crash
    var server = http.createServer(MC.run);
    server.listen(3000, function () {
      console.log("Listening on %d", 3000);
    });

    function shutdown () {
        // optional - cleanly close db connections and other resources
    }

In `app.js`:

    function index (req, res) {
        // do something with the request and response
    }

    exports.index = index;

### Convenience http server method

The code above can be simplified if all you need is to start a http server.

In `server.js`:

    var MC = require('master-cluster')
      , app = require('./app.js');

    MC.createHttpServer(app.index, 3000, shutdown);

    function shutdown () {
        // cleanly close db connections and other resources
    }

### Configuration

Following options can be passed to the master cluster configuration:

- `exec`: the code to run on the cluster master
- `size`: the number of workers to start, default is `require("os").cpus().length`
- `reload`: `boolean`, default is `false` except when `process.env.NODE_ENV == 'dev'`

Reloader specific options:

- `cooldown`: number of milliseconds to wait between file changes, default is `100ms`
- `extensions`: file extensions to watch for and reload on change, default to `js`

# Disclaimer

This module is still experimental and subject to change. Please open issues for bugs and suggestions in [github](https://github.com/jtblin/master-cluster/issues).
Pull requests welcome.

## Author

Jerome Touffe-Blin, [@jtblin](https://twitter.com/jtlbin), [http://www.linkedin.com/in/jtblin](http://www.linkedin.com/in/jtblin)

## License

master-cluster is copyright 2013 Jerome Touffe-Blin and contributors. It is licensed under the BSD license. See the include LICENSE file for details.
