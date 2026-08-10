# 私人「小手机」iOS App

这是私人真实 iOS App 工程，不是远程网页壳。`XcodeProject` 已从用户 2026-08-11 提供的真实 Mac 工程导入，保留主 App、Report、Monitor、Shield 和通知扩展。主界面从安装包内的 `PhoneWeb.bundle/index.html` 加载共享网页核心（由 `小手机.html` 自动生成，不维护第二份业务源码）；Family Controls、Device Activity、Managed Settings、Keychain 和后台同步仍由原生 Target/扩展提供。

私人副本沿用真实工程已经签名可用的 Bundle ID、App Group、Apple Team 和扩展 ID，仅把显示名称改为「小手机」。它会替换本人设备上同 Bundle ID 的 North/伴生开发包，因此两者无法同时安装和控制；公开审核包的工程与提交不在这里修改。

## 目录

- `XcodeProject/`：可在 Mac Xcode 打开的真实五 Target 工程。
- `XcodeProject/PhoneCompanionTest/`：私人入口、本地 WKWebView、原生桥和伴生能力。
- `Contracts/`：服务端“单设备单控制器”租约契约；接入前不得让两套 App 同时下发命令。
- `Resources/private-phone-web.manifest.json`：从仓库共享核心打包的文件清单。
- `scripts/stage-private-phone-web.mjs`：生成 Xcode 资源目录，不产生第二套业务源码。

## 暂存网页资源

在仓库根目录执行：

```sh
node native/private-small-phone/scripts/stage-private-phone-web.mjs native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle
```

输出 `PhoneWeb.bundle`。Xcode 的同步目录会把它作为资源包加入私人主 Target。每次网页核心变更后重新生成；不要直接编辑生成目录。

工程内已提交共享 `PhoneCompanionTest` Scheme。Mac 解压并打开 `.xcodeproj` 后应直接选择真实 iPhone 运行主 App，不再手动创建 Scheme，也不要误选 Report、Monitor、Shield 或通知扩展运行。

## 当前证据边界

- 审核中的公开 North 源码与提交没有修改；这里只维护私人副本。
- 已从真实工程确认 Team、Bundle ID、App Group 和五个 Target，不再使用猜测值。
- MapKit 看门狗日志命中真实 `ContentView.swift` 的常驻 `Map`；私人副本在 scene 进入 inactive 时移除地图，保留独立的定位记录。
- Windows 无法执行 Xcode/Swift 编译，最终仍须在 Mac 编译全部 Target 并真机回归。
