'use strict';
const path = require('path');
const fs = require('fs');
const fse = require('fs-extra');
const PNG = require("pngjs").PNG;

const audioCompress = require('./audioCompress');
const towebp = require('./towebp');

const trace = Editor.log;

let projectPath = "";
try {
    projectPath = Editor.Project.path;
} catch (e) {
    projectPath = Editor.projectInfo.path;
}

let spriteEditHandler = function (webcontent) {
    let jscode = `
    if (document.querySelector("#btn_crop") == null) {
        let btn_crop = document.createElement("ui-button");
        btn_crop.id = "btn_crop";
        btn_crop.innerText = "Cropping Image";
        btn_crop.style.cssText = "position:fixed;bottom:20px;left:20px";
        btn_crop.onclick = function () {
            // 遍历当前的所有ui-num-input
            let elements = document.querySelector('ui-panel-frame').shadowRoot.querySelectorAll('ui-num-input');
            let crops = {};
            for (let inputElement of elements) {
                let attrs = inputElement.attributes;
                let object = {};
                for (let aaa of attrs) {
                    if (aaa.name == "id") {
                        object.id = aaa.value;
                    }
                    if (aaa.name == "value") {
                        object.value = aaa.value;
                    }
                }
                crops[object.id] = object.value
            }
            Editor.Ipc.sendToMain('converthelper:cropImage', {
                url: location.href,
                crops: crops
            });
        }
        document.body.appendChild(btn_crop);
    }
`
    webcontent.executeJavaScript(jscode, true).then((result) => {
        trace(result) // Will be the JSON object from the fetch call
    })
}

