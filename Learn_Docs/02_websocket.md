# WebSocket 长连接基础教程

## 1. WebSocket 是什么

WebSocket 是一种建立在 TCP 之上的全双工通信协议。客户端和服务端完成一次 HTTP 握手后，会保持同一条连接；两端都可以随时主动发送消息。

它适合需要实时双向通信的场景：

- 在线聊天、协作编辑、实时通知。
- 交易行情、监控面板、游戏状态同步。
- Agent OS 将 Codex / Claude 的流式执行事件实时推送给 Web 页面。

可以把它理解为：

```text
HTTP 请求：客户端发起请求 -> 服务端响应 -> 本次通信结束
WebSocket：建立连接 -> 客户端和服务端都可持续、主动发送消息
```

## 2. 为什么叫“长连接”

WebSocket 的“长”指的是连接会在首次握手后持续存在，而不是每发一条消息就新建一次 HTTP 请求。

一个典型流程：

```text
浏览器                    服务端
  | ---- HTTP Upgrade ----> |
  | <--- 101 Switching --- |
  | ===== WebSocket ====== |
  | <---- 实时事件 ------- |
  | ------ 用户操作 -----> |
  | <---- 执行结果 ------- |
```

长连接不代表“永不掉线”。浏览器休眠、网络切换、代理超时、服务端重启都会断开连接，所以生产环境必须处理心跳、重连和状态恢复。

## 3. WebSocket 和 HTTP、SSE 的区别

| 方案 | 通信方向 | 是否持续连接 | 适合场景 |
| --- | --- | --- | --- |
| 普通 HTTP | 客户端请求，服务端响应 | 否 | 表单、查询、REST API |
| HTTP Keep-Alive | 复用 TCP 连接 | 不等于实时双向 | 连续 HTTP 请求 |
| SSE | 服务端推送到客户端 | 是 | 日志、通知、单向流 |
| WebSocket | 客户端和服务端双向主动发送 | 是 | 聊天、协作、实时 Agent 状态 |

HTTP Keep-Alive 只是复用底层 TCP 连接，业务通信仍然是一问一答的 HTTP 请求。WebSocket 在握手升级后使用 WebSocket 帧传输数据，因此能真正双向推送。

## 4. 建立连接：HTTP Upgrade 握手

浏览器创建 WebSocket 时，先发送一个带有 `Upgrade: websocket` 的 HTTP 请求。服务端接受后返回 `101 Switching Protocols`，连接从 HTTP 协议升级为 WebSocket。

浏览器端最小示例：

```ts
const socket = new WebSocket("ws://localhost:8080/ws");

socket.addEventListener("open", () => {
  console.log("WebSocket 已连接");
  socket.send(JSON.stringify({ type: "hello", payload: { name: "Agent OS" } }));
});

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  console.log("收到服务端消息：", message);
});

socket.addEventListener("close", (event) => {
  console.log("连接关闭：", event.code, event.reason);
});

socket.addEventListener("error", () => {
  console.error("WebSocket 发生错误");
});
```

开发环境通常使用 `ws://`，生产环境必须使用加密连接 `wss://`。

## 5. 连接状态

浏览器 `WebSocket` 对象有四个状态：

| 常量 | 含义 |
| --- | --- |
| `WebSocket.CONNECTING` | 正在握手连接 |
| `WebSocket.OPEN` | 已连接，可以收发消息 |
| `WebSocket.CLOSING` | 正在关闭 |
| `WebSocket.CLOSED` | 已关闭或连接失败 |

发送消息前先检查状态，避免对已经关闭的连接调用 `send`：

```ts
function send(socket: WebSocket, message: unknown): void {
  if (socket.readyState !== WebSocket.OPEN) {
    console.warn("WebSocket 尚未连接，消息未发送");
    return;
  }

  socket.send(JSON.stringify(message));
}
```

## 6. Node.js 服务端最小示例

Node.js 核心模块没有内置 WebSocket 服务端。常见做法是使用 `ws`：

```bash
pnpm add ws
pnpm add -D @types/ws
```

创建 `src/ws-server.ts`：

