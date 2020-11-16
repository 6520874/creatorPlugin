(function () {
    function b64ToUint6(nChr) {
        return nChr > 64 && nChr < 91
            ? nChr - 65 : nChr > 96 && nChr < 123
                ? nChr - 71 : nChr > 47 && nChr < 58
                    ? nChr + 4 : nChr === 43
                        ? 62 : nChr === 47
                            ? 63 : 0
    }
    function base64DecToArr(sBase64, nBlockSize) {
        var sB64Enc = sBase64.replace(/[^A-Za-z0-9\+\/]/g, ""), nInLen = sB64Enc.length
        var nOutLen = nBlockSize ? Math.ceil((nInLen * 3 + 1 >>> 2) / nBlockSize) * nBlockSize : nInLen * 3 + 1 >>> 2
        var aBytes = new Uint8Array(nOutLen)
        for (var nMod3, nMod4, nUint24 = 0, nOutIdx = 0, nInIdx = 0; nInIdx < nInLen; nInIdx++) {
            nMod4 = nInIdx & 3
            nUint24 |= b64ToUint6(sB64Enc.charCodeAt(nInIdx)) << 18 - 6 * nMod4
            if (nMod4 === 3 || nInLen - nInIdx === 1) {
                for (nMod3 = 0; nMod3 < 3 && nOutIdx < nOutLen; nMod3++, nOutIdx++) {
                    aBytes[nOutIdx] = nUint24 >>> (16 >>> nMod3 & 24) & 255;
                }
                nUint24 = 0
            }
        }
        return aBytes
    }
    var handlers = {};
    function downloadPackFile(url, options, onProgress, onComplete) {
        onProgress && onProgress(1, 1);
        var res = window.ccassets[url];
        if (res) {
            onComplete && onComplete(null, res);
        } else {
            onComplete && onComplete(new Error(item.url + " unpack!"));
        }
    }
    [".tsx", ".tmx", ".fnt", ".plist", ".txt", ".atlas", ".json", ".xml", ".ExportJson"].forEach(function (format) {
        if (format == ".json") {
            handlers[format] = function (url, options, onComplete) {
                downloadPackFile(url, options, options.onFileProgress || null, function (err, data) {
                    if (!err && typeof data === 'string') {
                        try {
                            data = JSON.parse(data);
                        } catch (e) {
                            err = e;
                        }
                    }
                    onComplete && onComplete(err, data);
                });
            };
        } else {
            handlers[format] = function (url, options, onComplete) {
                downloadPackFile(url, options, options.onFileProgress || null, onComplete);
            };
        }
    });
    ['.png', '.jpg', '.jpeg', '.bmp', '.gif', '.webp'].forEach(function (format) {
        handlers[format] = function (url, options, onComplete) {
            var img = new Image()
            img.src = "data:image/" + format.substr(1) + ";base64," + window.ccassets[url];
            onComplete && onComplete(null, img)
        };
    });
    ['.mp3', '.wav', '.ogg', '.w4a'].forEach(function (format) {
        handlers[format] = function (url, options, onComplete) {
            cc.sys.__audioSupport.context.decodeAudioData(
                base64DecToArr(window.ccassets[url]).buffer,
                function (buffer) {
                    onComplete && onComplete(null, buffer)
                },
                function () {
                    onComplete && onComplete(new Error("mp3-res-fail"), null)
                }
            );
        };
    });
    ['binary', ".bin", ".dbbin", ".skel"].forEach(function (format) {
        handlers[format] = function (url, options, onComplete) {
            try {
                var arraybuffer = base64DecToArr(window.ccassets[url]).buffer;
                onComplete && onComplete(null, arraybuffer);
            } catch (e) {
                onComplete && onComplete(e)
            }

        };
    });
    handlers["bundle"] = function (nameOrUrl, options, onComplete) {
        var bundleName = cc.path.basename(nameOrUrl);
        var url = nameOrUrl;
        /^\w+:\/\/.*/.test(url) || (url = "assets/" + bundleName);
        var version = options.version || cc.assetManager.downloader.bundleVers[bundleName];
        var config = url + "/config." + (version ? version + "." : "") + "json";
        var out = null, error = null;
        out = window.ccassets[config];
        if (typeof out == "string") {
            try {
                out = JSON.parse(out);
            } catch (e) {
                err = e;
            }
        }
        out && (out.base = url + "/");
        onComplete(error, out);
    };
    cc.assetManager.downloader.register(handlers);
    console.log('cc.assetManager.downloader.register')
})();