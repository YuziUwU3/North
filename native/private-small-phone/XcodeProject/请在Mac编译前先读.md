# 私人「小手机」Xcode 工程

此目录来自 2026-08-11 用户提供的真实 `AppleProjects/PhoneCompanionTest` 工程副本。它保留主 App、Device Activity Report、Monitor、Shield 和通知服务五个 Target，并把主 App 显示名称改为「小手机」。

## 重要边界

- 当前审核中的公开 North 工程和已提交版本没有被修改。
- 私人副本沿用真实工程已经获权的 Team、Bundle ID、App Group 和 entitlements，因此安装到本人设备时会替换同 Bundle ID 的旧 North/伴生开发包，二者不能同时安装或控制。
- `PhoneWeb.bundle` 是从仓库共享网页核心生成的安装包资源，不是第二套业务源码。
- Windows 不能编译此工程。必须在 Mac 用当前 Xcode 编译全部五个 Target 并做真机测试。

## 本轮已合入

- 完整小手机网页作为本地资源运行，不以远程网页作为首页。
- 原生设备管理仍可通过右上角 iPhone 按钮打开。
- v881 永久锁定账本、当日快照字段、前台授权复检和真实状态措辞。
- 真实 8 秒使用量读取超时；超时后不等待卡住的读取，并禁止晚到结果覆盖新快照。
- scene 进入 inactive 时卸载 SwiftUI Map，避免后台切换时 VectorKit 主线程看门狗；定位记录不随地图卸载而停止。

## 尚未完成

- Mac 编译和签名验证。
- 安装前的数据迁移与恢复入口。
- 真机锁定、解锁、使用时间、前后台 20 次、断网、跨日和长时间稳定性测试。
- 服务端控制器租约正式部署。