```ts
import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 8080, path: "/ws" });

wss.on("connection", (socket, request) => {
  console.log("客户端已连接：", request.socket.remoteAddress);

  socket.send(
    JSON.stringify({
      type: "connected",
      payload: { message: "欢迎连接 Agent OS" },
    }),
  );

  socket.on("message", (raw) => {
    const message = JSON.parse(raw.toString());
    console.log("收到客户端消息：", message);

    socket.send(
      JSON.stringify({
        type: "echo",
        payload: message,
      }),
    );
  });

  socket.on("close", (code, reason) => {
    console.log("客户端断开：", code, reason.toString());
  });
});

console.log("WebSocket server listening on ws://localhost:8080/ws");
```

启动：

```bash
pnpm exec tsx src/ws-server.ts
```

## 7. 设计消息协议

WebSocket 只负责传输文本或二进制数据，不规定你的业务消息格式。实际项目里建议所有消息都使用统一 JSON 信封：

```json
{
  "type": "agent.event",
  "id": "evt_123",
  "timestamp": "2026-07-31T10:00:00.000Z",
  "payload": {
    "status": "running"
  }
}
```

推荐字段：

| 字段 | 用途 |
| --- | --- |
| `type` | 表示事件类型，例如 `chat.message`、`agent.event`、`error` |
| `id` | 方便去重、追踪和排查问题 |
| `timestamp` | 排序、日志和延迟分析 |
| `payload` | 实际业务数据 |

不要让前端根据“某个字段是否存在”猜消息类型。明确的 `type` 会让协议更稳定，也更容易扩展。

## 8. 心跳：避免“假在线”

网络断开时，TCP 不一定能立刻发现。某些代理或负载均衡器也会关闭长时间没有流量的连接，因此需要心跳机制。

服务端通常使用 WebSocket 协议的 `ping` / `pong` 帧检查连接存活。浏览器原生 API 不暴露发送 `ping` 帧的能力，但浏览器会自动响应服务端的 `ping`。

服务端心跳示例：

```ts
import { WebSocket, WebSocketServer } from "ws";

type AliveSocket = WebSocket & { isAlive?: boolean };

const wss = new WebSocketServer({ port: 8080 });

wss.on("connection", (socket: AliveSocket) => {
  socket.isAlive = true;

  socket.on("pong", () => {
    socket.isAlive = true;
  });
});

const heartbeat = setInterval(() => {
  for (const socket of wss.clients) {
    const client = socket as AliveSocket;

    if (!client.isAlive) {
      client.terminate();
      continue;
    }

    client.isAlive = false;
    client.ping();
  }
}, 30_000);

wss.on("close", () => {
  clearInterval(heartbeat);
});
```

如果服务端和客户端都不是浏览器，可以使用应用层心跳消息，例如 `{ "type": "ping" }` 和 `{ "type": "pong" }`。

## 9. 断线重连：指数退避

断线后立刻无限重连会给服务端造成压力。更稳妥的策略是指数退避：每次失败后逐步增加等待时间，并加入随机抖动，避免大量客户端在同一时刻同时重连。

浏览器端示例：

```ts
let retryCount = 0;
let socket: WebSocket | undefined;

function connect(): void {
  socket = new WebSocket("wss://example.com/ws");

  socket.addEventListener("open", () => {
    retryCount = 0;
    console.log("连接成功");
  });

  socket.addEventListener("message", (event) => {
    console.log("收到消息：", event.data);
  });

  socket.addEventListener("close", () => {
    const baseDelay = Math.min(1_000 * 2 ** retryCount, 30_000);
    const jitter = Math.random() * 500;
    retryCount += 1;

    window.setTimeout(connect, baseDelay + jitter);
  });
}

connect();
```

重连成功后，不要假设服务端还保留了旧状态。需要根据业务补发订阅、重新认证、用最后一条事件 ID 拉取遗漏消息，或让服务端进行会话恢复。

## 10. 关闭连接与关闭码

正常关闭时，主动调用：

```ts
socket.close(1000, "用户离开页面");
```

常见关闭码：

