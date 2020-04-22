const fs = require('fs');
const path = require("path");

const createVUE = function (element) {
  return new Vue({
    el: element,
    data:
    {
      projectPath: "",
      isOpenSubpackage: true,
      subpackagePaths: ""
    },

    created: function () {
      let projectPath = "";
      try {
        projectPath = Editor.Project.path;
      } catch (e) {
        projectPath = Editor.projectInfo.path;
      }
      this.projectPath = projectPath;
      let subpackageConfigPath = path.join(projectPath, "temp", "easySubpackage.json");
      if (fs.existsSync(subpackageConfigPath)) {
        let sss = fs.readFileSync(subpackageConfigPath, 'utf8')
        let obj = JSON.parse(sss);
        this.isOpenSubpackage = !!obj.isOpenSubpackage;
        this.subpackagePaths = obj.subpackagePaths || "";
      }
    },

    methods: {
      saveConfig: function () {
        let subpackageConfigPath = path.join(this.projectPath, "temp", "easySubpackage.json");
        let sss = JSON.stringify({
          isOpenSubpackage: this.isOpenSubpackage,
          subpackagePaths: this.subpackagePaths
        });
        fs.writeFileSync(subpackageConfigPath, sss, "utf8");
        // trace("保存 config.json");
        // let content = JSON.stringify( this.hotUpdateJsonConfigData ,null,4);
        // fs.writeFileSync( this.configJsonFilePath ,content, "utf8");
      }
    }
  });
};

var view = {

  // html template for panel
  template: fs.readFileSync(Editor.url('packages://easySubpackage/panel/index.html', 'utf8')),

  // css style for panel
  style: fs.readFileSync(Editor.url('packages://easySubpackage/panel/index.css', 'utf8')),

  // element and variable binding
  $: {
    "mainDiv": "#mainDiv"
  },

  // method executed when template and styles are successfully loaded and initialized
  ready() {
    this.vue = createVUE(this["$mainDiv"]);
    Editor.log("easySubpackage view ready");
  }
};
// panel/index.js, this filename needs to match the one registered in package.json
Editor.Panel.extend(view);
