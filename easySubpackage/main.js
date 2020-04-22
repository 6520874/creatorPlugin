'use strict';
const fs = require("fs");
const path = require("path");
const utils = require('util');
const { spawn } = require('child_process');
const fse = require('fs-extra');
const shell = require('electron').shell;
const os = require('os');

const querydbTypes = ['native-asset', 'audio-clip', 'bitmap-font', 'json',
    'particle', 'prefab', 'scene', 'ttf-font',
    'texture-packer', 'sprite-frame', 'texture', 'text',
    'font', 'spine', 'auto-atlas', 'label-atlas', 'raw-asset',
    'tiled-map', 'dragonbones', 'dragonbones-atlas'
]

const trace = Editor.log;

const readFilePromise = utils.promisify(fs.readFile);

const timePromise = function (duration) {
    return new Promise((resolve, reject) => {
        setTimeout(resolve, duration);
    })
}
const spawnPromise = function (command, params, cwd) {
    // trace(`[spawnPromise] command=${command},params=${params}`);
    let _log = ""
    return new Promise((resolve, reject) => {
        const ls = spawn(command, params, { cwd: cwd });
        ls.stdout.on('data', (data) => {
            // trace(`${data}`);
            _log = _log + data;
        });

        ls.stderr.on('data', (data) => {
            // trace(` ${data}`);
            _log = _log + data;
        });

        ls.on('close', (code) => {
            // trace(`exitCode=${code}`);
            resolve(_log);
        });
    })
}
const loopDirs = function (dir, arr) {
    if (!arr) {
        arr = [];
    }
    let files = fs.readdirSync(dir);
    for (let file of files) {
        if (file.indexOf(".git") >= 0 || file.indexOf(".svn") >= 0 || file.indexOf('gitignore') > 0) {
            continue;
        }
        let fullpath = path.join(dir, file);
        let stat = fs.statSync(fullpath);
        if (stat.isFile()) {
            arr.push(fullpath);
        } else if (stat.isDirectory()) {
            loopDirs(fullpath, arr);
        }
    }

}
/**
 * 查询
 * @param {*} dirpath 
 * @param {*} type 
 */
const queryAssestPromise = function (dirpath, type) {
    return new Promise((resolve, reject) => {
        Editor.assetdb.queryAssets(dirpath, type, (err, assetInfos) => {
            //Editor.log(`sprite-frames: ${JSON.stringify(assetInfos,null,2)} `);
            if (err) {
                reject(err)
            } else {
                resolve(assetInfos);
            }
        });
    })
}

