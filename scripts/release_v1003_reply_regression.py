from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def replace(path, old, new, expected=None):
    target = ROOT / path
    text = target.read_text(encoding="utf-8")
    count = text.count(old)
    if expected is not None and count != expected:
        raise RuntimeError(f"{path}: expected {expected} occurrences of {old!r}, found {count}")
    if count:
        target.write_text(text.replace(old, new), encoding="utf-8")
    return count


replace("app.js", "if(window.__NORTH_SHELL_BUILD__!=='1002')", "if(window.__NORTH_SHELL_BUILD__!=='1003')", 1)
replace("app.js", "const APP_VER='v1002 · 聊天入口分工修复';", "const APP_VER='v1003 · 回复链路回归修复';", 1)
replace("app.js", "sw.js?v=1002&r=v1002-chat-entry-separation-1", "sw.js?v=1003&r=v1003-reply-regression-repair-1", 1)

for path in ["小手机.html", "index.html", "repair.html"]:
    replace(path, "1002", "1003")
replace("小手机.html", "chat-entry-separation-1", "reply-regression-repair-1", 2)

replace("sw.js", "const BUILD='1002';", "const BUILD='1003';", 1)
replace("sw.js", "const HOTFIX='v1002-chat-entry-separation-1';", "const HOTFIX='v1003-reply-regression-repair-1';", 1)
replace("sw.js", "const SHELL_CACHE='north-shell-v1002';", "const SHELL_CACHE='north-shell-v1003';", 1)

replace(
    "native/private-small-phone/Resources/PhoneWebBundleInfo.plist",
    "<string>1002</string>",
    "<string>1003</string>",
    1,
)
replace(
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift",
    "1.0.123 (123)",
    "1.0.124 (124)",
    1,
)
replace(
    "native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj",
    "CURRENT_PROJECT_VERSION = 123;",
    "CURRENT_PROJECT_VERSION = 124;",
    12,
)
replace(
    "native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj",
    "MARKETING_VERSION = 1.0.123;",
    "MARKETING_VERSION = 1.0.124;",
    12,
)

for test_path in sorted((ROOT / "tests").glob("*.test.mjs")):
    rel = test_path.relative_to(ROOT)
    text = test_path.read_text(encoding="utf-8")
    original = text
    text = text.replace("v1002 · 聊天入口分工修复", "v1003 · 回复链路回归修复")
    text = text.replace("v1002-chat-entry-separation-1", "v1003-reply-regression-repair-1")
    text = text.replace("north-shell-v1002", "north-shell-v1003")
    text = text.replace("v1002", "v1003")
    text = text.replace("1002", "1003")
    text = text.replace("1\\.0\\.123", "1\\.0\\.124")
    text = text.replace("1.0.123", "1.0.124")
    text = text.replace("CURRENT_PROJECT_VERSION = 123", "CURRENT_PROJECT_VERSION = 124")
    text = text.replace("\\(123\\)", "\\(124\\)")
    if text != original:
        test_path.write_text(text, encoding="utf-8")

print("Updated web v1003 and private iOS 1.0.124 (124) release identities")
