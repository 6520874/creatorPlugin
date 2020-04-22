const fs = require('fs');
const path = require("path");

const createVUE = function (element) {
  return new Vue({
    el: element,
    data:
    {
      projectPath: "",
      audioInfo: {
        workDir: ""
      },
      imgInfo: {
        workDir: "",
        jpgQuality: 80,
        pngQuality: 80,
        minFileLimt: 10,
        override: true,
        checkConvertSize: false,
      }
    },

    created: function () {
      let projectPath = "";
      try {
        projectPath = Editor.Project.path;
      } catch (e) {
        projectPath = Editor.projectInfo.path;
      }
      this.projectPath = projectPath;
      let configPath = path.join(projectPath, "temp", "convertHelper.json");
      if (fs.existsSync(configPath)) {
        let sss = fs.readFileSync(configPath, 'utf8')
        let obj = JSON.parse(sss);
        this.audioInfo = obj.audioInfo;
        this.imgInfo = obj.imgInfo;
      }
    },

    methods: {
      _saveConfig: function () {
        let configPath = path.join(this.projectPath, "temp", "convertHelper.json");
        fs.writeFileSync(configPath, JSON.stringify({
          audioInfo: this.audioInfo,
          imgInfo: this.imgInfo
        }, null, 2), "utf8");
      },
      audioSelectDir: function () {
        let result = Editor.Dialog.openFile({
          defaultPath: this.projectPath,
          properties: ['openDirectory']
        })
        // 取消选择操作
        if (!result || !result[0])
          return;
        this.audioInfo.workDir = result[0];
        this._saveConfig();
      },

      imgSelectDir: function () {
        let result = Editor.Dialog.openFile({
          defaultPath: this.projectPath,
          properties: ['openDirectory']
        })
        // 取消选择操作
        if (!result || !result[0])
          return;
        this.imgInfo.workDir = result[0];
        this._saveConfig();
      },

      mp3CompressHandler: function () {
        if (!this.audioInfo.workDir) {
          return;
        }
        Editor.Ipc.sendToMain('converthelper:audioHandler', JSON.stringify(this.audioInfo));
      },
      imgCompressHandler: function () {
        if (!this.imgInfo.workDir) {
          return;
        }
        this._saveConfig();
        Editor.Ipc.sendToMain('converthelper:imgHandler', JSON.stringify(this.imgInfo));
      }
    }
  });
};

var view = {

  // html template for panel
  template: fs.readFileSync(Editor.url('packages://ConvertHelper/panel/index.html', 'utf8')),

  // css style for panel
  style: fs.readFileSync(Editor.url('packages://ConvertHelper/panel/index.css', 'utf8')),

  // element and variable binding
  $: {
    "mainDiv": "#mainDiv"
  },

  // method executed when template and styles are successfully loaded and initialized
  ready() {
    this.vue = createVUE(this["$mainDiv"]);
    Editor.log("ConvertHelper view ready");
  }
};
// panel/index.js, this filename needs to match the one registered in package.json
Editor.Panel.extend(view);
