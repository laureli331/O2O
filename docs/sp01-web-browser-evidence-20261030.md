# SP01 React网页候选的浏览器验证

已补齐最小合成入口在真实Chrome中的普通运行检查。[结构化证据](sp01-web-browser-evidence-20261030.json)。这不是正式后台、页面视觉、浏览器范围或性能验收。

## 输入与预期

沿用[已锁定重放的网页编译候选](sp01-web-react-evidence-20261030.md)，用Vite公开preview API仅在127.0.0.1提供静态构建产物。用Playwright独立临时浏览器上下文打开页面，在1280×800、360×800下分别检查：HTTP200、固定文字已由React显示、刷新后同样显示、没有横向溢出、页面运行错误/控制台错误/失败资源响应均为空。页面任何非本机来源请求都会停止并记录，不能默认为通过。

公开能力复用：[Vite preview API](https://vite.dev/guide/api-javascript.html#preview)、[Playwright浏览器启动与页面API](https://playwright.dev/docs/api/class-browsertype#browser-type-launch)。没有自写浏览器驱动或静态服务器。优先尝试官方CLI；它的daemon启动失败，随后复用本机工具缓存中已有的稳定版playwright-core1.64.1，不加进产品依赖、不另下浏览器、不使用用户登录资料。

## 失败与复验

首次CLI0.1.22捆绑的Playwright为1.64.0-alpha-1790635538000，报daemon进程失败、Chrome已关闭。此结果没有页面运行数据，不能记作页面通过，也不能归因于React或Vite。独立Chrome headless about:blank检查成功；稳定版Playwright库的同类空白页启动也成功。对照改变了工具调用路径和版本，不能据此宣称唯一根因已确诊；没有更改页面代码来迎合启动失败。

后续真实页面复验：Chrome156.0.8078.73（此前安装记录156.0.8078.47保留为历史），Node20.19.3，Playwright-core1.64.1。两个宽度及各自刷新均通过，运行错误、控制台错误、失败资源响应、外部请求均为0。固定端口仅监听127.0.0.1，结束后browser.close与preview.close完成，httpServer不再监听。本轮不接云、不访问业务账号、不执行漏洞复现。

## 复现与边界

脚本为tools/sp01-web-react-probe/browser-smoke.cjs，四个参数依次是已构建候选目录、Playwright-core安装目录、Chrome路径和输出JSON。这里的库路径是工具缓存，换机器须先核对实际安装，不能硬写成产品依赖；脚本本身不下载、不安装、不改全局设置。

```powershell
& .local/node-v20.19.3-win-x64/node.exe tools/sp01-web-react-probe/browser-smoke.cjs .local/sp01-web-react-probe .local/npm-tool-cache/_npx/873d7bcc81943761/node_modules/playwright-core 'C:\Program Files\Google\Chrome\Application\chrome.exe' .local/sp01-web-browser-smoke-20261030.json
```

根测试仅验证结果判定不会接受空渲染、刷新丢失、资源失败、运行错误、重复视口或未测窄屏；实际浏览器执行单独记录，不混用。当前没有表单、弹层、导航、业务数据或性能采样，两个宽度也不是正式支持范围。Vite preview仅用于本机检查，不是生产托管方案。失败/成功记录、工具版本和候选源码均保留，本轮提交可以独立回退。
