
## playableAdsTool

支持将cocos creator生成的 web-mobile项目打包合并成一个独立的html文件。

亲测支持2.3.x和2.4.x（支持AssetsBundle机制）， 2.3.0之前版本应该支持，但本人并未测试，如有问题可以去修改newloader2.3.x.js。

creator 打包选择web-mobile，至于其他设置选项是否勾选都无所谓，按项目要求设置，建议在项目设置里面去掉不需要的引擎模块以减小包体。

请确保creator构建后你的项目能正常运行，然后再执行后面的步骤

使用方法

```
// 命令行
npm i 

node pack.js ${build-dir}
// build-dir 一般情况下就是index.html所在根目录，比如./build/web-mobile，我建议填写完整路径，windows请注意路径格式

```

只有以下格式文件会被转码添加到html

```
// 以下格式转成base64添加到html，如需扩展，你可能要修改pack.js和newloader.xxx.js，然后再次构建

['.png', '.jpg', '.jpeg', '.bmp', '.gif', '.webp', '.mp3', '.wav', '.ogg', '.w4a', 'binary', ".bin", ".dbbin", ".skel"];

// 以下文本文件格式
[".tsx", ".tmx", ".fnt", ".plist", ".txt", ".atlas", ".json", ".xml", ".ExportJson"];

```

> 构建会使用工具自带的 style-mobile.css 并合并到html中，你可以在构建之前按自己的需求修改style-mobile.css。

注意：本工具不会修改任何cocos creator构建出来的文件。

构建完成后，会在工具所在目录上层生成一个index.xxxxxx.html的一个文件，双击即可打开浏览器预览效果。

使用如果有任何问题，欢迎提交 issues 反馈。
> 
其中关于base64解码二进制方法参考 `@fkworld` [cocos-to-playable-ad](https://github.com/fkworld/cocos-to-playable-ad) 
特此注明感谢！