# 私人「小手机」iOS App

这是私人真实 iOS App 的源码骨架，不是远程网页壳。主界面从安装包内的 `PhoneWeb/小手机.html` 加载共享网页核心；Family Controls、Device Activity、Managed Settings、Keychain 和后台同步由原生 Target/扩展提供。

当前目录不包含伪造的 `.xcodeproj`。Bundle ID、App Group、Apple Team、entitlements 和扩展 Target 必须在拿到 Mac 上的完整工程后按真实值接入。

## 目录

- `App/`：私人 App 入口与根视图。
- `Web/`：只加载安装包内资源的 WKWebView。
- `Bridge/`：版本化 JS ↔︎ Swift 消息契约。
- `Contracts/`：服务端“单设备单控制器”租约契约；接入前不得让两套 App 同时下发命令。
- `Resources/private-phone-web.manifest.json`：从仓库共享核心打包的文件清单。
- `scripts/stage-private-phone-web.mjs`：生成 Xcode 资源目录，不产生第二套业务源码。

## 暂存网页资源

在仓库根目录执行：

```sh
node native/private-small-phone/scripts/stage-private-phone-web.mjs
```

输出到 `native/private-small-phone/Generated/PhoneWeb`。把该目录作为 folder reference 加入私人 App Target 的 Copy Bundle Resources。每次网页核心变更后重新生成；不要直接编辑生成目录。

## 还未授权的工作

- 不修改审核中的公开 North Target。
- 不猜 Bundle ID、App Group 或签名。
- 不从 Windows 上的旧导出文件猜改 MapKit 崩溃点。
