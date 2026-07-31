# Agent OS 与 Codex CLI Headless 基础知识

## 1. Headless 模式是什么

Headless 模式指的是：不打开交互式聊天界面，直接在终端里给 AI CLI 一个任务，让它执行、输出结果、然后退出。

在 Agent OS 里，headless 模式很重要，因为它适合被其他系统调用，例如：

- 飞书机器人收到消息后，自动把任务转给 AI CLI。
- Node.js 程序启动一个 AI CLI 子进程，读取它的事件流。
- CI/CD 流程里自动让 Codex 检查代码、修复错误、总结变更。
- 本地脚本批量调用 AI Agent 做重复任务。

可以把它理解为：

```text
交互模式：人坐在终端里和 AI 一来一回聊天
Headless：程序把任务丢给 AI，等待机器可解析的结果
```

## 2. Agent OS 为什么需要 Headless

Agent OS 的目标是把 AI CLI 变成一个可以被调度的生产力系统。

如果只用交互模式，人必须一直盯着终端。Headless 模式可以让 Agent OS 扮演调度者：

```text
飞书 / Webhook / 定时任务
        ↓
Agent OS 后端
        ↓
Codex CLI / Claude Code CLI
        ↓
JSON 事件流
        ↓
解析、记录、展示、回传
```

这也是本项目里 `probe:cli` 的意义：它从标准输入读取 AI CLI 输出的 JSON 行，然后把会话开始、模型回复、工具调用、完成结果等事件打印出来。

## 3. Codex CLI 的 Headless 入口

Codex CLI 的非交互入口是：

```bash
codex exec "你的任务"
```

例如：

```bash
codex exec "当前目录下有哪些文件？数一下有几个"
```

指定工作目录：

```bash
codex exec -C /Users/wangdekang/Desktop/kkdw_github_link_project/AI_agent_os_kkdw "当前目录下有哪些文件？数一下有几个"
```

注意：Codex CLI 里 `-p` 不是 prompt，而是 profile。

错误示例：

```bash
codex -p "当前目录下有哪些文件？数一下有几个"
```

正确示例：

```bash
codex exec "当前目录下有哪些文件？数一下有几个"
```

## 4. Codex CLI 登录与 API Key

使用 headless 之前，Codex CLI 需要先完成登录。

查看登录状态：

```bash
codex login status
```

使用 OpenAI API Key 登录：

```bash
export OPENAI_API_KEY="你的 sk-... key"
printenv OPENAI_API_KEY | codex login --with-api-key
codex login status
```

更安全的写法是不把 key 明文留在 shell 历史里：

```bash
read -s OPENAI_API_KEY
echo
export OPENAI_API_KEY
printenv OPENAI_API_KEY | codex login --with-api-key
unset OPENAI_API_KEY
codex login status
```

也可以使用设备登录：

```bash
codex login --device-auth
```

## 5. JSONL 输出

如果 Agent OS 要解析 Codex 的运行过程，需要让 Codex 输出 JSONL。

Codex CLI 使用：

```bash
codex exec --json "你的任务"
```

例如：

```bash
codex exec --json "当前目录下有哪些文件？数一下有几个"
```

JSONL 的意思是 JSON Lines：每一行都是一个独立 JSON 对象。

这类输出适合程序读取：

```text
{"type":"thread.started", ...}
{"type":"item.completed", ...}
{"type":"turn.completed", ...}
```

## 6. 和本项目 probe:cli 配合

本项目的 `package.json` 里有：

```json
{
  "scripts": {
    "probe:cli": "tsx src/probe-cli.ts"
  }
}
```

`src/probe-cli.ts` 会从标准输入读取 JSON 行，然后解析 Codex 或 Claude 的事件。

所以 Codex 的推荐用法是：

```bash
codex exec --json "当前目录下有哪些文件？数一下有几个" | pnpm probe:cli
```

如果要确保 Codex 在指定目录下运行：

