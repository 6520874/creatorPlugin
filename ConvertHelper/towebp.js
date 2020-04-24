'use strict';
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

const fse = require('fs-extra');
const md5File = require('md5-file');
const find = require('find');

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
let imgHandler = async function (imgInfo) {
    let workdir = imgInfo.workDir;
    let cmdBin = "";
    if (require('os').platform() === "win32") {
        cmdBin = path.join(rootpath, "libs", "libwebp-0.4.1-rc1-windows-x64", "bin", "cwebp.exe")
    } else {
        cmdBin = path.join(rootpath, "libs", "libwebp-0.4.1-mac-10.8", "bin", "cwebp")
    }
    // 缓存webp图片路径
    let webptempdir = path.join(path.dirname(rootpath), ".webptemp");
    fse.ensureDirSync(webptempdir);
    fse.emptyDirSync(path.join(webptempdir, Math.ceil(imgInfo.jpgQuality) + "" || "jpg"));
    fse.emptyDirSync(path.join(webptempdir, Math.ceil(imgInfo.pngQuality) + "" || "png"));

    let fileLimt = (imgInfo.minFileLimt || 0) * 1024;
    let jpgfiles = await findPromise(/\.jpg$/, workdir);
    jpgfiles = jpgfiles.concat(await findPromise(/\.jpeg$/, workdir))
    trace(`[ToWebp] 搜索到jpg/jpeg文件数${jpgfiles.length}`)
    let reduceSize = 0; // 减少的总大小
    for (let jpgfile of jpgfiles) {
        let ss1 = fs.statSync(jpgfile);
        if (ss1.size < fileLimt) {
            trace(`[ToWebp]${path.basename(jpgfile)}小于${imgInfo.minFileLimt}kb，跳过处理`);
            continue;
        }
        let newfilepath = jpgfile + '.webp';
        let md5code = md5File.sync(jpgfile);
        let tempfilepath = path.join(webptempdir, Math.ceil(imgInfo.jpgQuality) + "", md5code + ".webp");
        if (fse.existsSync(tempfilepath)) {
            await fse.copyFile(tempfilepath, newfilepath);
        } else {
            try {
                await spawnPromise(cmdBin, [
                    "-q", Math.ceil(imgInfo.jpgQuality) + "",
                    "-noalpha", "-jpeg_like",
                    jpgfile,
                    "-o",
                    newfilepath
                ]);
                // 拷贝一份到缓存中去
                fse.copyFile(newfilepath, tempfilepath);
            } catch (e) {
                trace("[ToWebp] convert error ", e);
                continue;
            }
        }
        let ss2 = fs.statSync(newfilepath);
        if (imgInfo.checkConvertSize) {
            if (ss1.size < ss2.size) {
                trace(`[ToWebp] ${path.basename(jpgfile)} 转换后文件增大忽略转换`);
                fs.unlinkSync(newfilepath);
                continue;
            }
        }
        reduceSize += ss1.size - ss2.size;
        if (imgInfo.override) {
            fs.unlinkSync(jpgfile);
            await timePromise(200);
            await fse.rename(newfilepath, jpgfile);
            trace(`[ToWebp] ${path.basename(jpgfile)} 文件已覆盖, 压缩率${(ss2.size / ss1.size).toFixed(2)}`);
        } else {
            trace(`[ToWebp] ${path.basename(jpgfile)} 转换完成, 压缩率${(ss2.size / ss1.size).toFixed(2)}`);
        }
    }
    let pngfiles = await findPromise(/\.png$/i, workdir);
    trace(`[ToWebp] 搜索到png文件数${pngfiles.length}`);
    for (let jpgfile of pngfiles) {
        let ss1 = fs.statSync(jpgfile);
        if (ss1.size < fileLimt) {
            trace(`[ToWebp]${path.basename(jpgfile)}小于${imgInfo.minFileLimt}kb，跳过处理`);
            continue;
        }
        let newfilepath = jpgfile + '.webp';
        let md5code = md5File.sync(jpgfile);
        let tempfilepath = path.join(webptempdir, Math.ceil(imgInfo.pngQuality) + "", md5code + ".webp");
        if (fse.existsSync(tempfilepath)) {
            await fse.copyFile(tempfilepath, newfilepath);
        } else {
            try {
                await spawnPromise(cmdBin, [
                    "-q", Math.ceil(imgInfo.pngQuality) + "",
                    jpgfile,
                    "-o",
                    newfilepath
                ]);
                // 拷贝一份到缓存中去
                fse.copyFile(newfilepath, tempfilepath);
            } catch (e) {
                trace("[ToWebp] convert error ", e);
                continue;
            }
        }
        let ss2 = fs.statSync(newfilepath);
        if (imgInfo.checkConvertSize) {
            if (ss1.size < ss2.size) {
                trace(`[ToWebp] ${path.basename(jpgfile)} 转换后文件增大忽略转换`);
                fs.unlinkSync(newfilepath);
                continue;
            }
        }
        reduceSize += (ss1.size - ss2.size);
        if (imgInfo.override) {
            fs.unlinkSync(jpgfile);
            await timePromise(200);
            await fse.rename(newfilepath, jpgfile);
            trace(`[ToWebp] ${path.basename(jpgfile)} 文件已覆盖, 压缩率${(ss2.size / ss1.size).toFixed(2)}`);
        } else {
            trace(`[ToWebp] ${path.basename(jpgfile)} 转换完成, 压缩率${(ss2.size / ss1.size).toFixed(2)}`);
        }
    }
    trace('[ToWebp] finished! 总共减小 = ' + Math.ceil(reduceSize / 1024) + "kb");
}

let isLock = false;
/**
 * params:「
 {
     minFileLimt:10,
     workDir:"/build" // 需要处理图片的目录
     jpgQuality:80
     pngQuality:80,
     checkConvertSize:true, // true表示如果转码以后还比以前大则跳过处理
     override:true // 是否覆盖
 }
 */
module.exports = async function (params) {
    if (isLock) {
        trace(`[ToWebp] 正在处理中，请处理结束后再来尝试`)
        return;
    }
    isLock = true;
    try {
        await imgHandler(params);
    } catch (e) {
        trace(e)
    }
    isLock = false;
}