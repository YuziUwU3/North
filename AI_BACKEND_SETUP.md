# 小手机内置 AI 测试步骤

第一版目标：用户不用自己填 API，小手机统一走你的后台扣点。测试期默认余额为 0，避免被反复注册白嫖，也避免你亏损。

## 1. 建表

打开 Supabase 项目，进入 SQL Editor，执行 `supabase_ai_schema.sql` 的全部内容。

如果之前已经执行过旧版脚本，也可以重新执行一次。脚本会自动补齐 `client_secret` 字段。

## 2. 部署 Edge Function

函数目录：

```text
supabase/functions/phone-ai/index.ts
```

需要设置环境变量：

```text
SUPABASE_URL=你的Supabase地址
SUPABASE_SERVICE_ROLE_KEY=你的service_role密钥
OPENAI_API_KEY=你的模型Key
OPENAI_BASE_URL=https://api.openai.com/v1
CHAT_MODEL=gpt-4o-mini
VISION_MODEL=gpt-4o-mini
IMAGE_MODEL=gpt-image-2
FREE_POINTS=0
```

测试期建议 `FREE_POINTS` 保持 0。发布后确认邀请码、账号和支付流程都稳定，再考虑注册送点。

## 3. 给测试账号加点

小手机里打开「AI账户」，复制用户 ID，然后在 Supabase SQL Editor 执行：

```sql
select phone_ai_grant_points('这里换成用户ID', 1000, 'test');
```

用户 ID 旁边还有本机自动生成的密钥，前端会自动提交给后台校验；你不需要手动复制密钥。

## 4. 小手机测试

打开「AI账户」：

1. 保存后台地址：`https://你的项目.supabase.co/functions/v1/phone-ai`
2. 点「测试连接」
3. 打开「使用内置AI」
4. 回微信测试聊天、发图识图、角色发真图

默认扣费：

- 文字聊天：2 点 / 次
- 识图：10 点 / 次
- 生成图片：120 点 / 张
- 语音生成：10 点 / 次

如果模型调用失败，后台会自动退点；余额不足时会直接拒绝调用。
