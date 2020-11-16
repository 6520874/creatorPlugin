
const path = require("path");
const fs = require('fs');
const CleanCSS = require("clean-css");

let workdir = process.argv[2];
if (!workdir) {
    workdir = __dirname;
}
workdir = '/Volumes/works/lanwan_projects/jigsawAds/build/web-mobile';
workdir = '/Volumes/works/lanwan_projects/jigsawAds/web-mobile';


// 以下格式转成base64
const base64FileFormat = new Set(['.png', '.jpg', '.jpeg', '.bmp', '.gif', '.webp', '.mp3', '.wav', '.ogg', '.w4a', 'binary', ".bin", ".dbbin", ".skel"]);
// 以下文本文件需要处理
const textFileFormat = new Set([".tsx", ".tmx", ".fnt", ".plist", ".txt", ".atlas", ".json", ".xml", ".ExportJson"]);
const timePromise = function (duration) {
    return new Promise((resolve) => {
        setTimeout(resolve, duration);
    })
}
let main = async () => {
    let newloaderJS = '';
    let resdir = '';
    if (fs.existsSync(path.join(workdir, "assets"))) {
        resdir = path.join(workdir, "assets");
        newloaderJS = path.join(__dirname, "newloader2.4.x.js");
    } else {
        resdir = path.join(workdir, "res");
        newloaderJS = path.join(__dirname, "newloader2.3.x.js");
    }
    if (!fs.existsSync(resdir)) {
        console.error(resdir + " 不存在！");
        return;
    }
    console.log("合并的res目录", resdir)
    let loopDir = function (dir, fileArr) {
        let files = fs.readdirSync(dir);
        for (let filename of files) {
            let stat = fs.statSync(path.join(dir, filename));
            if (stat.isDirectory()) {
                loopDir(path.join(dir, filename), fileArr);
            } else if (stat.isFile()) {
                fileArr.push(path.join(dir, filename));
            }
        }
    }
    let files = [];
    loopDir(resdir, files);

    let ouputAssetUTF8Contents = {};
    let ouputAssetJSFiles = [];
    for (let assetsfilepath of files) {
        let _assetsfilepath = assetsfilepath.replace(/[\\]+/g, "/");
        let filePath = _assetsfilepath.split("web-mobile/").pop();
        let extname = path.extname(filePath);
        if (base64FileFormat.has(extname)) {
            let content = fs.readFileSync(assetsfilepath, "base64");
            ouputAssetUTF8Contents[filePath] = content;
        } else if (textFileFormat.has(extname)) {
            let content = fs.readFileSync(assetsfilepath, 'utf-8');
            ouputAssetUTF8Contents[filePath] = content;
        } else if (extname == ".js") {
            ouputAssetJSFiles.push(assetsfilepath);
        }
    }
    fs.writeFileSync(path.join(workdir, "packassets.js"), `window["ccassets"]=${JSON.stringify(ouputAssetUTF8Contents)}`);
    let jsfilesQueue = [
        path.join(workdir, "packassets.js")
    ];
    let cocosjsfiles = [];
    let loopDirJS = function (dir, fileArr) {
        if (dir.indexOf(resdir) >= 0) {
            return;
        }
        let files = fs.readdirSync(dir);
        for (let filename of files) {
            let stat = fs.statSync(path.join(dir, filename));
            if (stat.isDirectory()) {
                loopDirJS(path.join(dir, filename), fileArr);
            } else if (stat.isFile()) {
                if (filename.indexOf('.js') > 0
                    && filename.indexOf("packassets.js") < 0
                    && filename.indexOf("pack.js") < 0) {
                    fileArr.push(path.join(dir, filename));
                }
            }
        }
    }
    loopDirJS(workdir, cocosjsfiles);
    console.log("cocosjsfiles", cocosjsfiles)
    // 把settings.js 放入jsfilesQueue
    for (let index = 0; index < cocosjsfiles.length; index++) {
        const jsfile = cocosjsfiles[index];
        if (jsfile.indexOf('settings') >= 0) {
            jsfilesQueue.push(jsfile);
            cocosjsfiles.splice(index, 1);
            break;
        }
    }
    // 把main.js 放入jsfilesQueue
    for (let index = 0; index < cocosjsfiles.length; index++) {
        const jsfile = cocosjsfiles[index];
        if (jsfile.indexOf('main.') >= 0) {
            jsfilesQueue.push(jsfile);
            cocosjsfiles.splice(index, 1);
            break;
        }
    }
    // 把cocos2d-js-min.js放入jsfilesQueue
    for (let index = 0; index < cocosjsfiles.length; index++) {
        const jsfile = cocosjsfiles[index];
        if (jsfile.indexOf('cocos2d-js') >= 0) {
            jsfilesQueue.push(jsfile);
            cocosjsfiles.splice(index, 1);
            break;
        }
    }
    jsfilesQueue.push(newloaderJS)
    jsfilesQueue = jsfilesQueue.concat(cocosjsfiles);

    // assetsBundle 内合并js放入 filesQueue;
    jsfilesQueue = jsfilesQueue.concat(ouputAssetJSFiles);

    console.log("jsfilesQueue ", jsfilesQueue);

    // 清理html
    console.log("处理html")
    let html = fs.readFileSync(path.join(workdir, "index.html"), 'utf-8');
    html = html.replace(/<link rel="stylesheet".*\/>/gs, "")
    html = html.replace(/<script.*<\/script>/gs, "")

    console.log("处理 css ")
    let csscode = fs.readFileSync(path.join(__dirname, "style-mobile.css"), 'utf-8');
    csscode = `<style>${new CleanCSS().minify(csscode).styles}</style>`
    html = html.replace("</head>", `${csscode}\n</head>`);
    console.log("css 写入完成")
    let jscodecontent = '';
    for (let jsfile of jsfilesQueue) {
        if (!jsfile.endsWith(".js")) {
            continue;
        }
        console.log("处理", jsfile)
        await timePromise(300);
        jscodecontent = jscodecontent + fs.readFileSync(jsfile, 'utf-8') + "\n";
    }
    let jscodeTAG = `<script type="text/javascript">\n${jscodecontent}window.boot();</script>`
    html = html.replace("</body>", `${jscodeTAG}\n</body>`)
    // jscodeTAG = `<script type="text/javascript">window.boot();</script>`
    // html = html.replace("</body>", `${jscodeTAG}\n</body>`)

    let ouputhtml = path.join(path.dirname(workdir), "index." + Math.floor(Date.now() / 1000) + ".html");
    console.log(ouputhtml)
    fs.writeFileSync(ouputhtml, html, 'utf-8')

    console.log(" html写入完成");
}
main();