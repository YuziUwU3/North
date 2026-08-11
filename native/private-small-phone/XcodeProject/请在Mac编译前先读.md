# 私人「小手机」Xcode 工程

此目录来自 2026-08-11 用户提供的真实 `AppleProjects/PhoneCompanionTest` 工程副本。它保留主 App、Device Activity Report、Monitor、Shield 和通知服务五个 Target，并把主 App 显示名称改为「小手机」。

## v895／1.0.20：请从全新目录打开

- 本工程应位于压缩包的 `SmallPhone_v895_FullReadMemoryPushFix` 全新目录中。不要把该目录覆盖或拖进旧 `XcodeProject`，否则 Xcode 可能继续编译旧网页核心或旧 Swift 文件。
- `registerPushTokenIfAvailable` 已是同 Target 内可访问；`ContentView` 已补齐 `approvedWithDataAccess`；通知扩展已显式链接 `Intents` 和 `UserNotifications`。
- 首次打开后执行 `Product → Clean Build Folder`，再选择 `PhoneCompanionTest` Scheme 和真机运行。如果仍有 `Command Ld failed`，必须展开并保留下一层具体链接器正文。

## 重要边界

- 当前审核中的公开 North 工程和已提交版本没有被修改。
- 私人副本沿用真实工程已经获权的 Team、Bundle ID、App Group 和 entitlements，因此安装到本人设备时会替换同 Bundle ID 的旧 North/伴生开发包，二者不能同时安装或控制。
- `PhoneWeb.bundle` 是从仓库共享网页核心生成的安装包资源，不是第二套业务源码。
- Windows 不能编译此工程。必须在 Mac 用当前 Xcode 编译全部五个 Target 并做真机测试。

## 本轮已合入

- 完整小手机网页作为本地资源运行，不以远程网页作为首页。
- 私人版本为 1.0.20 (20)；共享网页核心为 v895。当前审核中的公开 North App 工程仍未改动。
- 私人 App 已增加“手机号 + 密码”登录、Keychain 登录态以及按账号隔离的云备份／恢复；首次登录不会静默覆盖本机数据。中国大陆私人号码不再依赖短信验证码：不要启用 Phone Provider，也不需要配置 Twilio。编译前只需执行 `supabase/migrations/202608110001_private_phone_accounts.sql`，并在 Authentication 中手动建立已确认用户；邮箱按 `smallphone.86手机号@example.com` 生成，App 界面仍输入原手机号和密码。
- 原生设备管理只在「设置」页右上角打开，不再覆盖所有内置页面。
- 话筒转字幕走 iOS Speech/AVAudioEngine 原生桥；连续识别停顿 1.15 秒后会提交为最终用户发言，写入通话记录并触发角色回复。首次使用必须允许麦克风和语音识别权限。
- 通话与音乐聊天输入栏使用 WKWebView/iOS 自己的键盘避让；已移除原生键盘 frame、visualViewport 和网页固定偏移的重复补偿。
- 网页端苹果主屏幕适配保留稳定的 100% 外壳，并为可能返回 0 的安全区提供顶部 47px、底部 34px 兜底；不会套用到私人原生 App。
- 私人通知扩展会移除共享推送的固定假角标，App 启动和回前台也会清理旧红点。
- v881 已建立永久锁定账本、当日快照字段、前台授权复检和真实状态措辞；v894 继续保留这些逻辑。1.0.17 建立本机 `device.snapshot` 与 `device.command` 直连；1.0.18 新增 `readSessionId`、逐项真实读取、读取超时、ECG 摘要、明确手动解锁事件和统一 App 的 APNs 自登记；1.0.19 补齐角色对屏幕、App、步数、睡眠、心率、心电、HRV、电量和位置的查看触发，并在没有本次读取编号时拦截“没刷新/手表没戴”等假读取。手动一键读取也显示同一套逐项进度。Mac 编译前必须应用迁移 003/004并部署 phone-role-push；共同生活仍在会话停止后随机静默 30–60 分钟，间隔 1 分钟不能覆盖该硬静默。

## v895／1.0.20：第二十次安装补充

- 请只从新交付目录 `SmallPhone_v895_FullReadMemoryPushFix` 打开工程，不要覆盖回旧工程后继续编译。
- 1.0.20 在明确健康读取时真正打开 HealthKit 同步；屏幕时间在普通 `.approved` 授权下会挂载 `DeviceActivityReport`，由 Report 扩展经 App Group 回传本次总时长和逐 App 数据。`.approvedWithDataAccess` 仍走 iOS 26 直接接口。
- 电量和位置原本可读是正常的独立链路现象，不代表 HealthKit 或 Screen Time 已接通。验收必须逐项查看电量、总屏幕、逐 App、步数、睡眠、心率、心电、HRV 和位置。
- Supabase 迁移 003、004、005、006 与 `phone-role-push` 已在关联项目部署；005 专门兼容旧版 `p_apns_env` 参数，006 用于彻底清空服务端主动联系记忆。
- Windows 只能做静态和自动化核验；仍须在 Mac 编译五个 Target，并在真实 iPhone 上验证 Report 回传、HealthKit 授权、后台／强退通知、头像和主动来电。
- 真实 8 秒使用量读取超时；超时后不等待卡住的读取，并禁止晚到结果覆盖新快照。
- scene 进入 inactive 时卸载 SwiftUI Map，避免后台切换时 VectorKit 主线程看门狗；定位记录不随地图卸载而停止。

## 尚未完成

- Mac 编译和签名验证。
- 安装前的数据迁移与恢复入口。
- 手机号账号仍需在 Supabase 创建首名私人用户；完整大容量原生媒体存储仍未完成。
- 真机锁定、解锁、使用时间、前后台 20 次、断网、跨日和长时间稳定性测试。
- 远端迁移 003–006 与 `phone-role-push` 已部署；APNs 凭据、设备令牌和真实后台送达仍需真机核验。
