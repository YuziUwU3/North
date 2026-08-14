import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const css=fs.readFileSync(path.join(root,'glass-theme.css'),'utf8');
const iconKeys=fs.readdirSync(path.join(root,'assets','app-icons','glass','black')).filter(x=>x.endsWith('.webp')).map(x=>x.slice(0,-5));

test('transparent black glass is the default while line icons remain selectable',()=>{
  assert.match(app,/uiMaterial:'glass',appIconPack:'black'/);
  assert.match(app,/function normalizeLoadedState\(\).*S\.me\.uiMaterial='glass'/);
  assert.match(app,/GLASS_ICON_PACKS=\{blue:'蓝白',pink:'粉白',gray:'灰白',black:'纯黑'\}/);
  assert.match(app,/const custom=S\.me\.appIcons&&S\.me\.appIcons\[key\],packed=custom\?'':appIconPackAsset\(key\)/);
});

test('all four generated packs contain one asset for each of the 24 apps',()=>{
  for(const pack of ['blue','pink','gray','black']){
    const files=fs.readdirSync(path.join(root,'assets','app-icons','glass',pack)).filter(x=>x.endsWith('.webp'));
    assert.equal(files.length,24,pack);
  }
});

test('pink pack keeps its original artwork while sharing the fixed desktop grid',()=>{
  assert.ok(fs.existsSync(path.join(root,'assets','app-icons','glass','boards','pink-white.png')));
  for(const key of iconKeys){
    const black=fs.readFileSync(path.join(root,'assets','app-icons','glass','black',key+'.webp'));
    const pink=fs.readFileSync(path.join(root,'assets','app-icons','glass','pink',key+'.webp'));
    assert.ok(black.length>300&&pink.length>300,key);
    assert.notDeepEqual(pink,black,`${key} must retain the approved pink artwork instead of copying black`);
  }
  assert.match(app,/function previewHomePage\(page\)/);
  assert.match(app,/mode\.includes\('apps2'\)\?1:0/);
});

test('glass icon assets remain fully visible and centered in a larger app container',async()=>{
  for(const key of iconKeys){
    const file=path.join(root,'assets','app-icons','glass','black',key+'.webp');
    assert.ok(fs.statSync(file).size>300,`${key} should contain a real lossless icon asset`);
  }
  assert.match(css,/glass-pack-icon\{[^}]*overflow:hidden!important/);
  assert.match(css,/glass-pack-icon>img\{[^}]*width:100%[^}]*object-fit:contain[^}]*object-position:50% 50%/);
  assert.match(css,/\.home \.app \.ic\{width:64px;height:64px/);
});