let main = async (options) => {

    let projectPath = options["project"];
    try {
        projectPath = Editor.Project.path;
    } catch (e) {
        projectPath = Editor.projectInfo.path;
    }
    let subpackageConfigPath = path.join(projectPath, "temp", "easySubpackage.json");
    if (!fs.existsSync(subpackageConfigPath)) {
        return;
    }
    let sss = fs.readFileSync(subpackageConfigPath, 'utf8')
    let obj = JSON.parse(sss);
    let isOpenSubpackage = !!obj.isOpenSubpackage;
    if (!isOpenSubpackage) {
        trace(`[easySubpackage] isOpenSubpackage == false`)
        return;
    }
    let subpackagePathstr = obj.subpackagePaths || "";
    if (!subpackagePathstr) {
        return;
    }
    let subpackagePaths = [];
    let arr = subpackagePathstr.split(/[\n,;]+/);
    // 排除路径包含关系
    for (let aaa of arr) {
        let hasreplace = false;
        for (let i = 0; i < subpackagePaths.length; i++) {
            let hgpath = subpackagePaths[i];
            if (aaa.indexOf(hgpath) >= 0 && aaa.length > hgpath.length) {
                subpackagePaths[i] = aaa.replace(/(^\s*)|(\s*$)/g, "");
                hasreplace = true;
            }
        }
        if (!hasreplace) {
            subpackagePaths.push(aaa.replace(/(^\s*)|(\s*$)/g, ""));
        }
    }
    trace(`[easySubpackage] subpackagePaths=${subpackagePaths}`)
    if (subpackagePaths.length < 1) {
        return;
    }
    let assetsDBS = new Map();
    for (let qtype of querydbTypes) {
        let ret = await queryAssestPromise('db://assets/**', qtype);
        if (ret.length > 0) {
            for (let rr of ret) {
                assetsDBS.set(rr["uuid"], rr);
            }
        }
    }

    let subpackageOutputPath = path.join(projectPath, "build", "easysubpackage");
    trace(`[easySubpackage] delete ${subpackageOutputPath}`);
    await fse.emptyDir(subpackageOutputPath);
    trace(` [easySubpackage] ${path.join(options["dest"], "res")} copy to ${path.join(subpackageOutputPath, "res")} `)
    await fse.copy(path.join(options["dest"], "res"), path.join(subpackageOutputPath, "res"));

    let subpackageFileContentHash = {};
    /**遍历所有构建完成的文件 */
    let allresfilePaths = [];
    loopDirs(path.join(subpackageOutputPath, "res"), allresfilePaths)
    for (let sfile of allresfilePaths) {
        let uuid = path.basename(sfile).split(".")[0];
        let hasfind = false;
        if (assetsDBS.has(uuid)) {
            let assetInfo = assetsDBS.get(uuid)
            let idePath = assetInfo.path;
            idePath = idePath.replace(/[\\]+/g, "/");
            for (let hgpath of subpackagePaths) {
                if (idePath.indexOf(hgpath) >= 0) {
                    let subpackageID = "res_" + hgpath.replace(/[\\/\.]+/g, "-");
                    if (!subpackageFileContentHash[subpackageID]) {
                        subpackageFileContentHash[subpackageID] = [];
                        Editor.log("[easySubpackage] create subpackages " + subpackageID);
                        await fse.ensureDir(path.join(subpackageOutputPath, subpackageID));
                    }
                    let arr = subpackageFileContentHash[subpackageID];
                    let _path = sfile.split('easysubpackage')[1];
                    _path = _path.replace(/[\\]+/g, "/");
                    if (_path[0] == "/") {
                        _path = _path.substring(1)
                    }
                    arr.push(_path);
                    hasfind = true;
                    await fse.move(sfile, path.join(subpackageOutputPath, _path.replace('res', subpackageID)))
                    break;
                }
            }
        }
    }
    for (let subpackageID in subpackageFileContentHash) {
        let files = subpackageFileContentHash[subpackageID];
        if (files instanceof Array) {
            let sss = JSON.stringify(files, null, 2);
            let subpackageIDConfigPath = path.join(subpackageOutputPath, subpackageID + ".json");
            fs.writeFileSync(subpackageIDConfigPath, sss, 'utf8')
        }
    }

    Editor.success("[easySubpackage] finished！")
    shell.showItemInFolder(subpackageOutputPath);
    return subpackageOutputPath;
}




async function onBuildFinish(options, callback) {
    Editor.log("[easySubpackage] Build options", options);
    if (options.platform === "android" || options.platform === "ios") {
        let result = '';
        try {
            result = await main(options);
        } catch (e) {
            Editor.log(e)
        }
        callback();
        Editor.Ipc.sendToMain('easySubpackage:finished',result);
    }else{
        callback();
    }
}


module.exports = {
    load() {
        // execute when package loaded
        Editor.success("easySubpackage Initialization")
        Editor.Builder.on('build-finished', onBuildFinish);
    },

    unload() {
        // execute when package unloaded
        Editor.Builder.removeListener('build-finished', onBuildFinish);
    },

    // register your ipc messages here
    messages: {
        'easySubpackage:open'() {
            // open entry panel registered in package.json
            Editor.Panel.open('easysubpackage');
        }
    },
};