# 第 29 节环境准备

## 沿用上一节环境

本节在上一节完整模板基础上继续，不新增外部 Skill。先确认开发者的内部能力已经安装：

- `agent-browser` Skill 与 CLI
- `code-review-expert` Skill
- `implement-ticket` 项目 Skill

缺少时按上一节补装：

```bash
npx skills add vercel-labs/agent-browser --path skills/agent-browser
npm install -g agent-browser
agent-browser install
npx skills add sanyuan0704/sanyuan-skills --path skills/code-review-expert
```

## 保留飞书云文档能力

上一节使用飞书官方 `lark-cli` 与 `lark-doc` Skill 直接创建云文档，本节继续沿用。

## 安装 CLI 与官方 Skills

```bash
node --version
npx @larksuite/cli@latest install
lark-cli --version
npx skills add larksuite/cli -g -y
lark-cli skills read lark-doc
```

## 配置与用户授权

```bash
lark-cli config init --new
lark-cli auth login --domain docs
lark-cli auth status --json --verify
```

配置和登录命令会打开浏览器，请按页面提示完成飞书应用配置与用户授权。文档操作默认使用 `--as user`，凭证由 lark-cli 管理，不要写入项目 `.env`。

## 最小验证

```bash
lark-cli docs +create --as user --content '<title>Agent OS 测试文档</title><p>如果你能打开这份文档，说明 lark-doc 已经可以工作。</p>'
```

成功结果应满足 `ok: true`，并在 `data.document.url` 返回可打开的飞书文档链接。

后续更新 CLI 与官方 Skills 使用：

```bash
lark-cli update
```

安装完成后应能看到：

```text
.agents/skills/agent-browser/SKILL.md
.agents/skills/code-review-expert/SKILL.md
workspace-template/.agents/skills/implement-ticket/SKILL.md
```

## CLI 超时配置

Claude Code 与 Codex 的单次执行超时默认是 2 小时。长任务（实现、浏览器验收、代码审查）容易超过 10 分钟，建议按需调大：

```bash
CLAUDE_TIMEOUT_MS=7200000
CODEX_TIMEOUT_MS=7200000
```

两个 CLI 也可以统一使用 `CLI_TIMEOUT_MS` 配置，单位都是毫秒。

## 定时任务与 API 配置

第 28 节新增定时任务系统，计划保存在 `data/schedules.json`，运行记录保存在 `data/schedule-runs.json`，重启后自动恢复。

定时任务管理 API 默认监听：

```bash
http://localhost:3101/api/schedules
```

端口和可选鉴权 token 通过 `.env` 配置：

```bash
SCHEDULE_API_PORT=3101
SCHEDULE_API_TOKEN=
```

`SCHEDULE_API_TOKEN` 留空时不校验；设置后请求需要带 `x-api-token` 头。

## demo-server 与日志巡检配置

本节新增独立 `demo-server` 业务服务，用来产生可复现的结构化日志和故障。它是 workspace 的一部分，根目录执行一次 `pnpm install` 即可：

```bash
pnpm install
```

启动日志服务：

```bash
pnpm demo:server
```

制造故障流量：

```bash
pnpm demo:traffic --scenario error-spike
pnpm demo:traffic --scenario repeated-error
```

日志默认写入 `demo-server/logs/app.log`。巡检由服务项目自己的 `log-patrol` skill 驱动，skill 文件在 `demo-server/.agents/skills/log-patrol/SKILL.md`，日志怎么读、增量游标怎么维护、什么算异常、怎么通知和派活都由它定义。Agent OS 只负责到点把巡检任务交给 CEO 助理。

### 准备运维群 webhook

新建一个飞书群，添加自定义机器人，复制 webhook 地址。写入根目录 `.env`：

```bash
PATROL_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/xxx
```

同一个群里也要把开发者 bot 拉进来，webhook @ 它时它才能收到消息。Agent OS 对 bot 消息的处理是：消息里 @ 了哪个 bot，哪个 bot 就当新任务开工。

如果推送后没有出现 @，检查 Agent OS 是否已经重启并生成 `data/bot-identities.json`，再确认开发者 bot 在运维群里。

### 把开发者工作区指向 demo-server

开发者接手巡检修复时要在 demo-server 里干活。打开 `config/bots.json`，把 developer 的 `workspace` 改成 demo-server 目录，例如：

```json
"workspace": "/绝对路径/demo-server"
```

不改的话，开发者会在原业务工作区里找订单服务和 `logs/app.log`，会误报“故障不存在”。完成本节演示后，可以再改回原业务工作区。

### 创建巡检定时任务

Agent OS 启动后，在测试话题里发：

```text
@CEO助理 /schedule 每小时执行一次服务端日志巡检，demo-server 项目目录是 <绝对路径>/demo-server，巡检手册在 <绝对路径>/demo-server/.agents/skills/log-patrol/SKILL.md
```

CEO 助理会用 `schedule_manage`（action=add）创建一条每小时计划，工具回执会带回任务 id、规则和下一次执行时间。立即触发一次：

```text
@CEO助理 /schedule run <id>
```

巡检发现 warning 会推送到运维群；critical 会推送一条 @ 开发者的消息，开发者 bot 收到后直接开始干活。服务侧的增量游标和去重记录由 skill 自己维护，位于 `demo-server/.scratch/`。