test('real preview loads the formal app and never saves preview state',()=>{
  const preview=fs.readFileSync(path.join(root,'theme-real-preview.html'),'utf8');
  assert.match(preview,/小手机\.html\?northPreview=/);
  assert.doesNotMatch(preview,/黑色软件图标[^<]*<img/);
  assert.match(app,/function save\(delay\)\{if\(NORTH_PREVIEW\)return true/);
  assert.match(app,/if\(NORTH_PREVIEW\)\{previewRoute\(\);return;\}/);
});

test('preview navigation is isolated from the production service worker shell',()=>{
  const preview=fs.readFileSync(path.join(root,'theme-real-preview.html'),'utf8');
  const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
  assert.match(preview,/previewBuild=20260814f/);
  assert.match(preview,/navigator\.serviceWorker\.getRegistrations\(\)/);
  assert.match(preview,/key\.startsWith\('north-shell-'\)/);
  assert.match(app,/if\(NORTH_PREVIEW\|\|!\('serviceWorker'in navigator\)/);
  assert.match(sw,/theme-real-preview\\\.html/);
  assert.match(sw,/url\.searchParams\.has\('northPreview'\)/);
  assert.match(sw,/fetch\(request,\{cache:'no-store'\}\)/);
});

test('reference widgets use live storage and native-first telemetry without replacing drag layout',()=>{
  assert.match(app,/function dashboardStorage\(\).*storageInfo\(\)/);
  assert.match(app,/function dashboardRealBattery\(\)/);
  assert.match(app,/function dashboardPickPhoto\(\)/);
  assert.match(app,/WIDR=\{[^}]*dashboard:wDashboard,vinyl:wVinyl,sweetie:wSweetie/);
  assert.match(app,/data-token="w:\$\{k\}" onpointerdown="appDown/);
  assert.match(css,/\.home-widget-dashboard\{grid-column:1\/-1/);
  assert.match(css,/\.home-widget-vinyl\{grid-column:span 2/);
});

test('music player stays silver while every home vinyl keeps its theme texture',()=>{
  for(const pack of ['black','pink','blue','gray']){
    assert.match(css,new RegExp(`north-pack-${pack} \\.home-vinyl-card \\.vinyl-record\\{background:repeating-radial-gradient`));
  }
  assert.match(css,/\.home-vinyl-card \.vinyl-record\.wdisc,html\.north-glass-ui \.music-vinyl\{animation-duration:24s!important\}/);
  assert.doesNotMatch(css,/north-pack-(?:black|pink|blue|gray) \.music-vinyl-wrap/);
  assert.doesNotMatch(css,/north-pack-(?:black|pink|blue|gray) \.music-vinyl-cover/);
});

test('glass home keeps only the dashboard clock',()=>{
  assert.match(app,/function homeClockColorSet\(value\)/);
  assert.match(app,/主屏时间颜色/);
  assert.match(css,/html\.north-glass-ui \.home-premium-head\{display:none!important/);
  assert.match(css,/\.dash-time b\{[^}]*font-size:24px/);
});

test('glass home keeps the lock-screen pull arrow visible and reserves its top space',()=>{
  assert.match(app,/function renderLockPull\(\)/);
  assert.match(app,/function lockShow\(drop\)/);
  assert.match(css,/html\.north-glass-ui \.lockpull\.show\{display:flex!important\}/);
  assert.doesNotMatch(css,/html\.north-glass-ui \.lockpull\.show\{display:none/);
  assert.match(css,/html\.north-glass-ui \.home-scroll\{overflow-y:auto;padding-top:38px;box-sizing:border-box\}/);
  assert.match(css,/html\.north-glass-ui \.lockpull\{top:7px\}/);
});

test('final reference widgets keep the photo square and the vinyl controls removed',()=>{
  assert.match(css,/\.home-dashboard-photo\{width:128px;height:128px/);
  assert.match(css,/\.home-dashboard-photo img\{[^}]*inset:0!important[^}]*object-fit:cover/);
  assert.match(css,/\.vinyl-record\{[^}]*repeating-radial-gradient[^}]*radial-gradient/);
  assert.doesNotMatch(app,/class="vinyl-control"/);
  assert.doesNotMatch(app,/class="vinyl-switch"/);
  assert.match(css,/\.home \.dock\{display:grid!important;width:min\(348px,calc\(100vw - 32px\)\)/);
});

test('reference vinyl and right app column scale on narrow Android viewports without changing the 390px layout',()=>{
  assert.match(css,/glass-place-vinyl\{left:calc\(50% - 5px\)!important[^}]*width:calc\(50% - 21px\)!important/);
  assert.match(css,/glass-place-sweetie\{[^}]*width:calc\(50% - 21px\)!important/);
  assert.match(css,/glass-place-app-f\{left:calc\(75% - \.5px\)!important[^}]*width:calc\(25% - 27px\)!important/);
});

test('storage gauge shrinks as one complete circle while its glass tile stays fixed',()=>{
  assert.match(css,/\.dash-storage i\{[^}]*width:40px;height:40px[^}]*border-radius:50%/);
  assert.match(css,/\.dash-storage i:after\{[^}]*inset:6px[^}]*border-radius:50%/);
  assert.match(css,/\.dash-storage em\{[^}]*font-size:7px/);
  assert.match(css,/\.home-dashboard-grid\{[^}]*grid-template-columns:\.72fr 1fr 1fr/);
});

test('only non-black storage rings use the softened theme remainder',()=>{
  assert.match(css,/north-pack-pink \.dash-storage i\{background:conic-gradient\(rgba\(255,255,255,\.92\)[^}]*rgba\(255,190,216,\.34\)/);
  assert.match(css,/north-pack-blue \.dash-storage i\{background:conic-gradient\(rgba\(255,255,255,\.92\)[^}]*rgba\(185,215,255,\.34\)/);
  assert.match(css,/north-pack-gray \.dash-storage i\{background:conic-gradient\(rgba\(255,255,255,\.94\)[^}]*rgba\(215,216,222,\.38\)/);
  assert.match(css,/\.dash-storage i\{[^}]*conic-gradient\(#f3f3f3 var\(--dash-store\),#555 0\)/);
});

test('private bundle stages exactly four split glass packs without preview boards',()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'native','private-small-phone','Resources','private-phone-web.manifest.json'),'utf8'));
  const glassDirs=manifest.directories.filter(x=>x.startsWith('assets/app-icons/glass/'));
  assert.deepEqual(glassDirs.sort(),['assets/app-icons/glass/black','assets/app-icons/glass/blue','assets/app-icons/glass/gray','assets/app-icons/glass/pink']);
  assert.ok(manifest.files.includes('glass-theme.css'));
  assert.ok(!manifest.directories.includes('assets'));
  assert.ok(!manifest.directories.some(x=>x.includes('boards')));
  assert.ok(!manifest.files.some(x=>/preview/i.test(x)));
});

test('dashboard date stays fully inside the shared time tile',()=>{
  assert.match(css,/\.dash-time\{[^}]*display:flex[^}]*padding:1px 0 2px/);
  assert.match(css,/\.dash-time b\{[^}]*line-height:\.94/);
  assert.match(css,/\.dash-time small\{[^}]*margin-top:2px[^}]*line-height:1[^}]*white-space:nowrap/);
});

test('dashboard inner tiles and photo are vertically centered at the same height',()=>{
  assert.match(css,/\.home-dashboard-grid\{[^}]*height:128px;align-self:center/);
  assert.match(css,/\.home-dashboard-photo\{[^}]*width:128px;height:128px;align-self:center/);
});

test('vinyl record is vertically centered in its square widget',()=>{
  assert.match(css,/\.vinyl-record\{[^}]*left:15px;right:15px;top:15px/);
  assert.match(css,/\.vinyl-arm\{[^}]*top:14px/);
});

test('home vinyl is a real play pause control and follows live audio state',()=>{
  assert.match(app,/home-vinyl-card \.vinyl-record/);
  assert.match(app,/classList\.toggle\('wdisc',_mPlaying\)/);
  assert.match(app,/aria-label="\$\{s&&_mPlaying\?'暂停音乐':s\?'播放音乐':'选择音乐'\}"/);
  assert.match(app,/event\.stopPropagation\(\);musicToggle\(\)/);
  assert.match(app,/onkeydown="if\(event\.key==='Enter'\|\|event\.key===' '/);
});

test('glass home deletes legacy widgets and keeps only the three approved live widgets',()=>{
  assert.match(app,/allowed=\['dashboard','vinyl','sweetie'\]/);
  assert.match(app,/const WIDS=\[\['dashboard'/);
  assert.doesNotMatch(app,/const WIDS=\[\['clock'/);
  assert.match(app,/function dashboardWeatherIcon\(desc\)/);
  assert.match(app,/dash-device dash-weather/);
  assert.match(app,/fetchWeather\(true\)/);
  assert.match(app,/旧组件已经移除，只保留以下三个组件/);
  assert.match(app,/function dashboardWeatherLabel\(desc\)/);
  for(const label of ['晴天','雨天','雷雨','雪天','多云','阴天','雾天'])assert.match(app,new RegExp(label));
});

test('every theme keeps its own very pale transparent glass tint',()=>{
  assert.match(css,/north-pack-pink \.home:not\(\.tpink\):not\(\.twhite\).*rgba\(255,219,233,\.18\)/);
  assert.match(css,/north-pack-blue \.home:not\(\.tpink\):not\(\.twhite\).*rgba\(217,236,255,\.18\)/);
  assert.match(css,/north-pack-gray \.home:not\(\.tpink\):not\(\.twhite\).*rgba\(255,255,255,\.2\)/);
  assert.match(css,/north-pack-black \.home-dashboard-card.*rgba\(34,35,40,\.18\)/);
  assert.match(app,/function glassWidgetDefaultOpacity\(\)\{return appIconPack\(\)==='black'\?18:14;\}/);
});

test('dashboard inner tiles stay translucent without stacking expensive blur layers',()=>{
  const inner=css.match(/\.home-dashboard-grid>div,\.home-dashboard-photo\{[^}]*\}/)?.[0]||'';
  assert.match(inner,/rgba\(70,71,76,\.18\)/);
  assert.doesNotMatch(inner,/backdrop-filter/);
  assert.match(css,/north-pack-pink \.home-dashboard-grid>div[^\{]*\{[^}]*rgba\(255,232,241,\.22\)/);
  assert.match(css,/north-pack-blue \.home-dashboard-grid>div[^\{]*\{[^}]*rgba\(232,243,255,\.22\)/);
  assert.match(css,/north-pack-gray \.home-dashboard-grid>div[^\{]*\{[^}]*rgba\(255,255,255,\.24\)/);
});

test('component glass tint and opacity are user-adjustable without changing layout',()=>{
  assert.match(app,/function glassWidgetAppearanceSet\(key,value\)/);
  assert.match(app,/function glassWidgetAppearanceReset\(\)/);
  assert.match(app,/组件玻璃色调/);
  assert.match(app,/组件透明度/);
  assert.match(css,/\.home\.glass-widget-custom .*--ng-widget-rgb/);
});

test('dashboard photo is a direct isolated upload target and sweetie text is readable',()=>{
  assert.match(app,/home-dashboard-photo" role="button" tabindex="0" onclick="event\.stopPropagation\(\);dashboardPickPhotoHome\(\)"/);
  assert.match(app,/function dashboardPickPhotoHome\(\)/);
  assert.match(css,/\.home-sweetie-card p\{[^}]*font-size:12px/);
  assert.match(app,/function sweetiePickAvatar\(which\)/);
  assert.match(app,/onpointerdown="event\.stopPropagation\(\)" onclick="event\.stopPropagation\(\);sweetiePickAvatar/);
  assert.match(css,/\.sweetie-avatar-picker\{width:60px;height:60px/);
  assert.match(css,/\.home-vinyl-card \.vinyl-cover\{inset:20%!important;width:60%!important;height:60%!important\}/);
  assert.doesNotMatch(css,/\.music-vinyl-cover\{[^}]*inset:20%/);
  assert.match(css,/\.home\[style\*="background:url"\]:before,html\.north-glass-ui \.home\[style\*="background:url"\]:after\{display:none!important;content:none!important\}/);
});

test('legacy duplicate widgets are removed while the four-slot glass dock is restored',()=>{
  assert.match(app,/const WIDS=\[\['dashboard'/);
  assert.match(app,/const HOME_DOCK_DEFAULT=\['calendar','games','mail','settings'\];/);
  assert.match(app,/const HOME_SHORTCUTS=\{\};/);
  assert.match(app,/S\.me\.appDock=Array\.from\(dock\.children\)/);
});

test('glass packs keep a free persisted mixed app-widget layout and appearance per pack',()=>{
  assert.doesNotMatch(app,/glassThemeNormalize\(\)/);
  assert.match(app,/function homeAppsHtml\(\)\{homeLayoutInit\(\);return S\.me\.homeLayout/);
  assert.match(app,/glass-reference-page/);
  assert.match(app,/_glassReferenceLayoutV2/);
  assert.match(app,/function appIconPackSet\(pack\)[\s\S]*S\.me\.uiMaterial='glass'/);
  assert.match(app,/function glassWidgetAppearanceEnsure\(\)[\s\S]*glassWidgetAppearances=\{\}/);
  assert.match(app,/map\[pack\]/);
  assert.match(app,/function appDown\(e,k\)\{if\(e\.pointerType/);
  assert.doesNotMatch(app,/function appDown\(e,k\)[\s\S]*?if\(e\.cancelable\)e\.preventDefault\(\);/);
  assert.match(app,/function appBeginDrag\(\)[\s\S]*?p\.el\.setPointerCapture\(p\.pid\)/);
  assert.match(css,/#homeDesktop \.home-item\{touch-action:pan-x pan-y\}/);
  assert.match(css,/glass-reference-page~\.apppage\{content-visibility:auto/);
  assert.match(css,/grid-auto-flow:dense/);
  assert.match(css,/north-pack-black \.home-dashboard-card[\s\S]*rgba\(34,35,40,\.18\)/);
});

test('app enlargement changes the whole icon box rather than cropping internal artwork',()=>{
  assert.doesNotMatch(css,/glass-pack-icon>img\{[^}]*inset:-4%/);
  assert.match(css,/glass-pack-icon>img\{[^}]*inset:0!important[^}]*object-fit:contain/);
  assert.match(css,/\.home \.dock \.app \.ic\{width:64px!important;height:64px!important/);
});

test('vinyl playback activates native iOS audio and every pack has a final record color',()=>{
  assert.match(app,/function musicNativeAudioActivate\(\)/);
  assert.match(app,/SmallPhoneNative\.request\('music\.audio\.activate'\)/);
  assert.match(app,/async function musicToggle\(\)/);
  assert.match(css,/north-pack-pink \.home-vinyl-card \.vinyl-record[^{]*\{[^}]*conic-gradient/);
  assert.match(css,/north-pack-blue \.home-vinyl-card \.vinyl-record[^{]*\{[^}]*conic-gradient/);
  assert.match(css,/north-pack-gray \.home-vinyl-card \.vinyl-record[^{]*\{[^}]*conic-gradient/);
  assert.match(css,/north-pack-black \.home-vinyl-card \.vinyl-record[^{]*\{[^}]*conic-gradient/);
  assert.match(css,/north-pack-gray \.home-vinyl-card \.vinyl-record\{background:repeating-radial-gradient[^}]*conic-gradient/);
  assert.match(css,/html\.north-glass-ui \.music-vinyl\{background:repeating-radial-gradient[^}]*conic-gradient/);
  assert.doesNotMatch(css,/north-pack-(?:black|pink|blue|gray) \.music-vinyl\{/);
  assert.doesNotMatch(css,/north-pack-black \.home-vinyl-card \.vinyl-record,html\.north-glass-ui\.north-pack-black \.music-vinyl/);
  const bridge=fs.readFileSync(path.join(root,'native','private-small-phone','XcodeProject','PhoneCompanionTest','PhoneNativeBridge.swift'),'utf8');
  const webView=fs.readFileSync(path.join(root,'native','private-small-phone','XcodeProject','PhoneCompanionTest','LocalPhoneWebView.swift'),'utf8');
  assert.match(bridge,/case "music\.audio\.activate"[\s\S]*\.playback[\s\S]*setActive\(true\)/);
  assert.match(webView,/mediaTypesRequiringUserActionForPlayback = \[\]/);
});

test('music pairing avatars no longer show the two headphone guide lines',()=>{
  assert.match(css,/\.music-headphone-pair>svg\{display:none!important\}/);
});
