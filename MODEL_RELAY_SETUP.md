# 多模型 OpenAI 兼容中转站

这个中转站部署在现有 Supabase 项目中，对外提供统一的 OpenAI 兼容地址，同时把三家的真实密钥保存在 Edge Function Secrets 中。

支持：

- Claude：`claude-opus-4-8`、`claude-sonnet-4-6`、`claude-haiku-4-5`
- Gemini：`gemini-3.5-flash`、`gemini-2.5-pro`、`gemini-2.5-flash`
- OpenAI 聊天：如 `gpt-5.4-mini`、`gpt-5.4-nano`
- OpenAI 生图：`gpt-image-2`
- `/v1/chat/completions`：普通与流式响应
- `/v1/images/generations`
- `/v1/models`
- `/v1/relay/account`：查询当前 Key 的余额和最近 50 条流水
- 独立 `sk-relay-...` 用户 Key、点数、每分钟限流、用量流水、失败自动退点

## 1. 建表

在 Supabase SQL Editor 执行：

```text
supabase_model_relay.sql
```

## 2. 配置 Secrets

```bash
supabase secrets set OPENAI_API_KEY=你的OpenAI_API_Key
supabase secrets set ANTHROPIC_API_KEY=你的Anthropic_API_Key
supabase secrets set GEMINI_API_KEY=你的Gemini_API_Key
supabase secrets set ALLOWED_ORIGINS=https://fenglina35-dotcom.github.io
```

可选配置：

```bash
supabase secrets set CHAT_POINTS=10 VISION_POINTS=25 IMAGE_POINTS=120
supabase secrets set MODEL_ALIASES_JSON='{"claude-default":"claude-sonnet-4-6","gemini-default":"gemini-3.5-flash","image-default":"gpt-image-2"}'
```

不要把三家的真实 Key 写进网页、GitHub 或小手机设置。

## 3. 部署

该函数使用自己的 `sk-relay-...` 鉴权，因此关闭 Supabase JWT 校验：

```bash
supabase functions deploy model-relay --no-verify-jwt
```

统一 Base URL：

```text
https://你的项目.supabase.co/functions/v1/model-relay/v1
```

## 4. 创建用户 Key

在 SQL Editor 执行，下方示例赠送 10000 点并限制每分钟 30 次：

```sql
select * from model_relay_create_key('朋友A', 10000, 30);
```

返回的 `api_key` 只显示这一次，请立即复制保存。以后加点：

```sql
select model_relay_grant('上一步返回的 key_id', 5000);
```

停用某个 Key：

```sql
update model_relay_keys set enabled=false where id='key_id';
```

## 5. 测试 Claude

```bash
curl https://你的项目.supabase.co/functions/v1/model-relay/v1/chat/completions \
  -H "Authorization: Bearer sk-relay-你的用户Key" \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-sonnet-4-6","messages":[{"role":"user","content":"你好"}]}'
```

Gemini 只需把模型改成 `gemini-3.5-flash`。OpenAI 聊天改成 `gpt-5.4-mini`。

## 6. 测试 GPT Image 2

```bash
curl https://你的项目.supabase.co/functions/v1/model-relay/v1/images/generations \
  -H "Authorization: Bearer sk-relay-你的用户Key" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-image-2","prompt":"雨夜霓虹街道，电影感","size":"1024x1024"}'
```

## 7. 小手机中填写

- 地址：`https://你的项目.supabase.co/functions/v1/model-relay/v1`
- Key：`sk-relay-...`
- 模型：Claude、Gemini 或 OpenAI 模型 ID

查询流水：

```sql
select u.created_at,k.label,u.feature,u.model,u.points,u.status,u.http_status
from model_relay_usage u join model_relay_keys k on k.id=u.key_id
order by u.created_at desc limit 200;
```
