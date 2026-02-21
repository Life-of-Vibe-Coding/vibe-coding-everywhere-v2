# AI CLI 命令与选项说明

本文档说明服务端如何通过 **Pi (pi-mono)**  unified coding agent 支持 Claude、Gemini 与 Codex。

## 概览

- 客户端通过 Socket.IO 的 `submit-prompt` 事件发送 `prompt` 和可选选项。
- 所有 provider（claude/gemini/codex）统一走 Pi RPC（`pi --mode rpc`）。
- 工作目录固定为服务端配置的 `WORKSPACE_CWD`。

## Pi RPC

**运行模块：** `server/process/piRpcSession.js`

**命令：** `pi --mode rpc --provider <anthropic|openai|google> --model <modelId> --session-dir <workspace>/.pi/sessions`

**Provider 映射：**

| 客户端 provider | Pi provider |
|-----------------|-------------|
| `claude`        | `anthropic` |
| `codex`         | `openai`    |
| `gemini`        | `google`    |

**安装：** `npm i -g @mariozechner/pi-coding-agent`

**认证：** 支持订阅制（Claude Pro、Codex、Gemini CLI），运行 `pi` 后执行 `/login` 一次即可；无需 API keys。

**系统提示：** 系统提示注入已禁用；不再向 Pi 传入 `--system-prompt`。

---

## 客户端 payload → 服务端 options

### submit-prompt 的 payload 字段

| 字段         | 类型                              | 说明                         |
| ------------ | --------------------------------- | ---------------------------- |
| `prompt`     | string                            | 用户输入，必填               |
| `provider`   | `"claude" \| "gemini" \| "codex"` | 不传则用服务端 `DEFAULT_PROVIDER` |
| `model`      | string                            | 可选，覆盖默认模型           |
| `replaceRunning` | boolean                        | 为 true 时先结束当前会话再起新会话 |

### 默认模型

| provider | 默认模型            |
|----------|---------------------|
| claude   | sonnet              |
| codex    | gpt-5.1-codex-mini  |
| gemini   | gemini-2.5-flash    |

### 环境变量（server/config/index.js）

| 变量                     | 说明                   | 默认值    |
| ------------------------ | ---------------------- | --------- |
| `DEFAULT_PROVIDER`       | 未指定时的 AI 提供方   | `codex`   |
| `DEFAULT_PERMISSION_MODE`| 权限模式（仅供参考）   | `bypassPermissions` |
| `PI_CLI_PATH`            | Pi CLI 二进制路径      | `pi`      |
| `CLAUDE_OUTPUT_LOG`      | AI 输出日志目录        | `<project>/logs` |
