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
    [".tsx", ".tmx", ".fnt", ".plist", ".txt", ".atlas", ".json", ".xml", ".ExportJson"]
        .forEach(function (format) {
            handlers[format.substr(1)] = function (item, onComplete) {
                var res = window.ccassets[item.url];
                if (res) {
                    onComplete && onComplete(null, res);
                } else {
                    onComplete && onComplete(new Error(item.url + " unpack!"));
                }
            };
        });
    ['.png', '.jpg', '.jpeg', '.bmp', '.gif', '.webp'].forEach(function (format) {
        format = format.substr(1);
        handlers[format] = function (item, onComplete) {
            var img = new Image()
            img.id = item.id;
            img.src = "data:image/" + format + ";base64," + window.ccassets[item.url];
            onComplete && onComplete(null, img)
        };
    });
    ['.mp3', '.wav', '.ogg', '.w4a'].forEach(function (format) {
        handlers[format.substr(1)] = function (item, onComplete) {
            base64DecToArr(window.ccassets[item.url]).buffer,
                function (buffer) {
                    onComplete(null, buffer)
                },
                function () {
                    onComplete(new Error("mp3-res-fail"), null)
                }
        };
    });
    ['binary', ".bin", ".dbbin", ".skel"].forEach(function (format) {
        handlers[format.substr(1)] = function (item, onComplete) {
            var arraybuffer = base64DecToArr(window.ccassets[item.url]).buffer;
            onComplete(null, arraybuffer);
        };
    });
    cc.loader.addDownloadHandlers(handlers);
    console.log('cc.loader.addDownloadHandlers')
})();