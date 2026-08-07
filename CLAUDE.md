# agent-os

把飞书变成 AI 编程 CLI（Claude Code / Codex）的指挥台。
一个话题 = 一个任务；bot 之间可互相 @ 协作；cron 定时巡检。

## 运行

pnpm start（watch 模式）/ pnpm start:once（单次启动）

## 让飞书修改本地项目

机器人进程必须运行在需要修改项目的那台电脑上。先在 `.env` 填写：

```dotenv
DEFAULT_CLI=codex
CLI_WORKDIR=/Users/your-name/Developer/your-project
```

然后启动 `pnpm start`，在飞书新话题发送：

```text
/codex 修改 src/index.ts，在文件末尾添加一行注释
```

Codex 会在 `CLI_WORKDIR` 指向的本地目录执行，并且使用 `workspace-write` 沙箱。

Claude Code 的非交互模式没有可点击的权限弹窗。需要自动修改文件时，在 `.env` 设置：

```dotenv
CLAUDE_PERMISSION_MODE=acceptEdits
```

只有当飞书机器人只对可信用户开放时，才使用 `CLAUDE_PERMISSION_MODE=bypassPermissions`。

## 模块地图（随开发生长，只列已存在的）

- src/index.ts — 入口：启动 banner + 环境自检
- src/probe-cli.ts — AI CLI 事件流解析器（stdin 读 headless JSON 行，打印时间线）

## 约定

- ESM only，Node 22+，pnpm
- 凭证只放 .env（已 gitignore），绝不硬编码、绝不提交

## 错题本

> 踩坑后追加一行：现象 → 原因 → 正确做法。给未来的 AI 和人看。
