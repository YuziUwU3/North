# 小手机内置 AI 后台配置

目标：用户不用自己填写 API，小手机统一走你的 Supabase Edge Function，并按点数扣费。

## 1. 数据表

Supabase 里执行 `supabase_ai_schema.sql`。已经执行过也可以重复执行一次，脚本会自动补齐字段。

## 2. Edge Function

函数目录：

```text
supabase/functions/phone-ai/index.ts
```

函数名：

```text
phone-ai
```

## 3. 必填 Secrets

在 Supabase 的 Edge Functions -> Secrets 里添加：

```text
PHONE_SUPABASE_URL=你的 Supabase 项目地址
PHONE_SERVICE_ROLE_KEY=你的 service_role key
OPENAI_API_KEY=你的聊天/识图/生图中转站 key
OPENAI_BASE_URL=https://vg.v1api.cc/v1
CHAT_MODEL=gemini-2.5-pro
VISION_MODEL=gemini-2.5-pro
IMAGE_MODEL=gpt-image-2
FREE_POINTS=0
```

注意：Supabase 不允许自定义 Secret 以 `SUPABASE_` 开头，所以这里用的是 `PHONE_SUPABASE_URL` 和 `PHONE_SERVICE_ROLE_KEY`。

## 4. 海螺语音 Secrets

接入语音时再添加：

```text
MINIMAX_API_KEY=你的 MiniMax / 海螺 API Key
MINIMAX_BASE_URL=https://api.minimaxi.com
MINIMAX_GROUP_ID=你的 GroupId（如果平台要求就填，不要求可留空）
TTS_MODEL=speech-02-turbo
TTS_VOICE_ID=male-qn-qingse
TTS_CNY_PER_CHAR=0.0002
```

`TTS_CNY_PER_CHAR` 只是预估成本，用来写进流水，方便你之后定价；真实扣费仍以 MiniMax 后台为准。

## 5. 当前扣点

```text
文字聊天：10 点 / 次
识图：25 点 / 次
生成图片：120 点 / 张
语音生成：10 点 / 次
总结：2 点 / 次
```

语音生成会在流水里记录模型、音色、字数和预估成本。角色自己的 `API音色名` 会优先生效，所以每个角色都可以用不同声音；不填时才使用 `TTS_VOICE_ID` 默认音色。小手机设置页的“拉取我的全部音色”在打开内置 AI 后会走后台拉取，不需要把海螺 Key 填到前端。

## 6. 给测试用户加点

在小手机的 AI账户里复制用户 ID，然后在 Supabase SQL Editor 执行：

```sql
select phone_ai_grant_points('这里换成用户ID', 1000, 'test');
```

## 7. 小手机里测试

1. 打开 AI账户。
2. 后台地址填：`https://你的项目.supabase.co/functions/v1/phone-ai`
3. 点测试连接。
4. 打开“使用内置AI”。
5. 给角色的语音音色设置成 API 音色，再测试语音。
