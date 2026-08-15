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
OPENAI_API_KEY=你的聊天/识图中转站 key
OPENAI_BASE_URL=https://vg.v1api.cc/v1
CHAT_MODEL=gemini-2.5-pro
VISION_MODEL=gemini-2.5-pro
ADMIN_ACCESS_TOKEN=主管理员独立强口令
```

注意：Supabase 不允许自定义 Secret 以 `SUPABASE_` 开头，所以这里用的是 `PHONE_SUPABASE_URL` 和 `PHONE_SERVICE_ROLE_KEY`。

如果要让其他管理员只管理用户授权、不能查看付款核对，再配置：

```text
LICENSE_ADMIN_TOKENS=授权管理员A的独立强口令,授权管理员B的独立强口令
```

每位授权管理员使用不同口令，多个口令用英文逗号、分号或换行分隔。`ADMIN_ACCESS_TOKEN` 是主管理员口令，可查看付款和用户授权；`LICENSE_ADMIN_TOKENS` 里的口令只能查询小手机 ID、查看注册时间、移出或放回用户。迁移码和备用恢复码已经停用，设备恢复只允许本人扫脸或验证指纹。付款订单、截图、金额和审核接口会在云端拒绝授权管理员，不只是前端隐藏。

用户授权达到上千或上万条前，先在 SQL Editor 执行：

```text
supabase/migrations/202607240001_license_admin_pagination.sql
```

这个迁移会增加列表索引、管理员分页搜索函数和操作人字段。管理后台每次只读取 50 条，搜索、可进入/已移出筛选和总人数统计都在云端完成；“移出去”仍然只是停用，记录不会从搜索结果中删除。之后的移出和放回操作还会显示最近是哪位管理员、在什么时间执行的。

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
语音生成：每 50 字 1 点，向上取整（1～50 字 1 点，最多 300 字 / 6 点）
总结：2 点 / 次
```

语音生成只在拿到可用音频后扣点；失败不扣点。流水会记录模型、音色、字数、实际扣点和预估成本。角色自己的 `API音色名` 会优先生效，所以每个角色都可以用不同声音；不填时才使用 `TTS_VOICE_ID` 默认音色。小手机设置页的“拉取我的全部音色”在打开内置 AI 后会走后台拉取，不需要把海螺 Key 填到前端。

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

## 8. 购买渠道已关闭

自网页核心 v946 起，不再提供点数套餐、新订单、付款二维码、付款凭证上传或新的音色克隆申请。`phone-ai` 的 `purchase_create` 与 `purchase_submit` 均固定返回 `410 purchase-channel-closed`，账户响应中的 `plans` 固定为空数组。

历史账户余额、已绑定音色、流水和历史订单继续保留，供老用户使用与退款核对。管理员后台仅用于处理历史记录，不得通过旧二维码、旧链接或旧客户端继续接受新购买。