module.exports = {
    load() {
        // execute when package 
        if (!Editor.Panel.$open) {
            Editor.Panel.$open = Editor.Panel.open;
            Editor.Panel.open = function (...args) {
                Editor.Panel.$open(...args);
                setTimeout(() => {
                    const { webContents } = require('electron')
                    for (let webcontent of webContents.getAllWebContents()) {
                        // Editor.log("*******" + webcontent.id + webcontent.getTitle(), webcontent.getURL());
                        if (webcontent.getURL().indexOf("sprite-editor") > 0) {
                            spriteEditHandler(webcontent);
                        }
                    }
                }, 300)
            }
        }
    },

    unload() {
        if (Editor.Panel.$open) {
            Editor.Panel.open = Editor.Panel.$open
            Editor.Panel.$open = null;
        }
        // execute when package unloaded
    },

    // register your ipc messages here
    messages: {

        'converthelper:open'() {
            // open entry panel registered in package.json
            Editor.Panel.open('converthelper');
        },

        'converthelper:audioHandler'(event, params) {
            audioCompress(JSON.parse(params).workDir);
        },
        'converthelper:imgHandler'(event, params) {
            trace("converthelper:imgHandler  ", event, params)
            towebp(JSON.parse(params));
        },
        'converthelper:cropImage'(event, params) {
            // open entry panel registered in package.json
            let fileInfo = JSON.parse(decodeURIComponent(params.url).split("#")[1]);
            let crops = params.crops;
            trace("crops", crops);
            // 找到该图片
            let fileuuid = fileInfo["panelArgv"]['uuid'];
            ''.substr(0, 2)
            let imgjsonpath = path.join(projectPath, "library", 'imports', fileuuid.substr(0, 2), fileuuid + ".json");
            if (!fse.existsSync(imgjsonpath)) {
                trace(imgjsonpath + '不存在！');
                return;
            }
            let jsoninfo = JSON.parse(fse.readFileSync(imgjsonpath, 'utf8'));
            let uuidmtimepath = path.join(projectPath, "library", 'uuid-to-mtime.json');
            if (!fse.existsSync(uuidmtimepath)) {
                trace(uuidmtimepath + '不存在！');
                return;
            }
            let uuidInfo = JSON.parse(fse.readFileSync(uuidmtimepath, 'utf8'));
            let imgInfo = uuidInfo[jsoninfo["content"]["texture"]];
            let imgrelativePath = imgInfo["relativePath"];
            if (!imgrelativePath) {
                return;
            }

            let imgPath = path.join(projectPath, "assets", imgrelativePath);
            if (!imgPath.endsWith(".png")) {
                Editor.Dialog.messageBox({ type: "info", message: "Sorry,The tool only supports png format. " })
                return;
            }
            trace("处理的图片路径=" + imgPath);
            let sizeL = parseInt(crops["inputL"]);
            let sizeR = parseInt(crops["inputR"])
            let sizeT = parseInt(crops["inputT"])
            let sizeB = parseInt(crops["inputB"])
            // let resultImg = images(sizeL + sizeR, sizeT + sizeB);
            // let originImg = images(imgPath);
            // let originSize = originImg.size();

            fs.createReadStream(imgPath)
                .pipe(
                    new PNG({
                        filterType: 4,
                    })
                )
                .on("parsed", function () {
                    trace("图片解析完成")
                    let png = new PNG({
                        width: sizeL + sizeR,
                        height: sizeT + sizeB,
                        filterType: 4
                    });
                    trace("生成新的png width=" + png.width + "  height" + png.height)
                    let de_width = sizeL + sizeR;
                    let de_height = sizeT + sizeB;
                    for (let y = 0; y < this.height; y++) {
                        for (let x = 0; x < this.width; x++) {
                            let idx = (this.width * y + x) << 2;
                            // 左上
                            if (x <= sizeL && y <= sizeT) {
                                let idx1 = (de_width * y + x) << 2
                                png.data[idx1] = this.data[idx];
                                png.data[idx1 + 1] = this.data[idx + 1];
                                png.data[idx1 + 2] = this.data[idx + 2];
                                png.data[idx1 + 3] = this.data[idx + 3];
                                continue;
                            }
                            // 右上
                            if (x >= (this.width - sizeR) && y <= sizeT) {
                                let _x = x - (this.width - sizeL - sizeR);
                                let idx1 = (de_width * y + _x) << 2;
                                png.data[idx1] = this.data[idx];
                                png.data[idx1 + 1] = this.data[idx + 1];
                                png.data[idx1 + 2] = this.data[idx + 2];
                                png.data[idx1 + 3] = this.data[idx + 3];
                                continue;
                            }
                            // 左下
                            if (x <= sizeL && y >= (this.height - sizeB)) {
                                let _y = y - (this.height - sizeT - sizeB);
                                let idx1 = (de_width * _y + x) << 2
                                png.data[idx1] = this.data[idx];
                                png.data[idx1 + 1] = this.data[idx + 1];
                                png.data[idx1 + 2] = this.data[idx + 2];
                                png.data[idx1 + 3] = this.data[idx + 3];
                                continue;
                            }
                            // 右下
                            if (x >= (this.width - sizeR) && y >= (this.height - sizeB)) {
                                let _y = y - (this.height - sizeT - sizeB);
                                let _x = x - (this.width - sizeL - sizeR);
                                let idx1 = (de_width * _y + _x) << 2;
                                png.data[idx1] = this.data[idx];
                                png.data[idx1 + 1] = this.data[idx + 1];
                                png.data[idx1 + 2] = this.data[idx + 2];
                                png.data[idx1 + 3] = this.data[idx + 3];
                                continue;
                            }
                        }
                    }
                    let rs = png.pack();
                    let ws = fs.createWriteStream(imgPath.replace(".png", "_9grid.png"));
                    rs.pipe(ws);
                });


            // resultImg.draw(originImg, 0, 0, sizeL, sizeT);
            // resultImg.draw(originImg, 0, originSize.height - sizeB, sizeL, sizeB);
            // resultImg.draw(originImg, originSize.width - sizeR, 0, sizeR, sizeT);
            // resultImg.draw(originImg, originSize.width - sizeR, originSize.height - sizeB, sizeR, sizeB);
            // resultImg.save(path.join(projectPath, "test.png"));
        },
    },
};