from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def write_lf(target, text):
    with target.open("w", encoding="utf-8", newline="\n") as stream:
        stream.write(text)


def replace(path, old, new, expected=None):
    target = ROOT / path
    text = target.read_text(encoding="utf-8")
    count = text.count(old)
    if expected is not None and count != expected:
        raise RuntimeError(f"{path}: expected {expected} occurrences of {old!r}, found {count}")
    if count:
        write_lf(target, text.replace(old, new))
    return count


replace("app.js", "if(window.__NORTH_SHELL_BUILD__!=='1006')", "if(window.__NORTH_SHELL_BUILD__!=='1007')", 1)
replace("app.js", "const APP_VER='v1006 · 通话、朋友圈与后台消息修复';", "const APP_VER='v1007 · 后台收件、朋友圈上下文与内心格式修复';", 1)
replace("app.js", "sw.js?v=1006&r=v1006-call-moments-background-repair-1", "sw.js?v=1007&r=v1007-background-inbox-moments-inner-1", 1)

for path in ["小手机.html", "index.html", "repair.html"]:
    replace(path, "1006", "1007")
replace("小手机.html", "call-moments-background-repair-1", "background-inbox-moments-inner-1", 2)

replace("sw.js", "const BUILD='1006';", "const BUILD='1007';", 1)
replace("sw.js", "const HOTFIX='v1006-call-moments-background-repair-1';", "const HOTFIX='v1007-background-inbox-moments-inner-1';", 1)
replace("sw.js", "const SHELL_CACHE='north-shell-v1006';", "const SHELL_CACHE='north-shell-v1007';", 1)

replace(
    "native/private-small-phone/Resources/PhoneWebBundleInfo.plist",
    "<string>1006</string>",
    "<string>1007</string>",
    1,
)
replace(
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift",
    "1.0.127 (127)",
    "1.0.128 (128)",
    1,
)
replace(
    "native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj",
    "CURRENT_PROJECT_VERSION = 127;",
    "CURRENT_PROJECT_VERSION = 128;",
    12,
)
replace(
    "native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj",
    "MARKETING_VERSION = 1.0.127;",
    "MARKETING_VERSION = 1.0.128;",
    12,
)

for test_path in sorted((ROOT / "tests").glob("*.test.mjs")):
    text = test_path.read_text(encoding="utf-8")
    original = text
    text = text.replace("v1006 · 通话、朋友圈与后台消息修复", "v1007 · 后台收件、朋友圈上下文与内心格式修复")
    text = text.replace("v1006-call-moments-background-repair-1", "v1007-background-inbox-moments-inner-1")
    text = text.replace("call-moments-background-repair-1", "background-inbox-moments-inner-1")
    text = text.replace("north-shell-v1006", "north-shell-v1007")
    text = text.replace("v1006", "v1007")
    text = text.replace("1006", "1007")
    text = text.replace("1\\.0\\.127", "1\\.0\\.128")
    text = text.replace("1.0.127", "1.0.128")
    text = text.replace("CURRENT_PROJECT_VERSION = 127", "CURRENT_PROJECT_VERSION = 128")
    text = text.replace("\\(127\\)", "\\(128\\)")
    if text != original:
        write_lf(test_path, text)

print("Updated web v1007 and private iOS 1.0.128 (128) release identities")
