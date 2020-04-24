
'use strict';
const find = require('find');
const path = require('path');
const fs = require('fs');
const fse = require('fs-extra');
const { spawn } = require('child_process');

const trace = Editor.log;
const rootpath = __dirname;

const spawnPromise = function (command, params, cwd) {
    let _log = "";
    let _error = false;
    return new Promise((resolve, reject) => {
        const ls = spawn(command, params, { cwd: cwd });
        ls.stdout.on('data', (data) => {
            _log = _log + data;
        });

        ls.stderr.on('data', (data) => {
            _log = _log + data;
            _error = true;
        });

        ls.on('close', (code) => {
            trace(_log);
            resolve(_log);
        });
    })
}
const findPromise = function (reg, dir) {
    return new Promise((resolve, reject) => {
        if (!reg || !dir) {
            reject("");
            return;
        }
        find.file(reg, dir, function (files) {
            resolve(files);
        })
    })
}
const timePromise = function (duration) {
    return new Promise((resolve, reject) => {
        setTimeout(resolve, duration);
    })
}


let audioHandler = async function (workdir) {
    trace("[audioCompress] workdir =" + workdir)
    let cmdBin = "";
    if (require('os').platform() === "win32") {
        cmdBin = path.join(rootpath, "libs", "ffmpeg-20200303-60b1f85-win64-static", "bin", "ffmpeg.exe")
    } else {
        cmdBin = path.join(rootpath, "libs", "ffmpeg-20200303-60b1f85-macos64-static", "bin", "ffmpeg")
    }
    let reduceSize = 0; // 减少的总大小
    let convertPath = path.join(projectPath, "temp", "_temp.mp3");
    let mp3files = await findPromise(/\.mp3$/, workdir);
    mp3files = mp3files.concat(await findPromise(/\.wav$/, workdir));
    trace(`[audioCompress] 搜索到mp3/wav文件数${mp3files.length}`)
    for (let mp3file of mp3files) {
        await fse.remove(convertPath);
        try {
            await spawnPromise(cmdBin, [
                '-i', mp3file,
                '-ac', 1,
                '-ar', 44100,
                convertPath
            ]);
        } catch (e) {
            trace("[audioCompress] convert error ", e);
            continue;
        }
        let ss1 = fs.statSync(mp3file);
        let ss2 = fs.statSync(convertPath);
        reduceSize += ss1.size - ss2.size;
        await fse.removeSync(mp3file);
        await fse.moveSync(convertPath, mp3file.replace(".wav", ".mp3"));
        trace(`[audioCompress] ${path.basename(mp3file)} 转换完成,压缩率${(ss2.size / ss1.size).toFixed(2)}`);
        await timePromise(100);
    }
    trace('[audioCompress] finished! 总共减小 = ' + Math.ceil(reduceSize / 1024) + "kb");
}
let isLock = false;
/**
 * 
 * 音频转单声道
 */
module.exports = async function (workdir) {
    if (isLock) {
        trace(`[audioCompress] 正在处理中，请处理结束后再来尝试`)
        return;
    }
    isLock = true;
    try {
        await audioHandler(params);
    } catch (e) {
        trace("[audioCompress]", e)
    }
    isLock = false;
}