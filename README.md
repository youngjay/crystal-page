#crystal-page
一个根据文件目录加载组件的路由

#new
``` js
var page = new Page(options);
```

options 可选
options.container 页面的容器，默认document.body
options.moduleRootPath 加载文件的根路径，默认modue

#activate(path, fn) :  module Object 激活某个路径, 返回激活的module
path String 当前激活的路径


