'use strict';
const find = require('find');
const zlib = require('zlib');

const fs = require('fs');
const fse = require('fs-extra');
const find = require('find');

const trace = Editor.log;

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

let gzipPromise = function (filepath) {
    // return Promise.resolve();
    return new Promise((resolve, reject) => {
        const compress = zlib.createGzip();
        let input = fs.createReadStream(filepath);
        let gzjsonfile = filepath + '.gz'
        let output = fs.createWriteStream(gzjsonfile);
        trace('[toGzip]' + filepath + "转 gzip")
        input.pipe(compress).pipe(output)
        output.on('close', () => {
            fse.removeSync(filepath);
            fse.renameSync(gzjsonfile, filepath);
            trace('[toGzip]' + gzjsonfile);
            resolve(gzjsonfile);
        });
        output.on("error", () => {
            fse.removeSync(filepath + '.gz');
            trace('[toGzip]' + "gzip转换失败！ " + filepath);
            resolve('');
        })
    })
}
/**
 * 把目录下符合要求的文本转gzip
 * @param {*} workdir 
 * @param {*} reg  /\.json$/
 */
let jsontoGzip = async (workdir, reg) => {
    let jsonfiles = await findPromise(reg, workdir);
    for (let jsonfile of jsonfiles) {
        await gzipPromise(jsonfile);
    }
}

module.exports = {
    gzips: jsontoGzip,
    gzip: gzipPromise
}