| 关闭码 | 含义 |
| --- | --- |
| `1000` | 正常关闭 |
| `1008` | 策略或权限不满足 |
| `1011` | 服务端内部错误 |
| `1006` | 异常关闭的本地状态，不能由应用主动发送 |

关闭原因应简洁，避免把内部错误细节或敏感数据发送给客户端。

## 11. 安全要点

1. 生产环境使用 `wss://`，不要在公网传输明文 `ws://`。
2. 在服务端校验 `Origin`，WebSocket 不会自动获得普通 HTTP CORS 中间件的保护。
3. 建立连接时验证用户身份和权限，每条业务消息也要进行授权检查。
4. 不要把长期有效的 token 放进 URL 查询参数，URL 容易进入日志、浏览器历史和监控系统。
5. 限制单条消息大小、消息频率和连接数，防止滥用。
6. 对所有 JSON 消息做结构校验，不信任客户端发送的数据。

浏览器 WebSocket 构造函数不能像 `fetch` 一样随意添加自定义 `Authorization` 请求头。实际项目常用安全 Cookie、短期票据或 `Sec-WebSocket-Protocol` 协商来完成认证；具体方案要结合你的前端与网关架构设计。

## 12. WebSocket 在 Agent OS 中的作用

Agent OS 通常需要把 CLI 的实时进度发给前端，而不是等任务全部结束后再显示结果。

以 Codex headless 为例：

```text
codex exec --json "修复 TypeScript 报错"
        |
        v
Node.js child_process 读取 stdout JSONL
        |
        v
解析 thread.started / item.completed / turn.completed
        |
        v
WebSocket 广播给浏览器
        |
        v
前端实时显示：思考、工具调用、命令输出、最终结果
```

Node.js 中可以用 `spawn` 启动 Codex，并把解析后的事件发送给已连接的浏览器：

```ts
import { spawn } from "node:child_process";
import type { WebSocketServer } from "ws";

export function runCodexTask(wss: WebSocketServer, prompt: string): void {
  const child = spawn("codex", ["exec", "--json", prompt], {
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.setEncoding("utf8");

  child.stdout.on("data", (chunk: string) => {
    for (const line of chunk.split("\n")) {
      if (!line.trim()) continue;

      for (const client of wss.clients) {
        if (client.readyState === client.OPEN) {
          client.send(line);
        }
      }
    }
  });
}
```

上面的例子只展示基本思路。生产实现还需要处理 JSON 被拆成半行的情况、用户与任务的对应关系、断线重连、权限校验、错误流和任务取消。

## 13. 多实例部署时要考虑什么

单机时，服务端可以把所有连接保存在内存里。部署多个实例后，每个实例只知道自己维护的 WebSocket 连接。

常见解决方式：

```text
用户 A 连接到实例 1
用户 B 连接到实例 2
        |
Redis Pub/Sub 或消息队列
        |
任意实例发布事件
        |
各实例向本机连接的用户广播
```

关键原则是：连接对象留在本机内存，跨实例传播的是业务事件。

## 14. 开发检查清单

- 是否使用 `wss://`。
- 是否验证连接的身份、权限和 `Origin`。
- 是否有服务端心跳与客户端重连。
- 是否限制消息大小、发送频率和连接数。
- 是否定义统一消息协议。
- 是否处理慢客户端和发送缓冲区堆积。
- 是否在多实例时通过 Redis 或消息队列分发事件。
- 是否让前端在重连后恢复订阅与遗漏事件。

## 15. 最小练习

1. 启动第 6 节的 Node.js WebSocket 服务端。
2. 在浏览器控制台运行第 4 节的客户端代码。
3. 修改服务端，让收到 `chat.send` 后广播给所有连接的客户端。
4. 为客户端添加第 9 节的指数退避重连。
5. 把 Agent OS 中 `codex exec --json` 的输出解析后，通过 WebSocket 推送到页面。

## 参考资料

- [RFC 6455: The WebSocket Protocol](https://www.rfc-editor.org/rfc/rfc6455)
- [WHATWG WebSockets Standard](https://websockets.spec.whatwg.org/)
