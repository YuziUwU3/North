# 私人「小手机」iOS App

这是私人真实 iOS App 工程，不是远程网页壳。`XcodeProject` 已从用户 2026-08-11 提供的真实 Mac 工程导入，保留主 App、Report、Monitor、Shield 和通知扩展。主界面从安装包内的 `PhoneWeb.bundle/index.html` 加载共享网页核心（由 `小手机.html` 自动生成，不维护第二份业务源码）；Family Controls、Device Activity、Managed Settings、Keychain 和后台同步仍由原生 Target/扩展提供。

私人副本沿用真实工程已经签名可用的 Bundle ID、App Group、Apple Team 和扩展 ID，仅把显示名称改为「小手机」。它会替换本人设备上同 Bundle ID 的 North/伴生开发包，因此两者无法同时安装和控制；公开审核包的工程与提交不在这里修改。

当前私人安装版本为 1.0.19 (19)，内置共享网页核心为 v894。1.0.19 在同一 App 本机直连上保留独立 `readSessionId`、逐字段/逐 App 进度、原生与健康超时、心电概要、真实数值一致性守卫和明确手动解锁事件，并补齐角色主动提到电量、屏幕、App 用量、健康或位置时的真实读取触发；没有本次读取凭证时，“没刷新”等猜测会被拦截。普通网页查岗仍走微信、朋友圈、抖音等经典逐项横幅，不会被外置读取分支截走。统一 App 会在手机号账号认证后直接登记自己的设备身份和 APNs 令牌，角色资料页可核验 token、profile、cron 和下一次检查。本机命令仍必须收到 `stage = executed` 才能说成功。共同生活全天主动联系仍要求每次会话后随机安静 30–60 分钟；间隔 1 分钟只在该静默结束后生效。界面仍只显示手机号；密码不保存，令牌只存 Keychain。Mac 编译、迁移 003/004、Edge/APNs 部署及真机验收仍未完成。

当前私人安装版本为 1.0.20 (20)，内置共享网页核心为 v895。电量继续直接读 `UIDevice`，位置继续读 CoreLocation；HealthKit 在角色明确读取时会真正启用。屏幕总时长和逐 App 数据在中国等无法取得 `approvedWithDataAccess` 的地区，改由工程内既有 `DeviceActivityReport` 扩展按本次请求编号回传，不再只尝试欧盟限定的直接 API。读取全部会逐项列出电量、总屏幕、逐 App、步数、睡眠、心率、心电、HRV 和位置，未读到的项目必须说明真实原因。Supabase 迁移 003–006 与 `phone-role-push` 已部署，统一控制器同时兼容旧 `p_apns_env` 和新 `p_apns_environment` 参数。彻底清空会等待本地大聊天归档、共同生活上下文和服务端主动联系记忆全部清除。Windows 自动测试已通过；Mac 编译、签名和真机全链路验收仍未完成。

手机号功能启用前，不需要打开 Phone Provider，也不需要 Twilio 或短信服务。只需执行 `supabase/migrations/202608110001_private_phone_accounts.sql`，再在 Supabase Authentication 中手动建立一名已确认的私人用户：内部邮箱格式为 `smallphone.86手机号@example.com`，例如手机号 `13812345678` 对应 `smallphone.8613812345678@example.com`。App 登录页仍输入原手机号和该用户的密码。

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
