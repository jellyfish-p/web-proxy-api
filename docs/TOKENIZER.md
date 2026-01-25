# Tokenizer 使用说明

## 概述

本项目集成了通用的 tokenizer 工具，用于准确计算 API 请求和响应中的 token 使用量。tokenizer 基于 `/server/assets/tokenizer.json` 文件，在服务器启动时自动初始化。

## 功能特性

- **自动初始化**：服务器启动时通过 Nitro 插件自动加载 tokenizer
- **准确计算**：支持中英文混合文本的 token 估算
- **流式支持**：在流式和非流式响应中都能准确统计 token 使用量
- **多语言优化**：针对中文和英文采用不同的估算策略
- **安全存储**：tokenizer 和 wasm 文件存储在 server/assets 目录，不会直接暴露给客户端

## 文件结构

```
server/
├── assets/
│   ├── tokenizer.json        # Tokenizer 配置文件
│   └── deepseek_wasm/         # WASM 文件目录
│       └── sha3_wasm_bg.7b9ca65ddd.wasm
├── utils/
│   └── tokenizer.ts          # Tokenizer 核心实现
├── plugins/
│   └── tokenizer.ts          # 服务器启动时初始化插件
└── api/
    └── v1/
        └── chat/
            └── completions.post.ts  # 使用 tokenizer 的 API 端点
```

## 使用方法

### 1. 在 API 端点中使用

```typescript
import { getTokenizer } from '../../../utils/tokenizer';

// 获取 tokenizer 实例
const tokenizer = await getTokenizer();

// 计算消息的 token 数量
const promptTokens = tokenizer.countMessagesTokens(messages);

// 估算文本的 token 数量
const completionTokens = tokenizer.estimateTokenCount(responseText);
```

### 2. API 方法

#### `getTokenizer()`
获取 tokenizer 单例实例，如果未初始化则自动初始化。

```typescript
const tokenizer = await getTokenizer();
```

#### `countMessagesTokens(messages)`
计算消息数组的总 token 数量，包括角色标记的开销。

```typescript
const messages = [
    { role: 'user', content: 'Hello' },
    { role: 'assistant', content: 'Hi there!' }
];
const tokens = tokenizer.countMessagesTokens(messages);
```

#### `estimateTokenCount(text)`
估算单个文本字符串的 token 数量。

```typescript
const text = "这是一段中英文混合的文本 with English text";
const tokens = tokenizer.estimateTokenCount(text);
```

#### `getVocabSize()`
获取词汇表大小。

```typescript
const vocabSize = tokenizer.getVocabSize();
```

#### `isInitialized()`
检查 tokenizer 是否已初始化。

```typescript
if (tokenizer.isInitialized()) {
    // tokenizer 已就绪
}
```

## Token 估算策略

### 中文文本
- 平均每 2 个汉字 ≈ 1 个 token
- 适用于简体中文和繁体中文

### 英文文本
- 平均每 4 个字符 ≈ 1 个 token
- 包括空格和标点符号

### 混合文本
自动识别中英文字符，分别计算后求和。

### 消息开销
每条消息额外增加约 4 个 token 的开销，用于角色标记和格式化。

## 响应格式

### 流式响应
在流结束时发送包含 token 使用量的最终块：

```json
{
    "choices": [{ "index": 0, "finish_reason": "stop" }],
    "usage": {
        "prompt_tokens": 15,
        "completion_tokens": 42,
        "total_tokens": 57
    }
}
```

### 非流式响应
在响应体中包含 `usage` 字段：

```json
{
    "id": "session_id",
    "object": "chat.completion",
    "created": 1234567890,
    "model": "deepseek-chat",
    "choices": [{
        "index": 0,
        "message": {
            "role": "assistant",
            "content": "Response text"
        },
        "finish_reason": "stop"
    }],
    "usage": {
        "prompt_tokens": 15,
        "completion_tokens": 42,
        "total_tokens": 57
    }
}
```

## 自定义 Tokenizer

如果需要使用不同的 tokenizer，只需替换 `/server/assets/tokenizer.json` 文件即可。文件应符合 Hugging Face tokenizer 的标准格式。

**注意**：由于文件位于 server/assets 目录，它们会被打包到服务器代码中，但不会直接暴露给客户端访问，提高了安全性。

## 性能考虑

- Tokenizer 在服务器启动时初始化一次，后续请求直接使用缓存的实例
- Token 估算采用轻量级算法，对性能影响极小
- 对于需要精确 token 计数的场景，建议使用完整的 tokenizer 库（如 `@huggingface/transformers`）

## 注意事项

1. 当前实现使用估算算法，可能与实际 token 数量有小幅偏差
2. 对于生产环境，建议根据实际模型调整估算参数
3. 如果 tokenizer.json 文件损坏或缺失，服务器启动时会报错

## 扩展建议

如需更精确的 token 计数，可以考虑：

1. 集成 `@huggingface/transformers` 库
2. 使用模型特定的 tokenizer
3. 实现基于 BPE 的完整 tokenization 算法

## 相关文档

- [OpenAI API 文档](https://platform.openai.com/docs/api-reference/chat)
- [Hugging Face Tokenizers](https://huggingface.co/docs/tokenizers/index)
