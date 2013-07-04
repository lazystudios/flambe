//
// Flambe - Rapid game development
// https://github.com/aduros/flambe/blob/master/LICENSE.txt

var Q = require("q");
var fs = require("fs");
var path = require("path");
var spawn = require("child_process").spawn;
var wrench = require("wrench");

var DATA_DIR = __dirname + "/data";
var CACHE_DIR = ".flambe-cache";
var HAXE_COMPILER_PORT = "6000";

exports.loadConfig = function (path) {
    var yaml = require("js-yaml");
    return yaml.safeLoad(fs.readFileSync(path).toString());
};

exports.newProject = function (path) {
    wrench.copyDirSyncRecursive(DATA_DIR+"/scaffold", path);
};

exports.run = function (config, platform) {
    console.log(config);
};

exports.build = function (config, platforms, opts) {
    opts = opts || {};
    var debug = opts.debug;

    var commonFlags = [];

    // Flags common to all swf-based targets (flash, android, ios)
    swfFlags = ["--flash-strict", "-D", "native_trace",
        "-swf-header", "640:480:60:000000", "-lib", "hxsl"];
    if (debug) swfFlags.push("-D", "fdb", "-D", "advanced-telemetry");

    var buildHtml = function () {
        var htmlFlags = ["-D", "html"];
        var unminified = CACHE_DIR+"/main-html.unminified.js";
        var js = "build/web/targets/main-html.js";
        console.log("Building: " + js);
        if (debug) {
            return haxe(commonFlags.concat(htmlFlags).concat(["-js", js]));
        } else {
            // Minify release builds
            return haxe(commonFlags.concat(htmlFlags).concat(["-js", unminified]))
            .then(function () {
                return minify([unminified], js, {strict: true});
            });
        }
    };

    var buildFlash = function () {
        var swf = "build/web/targets/main-flash.swf";
        var flashFlags = swfFlags.concat(["-swf-version", "11", "-swf", swf]);
        console.log("Building: " + swf);
        return haxe(commonFlags.concat(flashFlags));
    };

    wrench.mkdirSyncRecursive(CACHE_DIR);
    wrench.mkdirSyncRecursive("build/web/targets");
    copyDirContents("web", "build/web");
    copyFile(DATA_DIR+"/flambe.js", "build/web/flambe.js");
    wrench.copyDirSyncRecursive("assets", "build/web/assets", {forceDelete: true});

    var connectFlags = ["--connect", HAXE_COMPILER_PORT];
    var promise =
    haxe(connectFlags, {check: false, verbose: false, output: false})
    .then(function (code) {
        // Use a Haxe compilation server if available
        if (code == 0) {
            commonFlags = commonFlags.concat(connectFlags);
        }

        commonFlags.push("-main", get(config, "main"));
        commonFlags = commonFlags.concat(toArray(get(config, "haxe_flags", [])));
        commonFlags.push("-lib", "flambe", "-cp", "src");
        commonFlags.push("-dce", "full");
        if (debug) {
            commonFlags.push("-debug", "--no-opt", "--no-inline");
        } else {
            commonFlags.push("--no-traces");
        }
    })
    .then(function () {
        var builders = {
            html: buildHtml,
            flash: buildFlash,
        };
        var promise = Q();
        platforms.forEach(function (platform, idx) {
            promise = promise.then(function () {
                if (idx != 0) console.log();
                return builders[platform]();
            });
        });
        return promise;
    });
    return promise;
};

exports.clean = function () {
    wrench.rmdirSyncRecursive("build", true);
    wrench.rmdirSyncRecursive(CACHE_DIR, true);
};

var haxe = function (flags, opts) {
    return exec("haxe", flags, opts);
};
exports.haxe = haxe;

var adt = function (flags, opts) {
    return exec("adt", flags, opts);
};
exports.adt = adt;

var adb = function (flags, opts) {
    return exec("adb", flags, opts);
};
exports.adb = adb;

var exec = function (command, flags, opts) {
    opts = opts || {};
    if (opts.verbose !== false) {
        console.log([command].concat(flags).join(" "));
    }

    var deferred = Q.defer();
    var child = spawn(command, flags, {stdio: (opts.output === false) ? "ignore" : "inherit"});
    child.on("close", function (code) {
        if (code && opts.check !== false) {
            deferred.reject();
        }
        deferred.resolve(code);
    });
    child.on("error", function (error) {
        deferred.reject(error);
    });
    return deferred.promise;
};
exports.exec = exec;

var minify = function (inputs, output, opts) {
    opts = opts || {};
    var flags = ["-jar", DATA_DIR+"/closure.jar",
        "--warning_level", "QUIET",
        "--js_output_file", output,
        "--output_wrapper",
            "/**\n" +
            " * Cooked with Flambe\n" +
            " * https://github.com/aduros/flambe\n" +
            " */\n" +
            "%output%"];
    inputs.forEach(function (input) {
        flags.push("--js", input);
    });
    if (opts.strict) flags.push("--language_in", "ES5_STRICT");
    return exec("java", flags, {verbose: false});
};
exports.minify = minify;

/** Convert an "array-like" value to a real array. */
var toArray = function (o) {
    if (Array.isArray(o)) return o;
    if (a instanceof String) return o.split(" ");
    return [o];
};

/** Get a field from a config file. */
var get = function (config, name, defaultValue) {
    if (name in config) return config[name];
    if (typeof defaultValue != "undefined") return defaultValue;
    throw new Error("Missing required entry in config file: " + name);
};

/**
 * Copy all the files in a directory into another directory. Not a true merge, only one level deep.
 */
var copyDirContents = function (from, to) {
    fs.readdirSync(from).forEach(function (file) {
        var src = path.join(from, file);
        var dest = path.join(to, file);
        if (fs.statSync(src).isDirectory()) {
            wrench.copyDirSyncRecursive(src, dest, {forceDelete: true});
        } else {
            copyFile(src, dest);
        }
    });
};

var copyFile = function (from, to) {
    var content = fs.readFileSync(from);
    fs.writeFileSync(to, content);
};
