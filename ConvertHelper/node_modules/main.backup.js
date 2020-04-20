'use strict';
const find = require('find');
const path = require('path');
const fs = require('fs');
const fse = require('fs-extra');
const { spawn } = require('child_process');
const trace = Editor.log;

let projectPath = "";
try {
    projectPath = Editor.Project.path;
} catch (e) {
    projectPath = Editor.projectInfo.path;
}
let isAudioLock = false;
let isImgLock = false;

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
    trace("[ConvertHelper] workdir =" + workdir)
    let cmdBin = "";
    if (require('os').platform() === "win32") {
        cmdBin = path.join(__dirname, "libs", "ffmpeg-20200303-60b1f85-win64-static", "bin", "ffmpeg.exe")
    } else {
        cmdBin = path.join(__dirname, "libs", "ffmpeg-20200303-60b1f85-macos64-static", "bin", "ffmpeg")
    }
    let reduceSize = 0; // 减少的总大小
    let convertPath = path.join(projectPath, "temp", "_temp.mp3");
    let mp3files = await findPromise(/\.mp3$/, workdir);
    mp3files = mp3files.concat(await findPromise(/\.wav$/, workdir));
    trace(`[ConvertHelper] 搜索到mp3/wav文件数${mp3files.length}`)
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
            trace("[ConvertHelper] convert error ", e);
            continue;
        }
        let ss1 = fs.statSync(mp3file);
        let ss2 = fs.statSync(convertPath);
        reduceSize += ss1.size - ss2.size;
        await fse.removeSync(mp3file);
        await fse.moveSync(convertPath, mp3file.replace(".wav", ".mp3"));
        trace(`[ConvertHelper] ${path.basename(mp3file)} 转换完成,压缩率${(ss2.size / ss1.size).toFixed(2)}`);
        await timePromise(100);
    }
    trace('[ConvertHelper] finished! 总共减小 = ' + Math.ceil(reduceSize / 1024) + "kb");
}

let imgHandler = async function (imgInfo) {
    let workdir = imgInfo.workDir;
    let cmdBin = "";
    if (require('os').platform() === "win32") {
        cmdBin = path.join(__dirname, "libs", "libwebp-0.4.1-rc1-windows-x64", "bin", "cwebp.exe")
    } else {
        cmdBin = path.join(__dirname, "libs", "libwebp-0.4.1-mac-10.8", "bin", "cwebp")
    }
    let fileLimt = imgInfo.minFileLimt * 1024;
    let jpgfiles = await findPromise(/\.jpg$/, workdir);
    jpgfiles = jpgfiles.concat(await findPromise(/\.jpeg$/, workdir))
    trace(`[ConvertHelper] 搜索到jpg/jpeg文件数${jpgfiles.length}`)
    let reduceSize = 0; // 减少的总大小
    for (let jpgfile of jpgfiles) {
        let ss1 = fs.statSync(jpgfile);
        if (ss1.size < fileLimt) {
            trace(`[ConvertHelper]${path.basename(jpgfile)}小于${imgInfo.minFileLimt}kb，跳过处理`);
            continue;
        }
        let newfilepath = jpgfile + '.webp';
        try {
            await spawnPromise(cmdBin, [
                "-q", Math.ceil(imgInfo.jpgQuality) + "",
                "-noalpha", "-jpeg_like",
                jpgfile,
                "-o",
                newfilepath
            ]);
        } catch (e) {
            trace("[ConvertHelper] convert error ", e);
            continue;
        }
        let ss2 = fs.statSync(newfilepath);
        if (imgInfo.checkConvertSize) {
            if (ss1.size < ss2.size) {
                trace(`[ConvertHelper] ${path.basename(jpgfile)} 转换后文件增大忽略转换`);
                fs.unlinkSync(newfilepath);
                continue;
            }
        }
        reduceSize += ss1.size - ss2.size;
        if (imgInfo.override) {
            fs.unlinkSync(jpgfile);
            await timePromise(200);
            await fse.rename(newfilepath, jpgfile);
            trace(`[ConvertHelper] ${path.basename(jpgfile)} 文件已覆盖, 压缩率${(ss2.size / ss1.size).toFixed(2)}`);
        } else {
            trace(`[ConvertHelper] ${path.basename(jpgfile)} 转换完成, 压缩率${(ss2.size / ss1.size).toFixed(2)}`);
        }
    }
    let pngfiles = await findPromise(/\.png$/, workdir);
    trace(`[ConvertHelper] 搜索到png文件数${pngfiles.length}`)
    for (let jpgfile of pngfiles) {
        let ss1 = fs.statSync(jpgfile);
        if (ss1.size < fileLimt) {
            trace(`[ConvertHelper]${path.basename(jpgfile)}小于${imgInfo.minFileLimt}kb，跳过处理`);
            continue;
        }
        let newfilepath = jpgfile + '.webp';
        try {
            await spawnPromise(cmdBin, [
                "-q", Math.ceil(imgInfo.pngQuality) + "",
                jpgfile,
                "-o",
                newfilepath
            ]);
        } catch (e) {
            trace("[ConvertHelper] convert error ", e);
            continue;
        }
        let ss2 = fs.statSync(newfilepath);
        if (imgInfo.checkConvertSize) {
            if (ss1.size < ss2.size) {
                trace(`[ConvertHelper] ${path.basename(jpgfile)} 转换后文件增大忽略转换`);
                fs.unlinkSync(newfilepath);
                continue;
            }
        }
        reduceSize += ss1.size - ss2.size;
        if (imgInfo.override) {
            fs.unlinkSync(jpgfile);
            await timePromise(200);
            await fse.rename(newfilepath, jpgfile);
            trace(`[ConvertHelper] ${path.basename(jpgfile)} 文件已覆盖, 压缩率${(ss2.size / ss1.size).toFixed(2)}`);
        } else {
            trace(`[ConvertHelper] ${path.basename(jpgfile)} 转换完成, 压缩率${(ss2.size / ss1.size).toFixed(2)}`);
        }
    }
    trace('[ConvertHelper] finished! 总共减小 = ' + Math.ceil(reduceSize / 1024) + "kb");
}


module.exports = {
    load() {
        // execute when package loaded
    },

    unload() {
        // execute when package unloaded
    },

    // register your ipc messages here
    messages: {
        'converthelper:open'() {
            // open entry panel registered in package.json
            Editor.Panel.open('converthelper');
        },
        'converthelper:audioHandler'(event, params) {
            if (isAudioLock) {
                trace('[ConvertHelper] Audio convert is processing!');
                return;
            }
            isAudioLock = true;
            try {
                audioHandler(JSON.parse(params).workDir).then(() => {
                    isAudioLock = false;
                }, (err) => {
                    isAudioLock = false;
                    trace(err);
                })
            } catch (e) {
                Editor.error(e);
            }
        },
        'converthelper:imgHandler'(event, params) {
            trace("converthelper:imgHandler  ", event, params)
            if (isImgLock) {
                trace('[ConvertHelper] Image convert is processing!');
                return;
            }
            isImgLock = true;
            try {
                imgHandler(JSON.parse(params)).then(() => {
                    isImgLock = false;
                }, (err) => {
                    isImgLock = false;
                    trace(err)
                })
            } catch (e) {
                trace(e);
            }
        },
    },
};