```bash
codex exec \
  -C /Users/wangdekang/Desktop/kkdw_github_link_project/AI_agent_os_kkdw \
  --json \
  "当前目录下有哪些文件？数一下有几个" | pnpm probe:cli
```

运行后，`probe:cli` 会把原始 JSON 事件转换成更容易读的日志，例如：

```text
[0.0s] 会话开始 thread_id=...
[1.2s] 模型说: ...
[3.4s] 完成 tokens=...
```

## 7. Codex 和 Claude 的参数区别

Codex CLI 和 Claude Code CLI 都可以 headless，但参数不一样。

Claude Code 常见写法：

```bash
claude -p "当前目录下有哪些文件？数一下有几个" \
  --output-format stream-json \
  --verbose | pnpm probe:cli
```

Codex CLI 常见写法：

```bash
codex exec --json "当前目录下有哪些文件？数一下有几个" | pnpm probe:cli
```

关键区别：

| 能力 | Claude Code | Codex CLI |
| --- | --- | --- |
| 非交互入口 | `claude -p` | `codex exec` |
| JSON 事件流 | `--output-format stream-json` | `--json` |
| prompt 参数 | `-p "..."` | 直接写在 `codex exec` 后 |
| profile 参数 | 不是这个含义 | `-p` / `--profile` |

所以不要把 Claude 的参数直接套到 Codex 上。

## 8. 常用 Codex Headless 命令

检查当前目录：

```bash
codex exec "看看这个项目是做什么的"
```

输出 JSONL：

```bash
codex exec --json "总结当前项目结构"
```

指定模型：

```bash
codex exec -m gpt-5 "解释 src/index.ts 的作用"
```

只读模式：

```bash
codex exec -s read-only "检查项目里可能的问题"
```

允许修改当前工作区：

```bash
codex exec -s workspace-write "修复 TypeScript 报错并运行 pnpm build"
```

把最终回答写到文件：

```bash
codex exec "总结这个项目" -o result.md
```

从 stdin 读取任务：

```bash
echo "当前目录下有哪些文件？数一下有几个" | codex exec -
```

## 9. 常见报错

### 把 `-p` 当成 prompt

错误：

```bash
codex -p "当前目录下有哪些文件？数一下有几个"
```

原因：Codex 的 `-p` 是 profile，不是 prompt。

改成：

```bash
codex exec "当前目录下有哪些文件？数一下有几个"
```

### 使用了 Claude 的 JSON 参数

错误：

```bash
codex exec --output-format stream-json --verbose "当前目录下有哪些文件？"
```

原因：`--output-format stream-json` 和 `--verbose` 是 Claude Code 的常见参数，不是 Codex CLI 的 headless JSON 参数。

改成：

```bash
codex exec --json "当前目录下有哪些文件？"
```

### 没有登录

检查：

```bash
codex login status
```

登录：

```bash
printenv OPENAI_API_KEY | codex login --with-api-key
```

### 当前目录不是 Git 仓库

有些情况下 Codex 会要求在 Git 仓库里运行。

可以临时跳过检查：

```bash
codex exec --skip-git-repo-check "分析当前文件夹"
```

## 10. Agent OS 里的最小闭环

一个最小的 Agent OS headless 调用链可以是：

```bash
codex exec --json "当前目录下有哪些文件？数一下有几个" | pnpm probe:cli
```

它完成了三件事：

1. `codex exec --json` 启动 Codex headless 任务。
2. Codex 把执行过程作为 JSONL 输出到 stdout。
3. `pnpm probe:cli` 从 stdin 接收 JSONL，并转换成可读日志。

后续可以继续升级成：

```text
Node.js 后端 spawn Codex CLI
        ↓
监听 stdout JSONL
        ↓
解析事件类型
        ↓
保存 session / turns / tool calls
        ↓
把最终结果回传到飞书或 Web 页面
```

这就是 Agent OS 把 AI CLI 变成可编排 Agent 的基础。
