# Node.js 深入浅出：从运行时基础到中级后端开发

## 0. 学习目标

这份教程不是 Node.js API 速查表，而是一条面向后端开发的学习路径。完成全部内容后，你应该能够：

- 解释 Node.js 的运行时、事件循环、异步 I/O 和线程池是怎样配合工作的。
- 使用 TypeScript 编写结构清晰、可测试、可维护的 Node.js 服务。
- 设计 HTTP API、统一错误处理、参数校验、认证和权限控制。
- 正确处理数据库连接池、事务、缓存、消息队列和幂等。
- 理解流、背压、超时、取消、重试、限流和优雅关闭。
- 编写单元测试、集成测试和接口测试，并定位常见生产故障。
- 通过日志、指标和链路信息观察服务，而不是只依赖 `console.log`。
- 把一个 Node.js 项目打包、部署到生产环境，并知道常见的扩容方式。

本文默认你已经会基本 JavaScript。如果还不熟悉 TypeScript，可以先掌握以下语法：

- `type`、`interface`、联合类型和泛型。
- `async` / `await`、Promise。
- ES Module 的 `import` / `export`。
- 数组方法、解构、可选链和空值合并。

本项目目前使用：

```text
Node.js >= 22
TypeScript
tsx
pnpm
ES Module
```

对应配置可以查看：

```text
package.json
tsconfig.json
src/
```

---

## 1. Node.js 到底是什么

### 1.1 Node.js 不是 JavaScript 语言

JavaScript 是一门编程语言，Node.js 是一个运行时。

浏览器里的 JavaScript 通常可以访问：

```text
DOM、window、document、localStorage、fetch
```

Node.js 里的 JavaScript 可以访问：

```text
文件系统、网络、进程、环境变量、操作系统信号
```

Node.js 运行时主要由几部分组成：

```text
你的 JavaScript / TypeScript
        |
        v
V8 JavaScript 引擎
        |
        v
Node.js C++ 绑定
        |
        v
libuv、操作系统、文件系统、网络栈
```

- **V8** 负责解析和执行 JavaScript。
- **Node.js Core API** 提供 `fs`、`http`、`stream`、`child_process` 等能力。
- **libuv** 负责事件循环、异步网络 I/O、定时器和部分线程池任务。
- **操作系统** 最终负责 TCP、文件、进程、信号等底层资源。

### 1.2 Node.js 适合什么场景

Node.js 特别适合 I/O 密集型服务：

- HTTP API 和 BFF。
- WebSocket、SSE、实时通知。
- 网关、反向代理和 API 聚合。
- 文件上传、下载和流式处理。
- CLI 工具和自动化脚本。
- 消息消费、任务调度和 Agent 编排。

Node.js 不代表“所有工作都只有一个线程”。更准确的说法是：

> JavaScript 回调通常在一个主线程上执行；I/O 等待由操作系统或 libuv 处理，部分任务可以交给线程池或 Worker Thread。

Node.js 不适合直接在主线程里执行很重的 CPU 任务，例如：

- 大规模图片压缩。
- 大文件加密。
- 复杂机器学习计算。
- 递归搜索巨大状态空间。
- 对数百万条数据执行同步循环。

这些任务会阻塞事件循环，使所有请求一起变慢。

### 1.3 第一个 Node.js 程序

创建 `hello.mjs`：

```js
console.log("hello, Node.js");
console.log("进程 ID:", process.pid);
console.log("Node 版本:", process.version);
```

运行：

```bash
node hello.mjs
```

如果项目使用 TypeScript，可以使用本项目已经安装的 `tsx`：

```bash
pnpm exec tsx hello.ts
```

生产环境通常仍然会先把 TypeScript 编译成 JavaScript：

```bash
pnpm build
node dist/index.js
```

`tsx` 更适合开发期快速运行和调试。它不是完整的生产打包方案。

---

## 2. 进程、模块和项目结构

### 2.1 `package.json` 是项目的入口说明

一个后端项目至少应该明确：

```json
{
  "name": "example-service",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "node --test"
  },
  "engines": {
    "node": ">=22"
  }
}
```

常用字段：

- `type: "module"`：让 `.js` 文件默认使用 ES Module。
- `scripts`：把项目操作固化成团队统一命令。
- `dependencies`：运行时依赖。
- `devDependencies`：开发和构建工具。
- `engines`：声明支持的 Node.js 版本范围。
- `private: true`：防止内部服务被误发布到 npm。

不要把生产需要的依赖放进 `devDependencies`，否则生产安装时可能被跳过。

### 2.2 ES Module 和 CommonJS

ES Module：

```ts
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export async function readConfig(path: string): Promise<string> {
  return readFile(join(process.cwd(), path), "utf8");
}
```

CommonJS：

```js
const { readFile } = require("node:fs/promises");

module.exports = { readConfig };
```

新项目优先使用 ES Module。Node.js 内置模块推荐使用 `node:` 前缀：

```ts
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
```

这样可以明确这是 Node.js 内置模块，而不是第三方包。

### 2.3 ES Module 下的路径

ES Module 没有 CommonJS 的 `__dirname`。如果需要当前文件目录：

```ts
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = dirname(currentFile);
```

但是服务端代码通常应该使用明确的配置目录或 `process.cwd()`，不要过度依赖源文件相对路径。

### 2.4 推荐的后端目录结构

一个中小型 Node.js 服务可以这样组织：

```text
src/
  index.ts                 # 进程入口
  app/
    http-server.ts         # HTTP 启动和路由注册
    error-handler.ts       # 统一错误处理
  config/
    env.ts                 # 环境变量解析
  modules/
    users/
      user-route.ts        # 路由层
      user-service.ts      # 业务层
      user-repository.ts   # 数据访问层
      user-schema.ts       # 输入输出结构
  infra/
    database.ts            # 数据库连接
    logger.ts              # 日志
    metrics.ts             # 指标
  shared/
    errors.ts              # 通用错误
    result.ts              # 通用类型
tests/
```

分层的目的不是让文件变多，而是让每个模块有清晰边界：

```text
Route -> Service -> Repository -> Database
```

- Route 处理协议：HTTP 方法、路径、状态码、请求参数。
- Service 处理业务规则和事务边界。
- Repository 处理数据库查询。
- Database 处理连接池和底层客户端。

不要让路由函数直接堆几十行 SQL 和业务判断，否则后续很难测试和复用。

---

## 3. `process`、环境变量和配置

### 3.1 `process` 对象

```ts
console.log(process.argv);
console.log(process.env.NODE_ENV);
console.log(process.cwd());
console.log(process.pid);
```

常见用途：

- `process.argv`：命令行参数。
- `process.env`：环境变量。
- `process.cwd()`：启动命令所在的当前工作目录。
- `process.pid`：当前进程 ID。
- `process.exitCode`：设置退出码。
- `process.stdin` / `stdout` / `stderr`：标准输入输出。

不要在业务代码里到处直接读取 `process.env`。应在启动时集中解析一次：

```ts
type AppConfig = {
  nodeEnv: "development" | "test" | "production";
  port: number;
  databaseUrl: string;
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`缺少环境变量: ${name}`);
  return value;
}

function positiveInteger(name: string, fallback?: number): number {
  const raw = process.env[name]?.trim();
  if (!raw && fallback !== undefined) return fallback;

  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} 必须是正整数`);
  }
  return value;
}

export function loadConfig(): AppConfig {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  if (!["development", "test", "production"].includes(nodeEnv)) {
    throw new Error(`不支持的 NODE_ENV: ${nodeEnv}`);
  }

  return {
    nodeEnv: nodeEnv as AppConfig["nodeEnv"],
    port: positiveInteger("PORT", 3000),
    databaseUrl: required("DATABASE_URL"),
  };
}
```

配置解析应该尽早失败。应用启动成功后才发现数据库地址为空，会比启动时直接报错更难排查。

### 3.2 `.env` 的边界

`.env` 适合本地开发，不应该提交真实密钥：

```text
NODE_ENV=development
PORT=3000
DATABASE_URL=postgres://user:password@localhost:5432/app
```

注意：

- 把 `.env` 加入 `.gitignore`。
- 提交 `.env.example`，只保留变量名和示例值。
- 生产环境使用部署平台的 Secret 管理。
- 不要把 `process.env` 完整打印到日志。
- token、密码、app secret 不要进入异常信息。

### 3.3 配置的三层结构

推荐把配置分成三层：

```text
默认值 -> 环境变量 -> 启动参数
```

业务代码只依赖最终的 `AppConfig`，不关心值来自哪里。这样测试时可以直接注入配置：

```ts
export function createApp(config: AppConfig) {
  // 使用 config.port、config.databaseUrl，不直接读取 process.env
}
```

---

## 4. 异步编程：Promise、`async` 和错误

### 4.1 Promise 表示未来结果

```ts
function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function run(): Promise<void> {
  console.log("开始");
  await wait(100);
  console.log("结束");
}

void run();
```

`await` 会暂停当前 `async` 函数的后续执行，但不会阻塞整个 Node.js 线程。其他事件仍然可以继续进入事件循环。

### 4.2 顺序执行和并行执行

错误的并行场景：

```ts
const user = await getUser();
const permissions = await getPermissions();
const settings = await getSettings();
```

如果三个请求互不依赖，它们会被串行执行。更好的写法：

```ts
const [user, permissions, settings] = await Promise.all([
  getUser(),
  getPermissions(),
  getSettings(),
]);
```

但是，`Promise.all` 不是“越多越好”。一次并发创建几万条请求，可能压垮下游服务。需要使用并发限制：

```ts
async function mapWithConcurrency<T, R>(
  values: T[],
  limit: number,
  worker: (value: T) => Promise<R>,
): Promise<R[]> {
  if (limit < 1) throw new Error("并发数必须大于 0");

  const results = new Array<R>(values.length);
  let nextIndex = 0;

  async function consume(): Promise<void> {
    while (true) {
      const index = nextIndex++;
      if (index >= values.length) return;
      results[index] = await worker(values[index]);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(limit, values.length) },
      () => consume(),
    ),
  );
  return results;
}
```

使用：

```ts
const users = await mapWithConcurrency(userIds, 8, getUser);
```

### 4.3 `Promise.all`、`allSettled` 和 `race`

```ts
await Promise.all(tasks);
```

任何一个任务失败，整体立即拒绝。适用于“全部成功才有意义”的场景。

```ts
const results = await Promise.allSettled(tasks);
```

每个任务都会返回成功或失败状态。适用于批处理、批量通知和尽力而为的任务。

```ts
const result = await Promise.race([
  callRemoteService(),
  timeout(3_000),
]);
```

`Promise.race` 只返回最先完成的 Promise，但不会自动取消其他任务。超时之后，底层请求仍可能继续运行，因此生产代码应该配合 `AbortController`。

### 4.4 使用 `AbortController` 实现取消和超时

```ts
function timeoutSignal(milliseconds: number): AbortSignal {
  return AbortSignal.timeout(milliseconds);
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    signal: timeoutSignal(5_000),
  });

  if (!response.ok) {
    throw new Error(`上游返回 ${response.status}`);
  }
  return response.json();
}
```

如果要把用户取消、服务关闭和超时合并：

```ts
async function requestWithSignals(
  url: string,
  requestSignal: AbortSignal,
): Promise<Response> {
  const signal = AbortSignal.any([
    requestSignal,
    AbortSignal.timeout(5_000),
  ]);
  return fetch(url, { signal });
}
```

可取消性必须贯穿调用链。只在最外层设置超时，而底层数据库、HTTP 请求和队列消费不响应取消，仍然会泄漏资源。

### 4.5 不要忘记处理 Promise

下面的代码容易产生未处理拒绝：

```ts
function onMessage(): void {
  saveMessage();
}
```

如果 `saveMessage()` 返回的 Promise 失败，错误可能只能在全局事件里看到。改成：

```ts
function onMessage(): void {
  void saveMessage().catch((error) => {
    logger.error({ error }, "保存消息失败");
  });
}
```

或者让上层函数 `await` 它：

```ts
async function onMessage(): Promise<void> {
  await saveMessage();
}
```

`void` 不是吞掉错误的魔法，它只是明确表示“这里启动了一个不等待的异步任务”；不等待时仍然要有错误处理和生命周期管理。

---

## 5. 事件循环：Node.js 性能的核心

### 5.1 什么是事件循环

Node.js 会不断检查是否有待处理的回调：

```text
执行同步代码
    ↓
处理微任务
    ↓
处理定时器、I/O、setImmediate 等阶段
    ↓
回到微任务
    ↓
持续循环
```

事件循环让一个 JavaScript 主线程可以管理大量等待网络或文件的任务。

```ts
import { readFile } from "node:fs/promises";

console.log("A");

void readFile("large-file.txt", "utf8").then(() => {
  console.log("file");
});

setTimeout(() => console.log("timer"), 0);
setImmediate(() => console.log("immediate"));

console.log("B");
```

可以确定同步代码先输出 `A`、`B`。异步回调的相对顺序不要在不了解上下文时硬编码假设，尤其是 `setTimeout(0)` 和 `setImmediate()` 在不同入口下可能有差异。

### 5.2 微任务

常见微任务包括：

- Promise continuation。
- `queueMicrotask()`。

Node.js 还有 `process.nextTick()` 队列。它的优先级很高，滥用会让 I/O 长时间得不到执行：

```ts
function starve(): void {
  process.nextTick(starve);
}
```

不要用递归 `nextTick` 做长循环。大量同步计算也会阻塞事件循环：

```ts
function badHash(values: number[]): number {
  let result = 0;
  for (const value of values) {
    result = (result * 31 + value) % 1_000_000_007;
  }
  return result;
}
```

这段代码本身可能很快，但当 `values` 达到数千万甚至更大时，所有 HTTP 请求都要等待它结束。

### 5.3 如何发现事件循环被阻塞

症状包括：

- 请求平均耗时没有明显变化，但 P99 延迟突然升高。
- 定时器明显晚于预期执行。
- 所有接口一起变慢。
- CPU 使用率接近 100%。
- WebSocket 心跳超时。

排查方式：

```bash
node --trace-gc dist/index.js
```

也可以在应用里记录事件循环延迟。生产环境建议使用成熟的监控库，而不是只写一个定时器。基础示意：

```ts
let last = Date.now();

const timer = setInterval(() => {
  const now = Date.now();
  const expected = 1_000;
  const delay = now - last - expected;
  if (delay > 200) {
    console.warn({ delay }, "事件循环延迟过高");
  }
  last = now;
}, 1_000);

timer.unref();
```

### 5.4 CPU 任务的处理方式

有三种常见方案：

1. 把任务拆小，每次只计算一小段并让出事件循环。
2. 使用 `worker_threads` 把 CPU 计算移到 Worker。
3. 使用独立进程或任务队列，让专门的 Worker 服务处理。

在同一个服务内使用 `worker_threads` 的示意：

```ts
// worker.ts
import { parentPort } from "node:worker_threads";

if (!parentPort) throw new Error("必须在 Worker 中运行");

parentPort.on("message", (limit: number) => {
  let total = 0;
  for (let i = 0; i < limit; i += 1) {
    total += i;
  }
  parentPort.postMessage(total);
});
```

```ts
// main.ts
import { Worker } from "node:worker_threads";

function runWorker(limit: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./worker.ts", import.meta.url));
    worker.once("message", resolve);
    worker.once("error", reject);
    worker.once("exit", (code) => {
      if (code !== 0) reject(new Error(`Worker 退出码: ${code}`));
    });
    worker.postMessage(limit);
  });
}
```

生产环境不要每个请求都创建新 Worker。应该维护 Worker 池，或者把任务放进外部队列。

---

## 6. 文件系统：从简单读写到可靠持久化

### 6.1 异步 API 优先

```ts
import { readFile, writeFile } from "node:fs/promises";

const text = await readFile("data/input.txt", "utf8");
await writeFile("data/output.txt", text.toUpperCase(), "utf8");
```

服务端请求处理中尽量不要使用同步 API：

```ts
// 不推荐放在请求路径中
readFileSync("large-file.txt", "utf8");
```

同步 API 会阻塞事件循环。启动阶段读取一次小配置文件通常可以接受，但要明确它只发生在启动阶段。

### 6.2 路径处理

不要手工拼接路径：

```ts
const path = directory + "/" + fileName;
```

使用 `join`：

```ts
import { join, resolve } from "node:path";

const filePath = join(directory, fileName);
const absolute = resolve(filePath);
```

如果路径来自用户输入，要防止路径穿越：

```ts
import { relative, resolve } from "node:path";

function safeFilePath(root: string, userPath: string): string {
  const rootPath = resolve(root);
  const targetPath = resolve(rootPath, userPath);
  const relativePath = relative(rootPath, targetPath);

  if (relativePath.startsWith("..") || relativePath.includes("..")) {
    throw new Error("非法文件路径");
  }
  return targetPath;
}
```

还要考虑符号链接、大小写文件系统和权限，不要把字符串检查当作完整的安全边界。

### 6.3 原子写入

直接覆盖文件可能在进程崩溃时留下半个 JSON 文件：

```ts
await writeFile("data/state.json", JSON.stringify(state));
```

更可靠的做法是先写临时文件，再重命名：

```ts
import { rename, writeFile } from "node:fs/promises";

async function atomicWrite(path: string, content: string): Promise<void> {
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await writeFile(temporaryPath, content, "utf8");
  await rename(temporaryPath, path);
}
```

如果多个进程会同时写入，还需要文件锁、单写者模型或直接使用数据库。

### 6.4 JSON 文件存储的边界

JSON 文件适合：

- 本地开发配置。
- 很小的缓存。
- 单进程、低并发的状态。
- 调试和原型。

JSON 文件不适合：

- 多进程并发写。
- 多实例部署。
- 复杂查询。
- 需要事务的业务数据。
- 大量用户数据。

本项目的会话和流程状态使用 JSON 文件时，要特别注意进程重启、文件损坏、多实例不共享内存等问题。随着并发和可靠性要求提高，应迁移到数据库或专门的状态存储。

---

## 7. Stream 和背压

### 7.1 为什么需要流

如果一次性读取 2 GB 文件：

```ts
const content = await readFile("huge.log", "utf8");
```

进程需要把整个文件放入内存。流则把文件分成一小块一小块处理：

```ts
import { createReadStream, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";

await pipeline(
  createReadStream("input.log"),
  createWriteStream("output.log"),
);
```

Node.js 中常见的流：

- `Readable`：可读数据。
- `Writable`：可写数据。
- `Duplex`：既可读又可写。
- `Transform`：读取输入并产生转换后的输出。

### 7.2 `pipe` 和 `pipeline`

简单场景可以使用 `pipe`：

```ts
readable.pipe(writable);
```

生产代码更推荐 `pipeline`，它会统一处理错误和结束：

```ts
await pipeline(source, transform, destination);
```

HTTP 文件下载示例：

```ts
import { createReadStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import type { ServerResponse } from "node:http";

async function sendFile(
  response: ServerResponse,
  filePath: string,
): Promise<void> {
  response.writeHead(200, {
    "content-type": "application/octet-stream",
  });

  await pipeline(createReadStream(filePath), response);
}
```

### 7.3 什么是背压

当生产者产生数据的速度快于消费者写入速度时，数据会堆积在内存里。背压就是让生产者根据消费者的处理能力暂停或减速。

手写 Writable 时要尊重 `write()` 的返回值：

```ts
if (!writable.write(chunk)) {
  await once(writable, "drain");
}
```

直接忽略 `false` 可能导致内存持续增长。`pipeline` 会帮你连接流并处理很多背压细节。

### 7.4 Transform 示例

```ts
import { Transform } from "node:stream";

const uppercase = new Transform({
  transform(chunk, _encoding, callback) {
    callback(null, chunk.toString().toUpperCase());
  },
});
```

注意：不要假设每个 chunk 就是一行、一个 JSON 或一个完整业务消息。流只保证字节顺序，不保证业务边界。需要自己实现缓冲和拆包。

---

## 8. HTTP 服务：从原生模块到工程化 API

### 8.1 Node.js 原生 HTTP 服务

```ts
import { createServer } from "node:http";

const server = createServer((request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true }));
    return;
  }

  response.writeHead(404, { "content-type": "application/json" });
  response.end(JSON.stringify({ error: "not_found" }));
});

server.listen(3000, "127.0.0.1", () => {
  console.log("server listening on http://127.0.0.1:3000");
});
```

原生模块适合学习协议和写轻量服务。真实项目一般会使用成熟框架处理：

- 路由。
- 中间件。
- 参数解析。
- Schema 校验。
- 统一错误处理。
- 日志和请求上下文。

无论是否使用框架，底层原则都一样。

### 8.2 路由层应该做什么

路由层负责：

1. 识别 HTTP 方法和 URL。
2. 解析路径、查询参数和请求体。
3. 验证输入。
4. 调用 Service。
5. 映射响应状态码和响应结构。

路由层不应该负责：

- 直接编写复杂 SQL。
- 处理多个业务流程。
- 决定事务里所有细节。
- 在每个接口里复制一套错误处理。

### 8.3 统一响应结构

成功响应可以统一为：

```json
{
  "data": {
    "id": "user_123"
  },
  "requestId": "req_abc"
}
```

失败响应可以统一为：

```json
{
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "用户不存在"
  },
  "requestId": "req_abc"
}
```

不要把堆栈、SQL、内部路径和密钥放到客户端错误中。详细信息写入服务端日志，客户端只拿到稳定的错误码和适合展示的消息。

### 8.4 HTTP 状态码的基本语义

常见状态码：

| 状态码 | 含义 |
| --- | --- |
| `200` | 请求成功并返回结果 |
| `201` | 创建成功 |
| `202` | 已接受，异步任务正在处理 |
| `204` | 成功但无响应体 |
| `400` | 请求格式或参数错误 |
| `401` | 未认证 |
| `403` | 已认证但无权限 |
| `404` | 资源不存在 |
| `409` | 资源冲突 |
| `413` | 请求体过大 |
| `422` | 语义校验失败 |
| `429` | 请求过于频繁 |
| `500` | 服务端未知错误 |
| `502` | 上游服务返回异常 |
| `503` | 服务暂时不可用 |
| `504` | 上游服务超时 |

状态码不是装饰。客户端、网关、监控系统和重试逻辑都会依赖它。

### 8.5 请求体不能无限读取

原生 Node.js 读取 JSON body 的示意：

```ts
import type { IncomingMessage } from "node:http";

async function readBody(
  request: IncomingMessage,
  maxBytes = 1_000_000,
): Promise<unknown> {
  const chunks: Buffer[] = [];
  let total = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk)
      ? chunk
      : Buffer.from(chunk);
    total += buffer.length;
    if (total > maxBytes) {
      throw new Error("请求体过大");
    }
    chunks.push(buffer);
  }

  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : undefined;
}
```

生产环境还需要：

- 检查 `Content-Type`。
- 限制请求头大小。
- 限制 URL 长度。
- 设置请求超时。
- 对 JSON 深度、字段数量和字符串长度做限制。
- 对上传文件使用流，不要全部载入内存。

### 8.6 上游 HTTP 请求

调用上游服务时，至少要处理：

```text
连接超时
响应超时
DNS 失败
连接被重置
非 2xx 状态
响应体格式错误
重试导致重复写入
```

一个简化客户端：

```ts
type HttpClientOptions = {
  timeoutMs: number;
  retries: number;
};

async function requestJson<T>(
  url: string,
  options: RequestInit,
  clientOptions: HttpClientOptions,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= clientOptions.retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(clientOptions.timeoutMs),
      });

      if (!response.ok) {
        throw new Error(`上游状态码: ${response.status}`);
      }
      return await response.json() as T;
    } catch (error) {
      lastError = error;
      if (attempt === clientOptions.retries) break;
      await new Promise((resolve) => {
        setTimeout(resolve, 200 * 2 ** attempt);
      });
    }
  }

  throw lastError;
}
```

这个示例还不完整，生产中要根据错误类型判断是否重试。不要对所有 `POST` 无条件重试，否则可能造成重复扣款、重复创建或重复发送。

---

## 9. 数据库、Repository 和事务

### 9.1 数据库连接池

后端服务不应该每个请求都新建数据库连接：

```text
请求 1 -> 新建连接 -> 查询 -> 关闭
请求 2 -> 新建连接 -> 查询 -> 关闭
```

更合理的是连接池：

```text
服务启动 -> 创建有限连接池
请求到来 -> 借用连接
查询结束 -> 归还连接
服务关闭 -> 等待连接释放
```

连接池大小不是越大越好。连接数过大可能压垮数据库；连接数过小会让请求排队。要结合：

- 数据库最大连接数。
- 服务实例数量。
- 单请求查询耗时。
- 峰值并发。
- 是否有后台任务共用数据库。

### 9.2 Repository 只处理数据访问

```ts
type UserRecord = {
  id: string;
  email: string;
  status: "active" | "disabled";
};

interface UserRepository {
  findById(id: string): Promise<UserRecord | null>;
  insert(user: UserRecord): Promise<void>;
  updateStatus(id: string, status: UserRecord["status"]): Promise<void>;
}
```

Repository 的方法名应该表达业务数据访问意图，而不是到处暴露通用的 `query(sql)`。这样 Service 测试时可以注入内存实现或 mock。

### 9.3 Service 处理业务规则

```ts
class UserService {
  constructor(private readonly users: UserRepository) {}

  async disableUser(id: string): Promise<void> {
    const user = await this.users.findById(id);
    if (!user) throw new Error("USER_NOT_FOUND");
    if (user.status === "disabled") return;
    await this.users.updateStatus(id, "disabled");
  }
}
```

这里的“重复禁用是成功”就是一个幂等决定。要不要报冲突，应该由产品语义决定，而不是由数据库异常偶然决定。

### 9.4 事务的边界

如果多个写操作必须全部成功或全部回滚，就需要事务：

```ts
await db.transaction(async (tx) => {
  await tx.insertOrder(order);
  await tx.decreaseStock(order.productId, order.quantity);
  await tx.insertOutboxEvent({
    type: "order.created",
    orderId: order.id,
  });
});
```

事务里不要做慢的外部网络调用：

```text
开始数据库事务
    -> 写订单
    -> 调用支付服务 5 秒
    -> 写订单状态
提交事务
```

这样会长时间占用数据库连接和锁。常见做法是：

- 数据库事务只写本地状态。
- 同时写一条 Outbox 事件。
- 事务提交后由后台 Worker 投递事件。
- 消费者调用外部服务并更新状态。

### 9.5 SQL 注入和参数化

不要拼接用户输入：

```ts
const sql = `SELECT * FROM users WHERE email = '${email}'`;
```

使用参数化查询：

```ts
const result = await db.query(
  "SELECT * FROM users WHERE email = $1",
  [email],
);
```

参数化查询只能解决值注入，不能自动解决动态表名、排序字段和 SQL 片段。动态排序字段要使用白名单：

```ts
const sortColumns = {
  createdAt: "created_at",
  email: "email",
} as const;

const column = sortColumns[inputSort as keyof typeof sortColumns];
if (!column) throw new Error("非法排序字段");
```

---

## 10. 缓存、幂等和一致性

### 10.1 缓存适合解决什么

缓存可以降低：

- 重复读取数据库的成本。
- 访问慢上游的延迟。
- 热点数据的计算开销。

缓存不能替代数据库。设计缓存时要明确：

- key 的格式和命名空间。
- TTL。
- 缓存失效条件。
- 缓存击穿时的行为。
- 缓存数据是否允许短暂旧值。

### 10.2 Cache Aside

常见的 Cache Aside 流程：

```text
读取：
缓存命中 -> 返回
缓存未命中 -> 查数据库 -> 写缓存 -> 返回

写入：
写数据库 -> 删除缓存
```

伪代码：

```ts
async function getUser(id: string): Promise<UserRecord | null> {
  const key = `user:${id}`;
  const cached = await cache.get<UserRecord>(key);
  if (cached) return cached;

  const user = await repository.findById(id);
  if (user) await cache.set(key, user, { ttlSeconds: 60 });
  return user;
}
```

缓存更新和数据库提交之间存在短暂不一致。不要只看代码路径，要根据业务要求选择：

- 接受最终一致。
- 读写都绕过缓存。
- 使用版本号。
- 使用消息通知失效。
- 使用单写者或事件驱动更新。

### 10.3 幂等键

对于创建订单、支付、发送通知等操作，客户端可能因为超时而重试。服务端需要支持幂等：

```text
客户端生成 Idempotency-Key
        |
        v
服务端检查 key 是否已处理
        |
  已处理 -> 返回原结果
  未处理 -> 在事务中记录 key 并执行
```

幂等记录至少要保存：

- key。
- 用户或租户 ID。
- 请求指纹。
- 处理状态。
- 原始响应或资源 ID。
- 过期时间。

相同 key 但请求内容不同，应返回冲突，而不是复用旧结果。

---

## 11. 错误处理和领域错误

### 11.1 不要只抛字符串

```ts
throw "用户不存在";
```

这会丢失堆栈和错误类型。至少使用 `Error`：

```ts
throw new Error("用户不存在");
```

业务代码更适合定义领域错误：

```ts
export class AppError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode = 500,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super("NOT_FOUND", `${resource} 不存在`, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super("CONFLICT", message, 409);
  }
}
```

统一错误处理：

```ts
function toHttpError(error: unknown): {
  statusCode: number;
  code: string;
  message: string;
} {
  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      code: error.code,
      message: error.message,
    };
  }

  return {
    statusCode: 500,
    code: "INTERNAL_ERROR",
    message: "服务暂时不可用",
  };
}
```

### 11.2 全局错误事件不是业务处理器

可以监听：

```ts
process.on("uncaughtException", (error) => {
  logger.fatal({ error }, "未捕获异常");
  process.exitCode = 1;
});

process.on("unhandledRejection", (reason) => {
  logger.fatal({ reason }, "未处理 Promise 拒绝");
  process.exitCode = 1;
});
```

但全局监听器的主要作用是记录和触发退出流程，不是让进程继续承载不确定状态。出现未知异常后，进程可能已经处于部分损坏状态，应让进程管理器重启它。

### 11.3 错误分类

建议至少区分：

```text
客户端错误：参数非法、没有权限、资源不存在
业务冲突：重复创建、状态不允许转换
上游错误：第三方超时、限流、返回错误
基础设施错误：数据库不可用、磁盘满
程序错误：空指针、断言失败、状态不一致
```

不同类型的错误决定不同动作：

- 客户端错误通常不重试。
- 短暂上游错误可以有限重试。
- 数据库不可用可能触发熔断和降级。
- 程序错误应该报警并重启实例。

---

## 12. 认证、授权和安全边界

### 12.1 认证和授权不是一回事

- **认证 Authentication**：你是谁？
- **授权 Authorization**：你能做什么？

一个用户登录成功，不等于他可以访问所有租户、所有项目和所有操作。

### 12.2 不要信任客户端传来的身份

下面的做法有风险：

```ts
const userId = request.headers["x-user-id"];
```

除非这个请求已经经过可信网关签名并验证，否则客户端可以伪造这个 header。

一个完整流程通常包括：

```text
客户端凭证
    -> 网关或服务验证
    -> 解析用户身份
    -> 加载租户和角色
    -> 每个资源执行授权检查
```

### 12.3 最小权限

数据库账号、云服务账号和机器人账号都应遵循最小权限：

- 只访问需要的数据库。
- 只拥有需要的表或 API。
- 只在必要时允许写入。
- 生产和开发使用不同凭据。
- 密钥轮换，不写入源码和日志。

### 12.4 常见输入攻击

后端至少要防御：

- SQL 注入。
- 路径穿越。
- 原型污染。
- 命令注入。
- SSRF。
- 请求体耗尽内存。
- 正则表达式拒绝服务。
- 日志注入。

危险示例：

```ts
import { exec } from "node:child_process";

exec(`git clone ${userInput}`);
```

如果必须调用系统命令，优先使用参数数组形式：

```ts
import { execFile } from "node:child_process";

execFile("git", ["clone", repositoryUrl, targetDirectory]);
```

同时仍然要验证允许的协议、主机、路径和参数。`execFile` 不是自动安全许可证。

### 12.5 SSRF

如果服务端允许用户传入 URL 并代为请求，需要限制：

- 只允许 `https`。
- 限制域名白名单。
- 禁止访问内网 IP、云元数据地址和本机管理端口。
- 禁止自动跟随到不允许的地址。
- 设置连接和响应大小限制。
- 解析 DNS 后再次校验目标地址。

---

## 13. 子进程、CLI 和 Agent 编排

本项目的一个重要场景是由 Node.js 启动 Claude 或 Codex CLI，并读取它们的事件流。

### 13.1 `spawn`、`exec` 和 `execFile`

```text
spawn    适合长时间运行、持续读取 stdout/stderr
exec     适合短命令，先收集完整输出，存在 shell 注入风险
execFile 直接启动可执行文件，适合固定命令和参数数组
```

长任务应该使用 `spawn`：

```ts
import { spawn } from "node:child_process";

const child = spawn("codex", [
  "exec",
  "--json",
  "检查当前项目结构",
], {
  cwd: process.cwd(),
  env: process.env,
  stdio: ["ignore", "pipe", "pipe"],
});

child.stdout.setEncoding("utf8");
child.stdout.on("data", (chunk: string) => {
  for (const line of chunk.split("\n")) {
    if (line.trim()) console.log("stdout:", line);
  }
});

child.stderr.setEncoding("utf8");
child.stderr.on("data", (chunk: string) => {
  console.error("stderr:", chunk);
});

child.on("close", (code, signal) => {
  console.log({ code, signal }, "子进程结束");
});
```

本项目中可以重点阅读：

```text
src/cli/spawn-cli.ts
src/cli/runner.ts
src/cli/claude-adapter.ts
src/cli/codex-adapter.ts
src/app/cli-execution.ts
```

### 13.2 子进程生命周期

需要考虑：

- 子进程启动失败。
- CLI 不存在或没有权限。
- stdout 缓冲区积压。
- stderr 无限增长。
- 子进程卡住。
- 主进程退出时子进程残留。
- 用户取消任务。
- 子进程正常退出但业务输出不完整。

取消时：

```ts
child.kill("SIGTERM");
```

如果一段时间后仍不退出，再考虑：

```ts
child.kill("SIGKILL");
```

在 macOS/Linux 下，复杂的子进程树可能需要杀掉整个进程组，而不是只杀父进程。

### 13.3 JSONL 事件解析

JSONL 的边界是换行符，不是一次 `data` 回调：

```ts
let buffer = "";

child.stdout.on("data", (chunk: Buffer | string) => {
  buffer += chunk.toString();

  while (true) {
    const newlineIndex = buffer.indexOf("\n");
    if (newlineIndex < 0) break;

    const line = buffer.slice(0, newlineIndex);
    buffer = buffer.slice(newlineIndex + 1);
    if (!line.trim()) continue;

    try {
      const event = JSON.parse(line);
      handleEvent(event);
    } catch (error) {
      logger.warn({ error, line }, "无法解析 CLI JSONL");
    }
  }
});
```

一次 `data` 可能包含半行、几行或几百行。可靠解析器必须自己维护缓冲区。

### 13.4 子进程不是 API

如果你把 CLI 当作后端依赖，应该定义自己的适配器接口：

```ts
interface CliAdapter {
  id: "claude" | "codex";
  command: string;
  buildArgs(prompt: string): string[];
  parseEvents(line: string): CliEvent[];
}
```

这样上层只关心：

```text
启动任务
接收事件
取消任务
获取最终结果
```

而不需要知道不同 CLI 的参数和事件格式。这个思路正是本项目 `src/cli` 目录采用适配器结构的原因。

---

## 14. 任务、并发和状态机

### 14.1 用状态机管理长任务

不要用一堆布尔值描述任务：

```ts
{
  isRunning: true,
  isClosed: false,
  hasError: false,
  waiting: true
}
```

这些字段可以同时出现互相矛盾的组合。更清晰的是状态联合类型：

```ts
type TaskState =
  | { status: "creating" }
  | { status: "running"; startedAt: number }
  | { status: "waiting"; questionId: string }
  | { status: "succeeded"; completedAt: number }
  | { status: "failed"; errorCode: string }
  | { status: "cancelled"; cancelledAt: number };
```

状态转换也应该集中定义：

```ts
const transitions: Record<TaskState["status"], TaskState["status"][]> = {
  creating: ["running", "failed", "cancelled"],
  running: ["waiting", "succeeded", "failed", "cancelled"],
  waiting: ["running", "failed", "cancelled"],
  succeeded: [],
  failed: [],
  cancelled: [],
};
```

状态机的价值：

- 非法转换可以立即报错。
- 恢复逻辑更明确。
- UI、数据库和日志可以使用同一套状态。
- 测试可以覆盖每个状态和转换。

本项目的会话状态设计可以重点阅读：

```text
src/core/session-manager.ts
src/core/session-store.ts
src/core/task-progress.ts
src/core/task-abort.ts
```

### 14.2 内存 Map 的边界

```ts
const activeTasks = new Map<string, ActiveTask>();
```

适合：

- 单进程运行中的临时句柄。
- 子进程引用。
- 正在执行的 Promise。
- 去重集合。

不适合保存必须跨重启的数据。内存状态还会带来多实例问题：

```text
请求 1 -> 实例 A，实例 A 知道任务存在
请求 2 -> 实例 B，实例 B 不知道任务存在
```

解决方式：

- 使用共享数据库。
- 使用 Redis。
- 使用消息队列。
- 使用粘性会话，但它通常只是权宜之计。

### 14.3 竞态条件

典型问题：

```ts
if (!tasks.has(taskId)) {
  await createTask(taskId);
  tasks.set(taskId, task);
}
```

两个请求可能同时通过 `has` 判断，最终创建两次。需要使用：

- 数据库唯一约束。
- 原子 Redis 命令。
- 进程内锁。
- “正在创建”的 Promise 去重。

Promise 去重示意：

```ts
const pending = new Map<string, Promise<Task>>();

function getOrCreateTask(id: string): Promise<Task> {
  const current = pending.get(id);
  if (current) return current;

  const promise = createTask(id).finally(() => {
    pending.delete(id);
  });
  pending.set(id, promise);
  return promise;
}
```

这只解决单进程内的竞态；跨实例仍然需要外部协调。

---

## 15. 日志、指标和可观测性

### 15.1 日志不是随便打印文本

开发期可以：

```ts
console.log("任务开始", taskId);
```

生产环境更适合结构化日志：

```ts
logger.info({
  event: "task.started",
  taskId,
  botId,
  requestId,
}, "任务开始");
```

结构化日志方便搜索和聚合。建议至少包含：

- 时间。
- 日志级别。
- 事件名。
- `requestId`。
- `traceId`。
- 用户或租户的非敏感标识。
- 任务 ID。
- 耗时。
- 错误类型和堆栈。

### 15.2 不要记录敏感信息

禁止直接记录：

- access token。
- app secret。
- 密码。
- 完整身份证件或银行卡号。
- 未脱敏的用户消息。
- 完整 Cookie。

可以记录摘要、哈希、截断值或内部 ID。

### 15.3 指标

后端至少应该关注：

```text
请求量：requests_total
请求耗时：request_duration_ms
错误量：errors_total
当前并发：active_requests
数据库连接池等待数
队列积压数
事件循环延迟
进程内存和 CPU
```

不要只看平均耗时。平均值可能掩盖少量极慢请求，应同时关注 P50、P95、P99。

### 15.4 健康检查

建议区分：

```text
/health/live   进程还活着
/health/ready  可以接收流量
```

`live` 通常不检查数据库，否则数据库短暂故障可能导致编排系统不断重启所有实例。

`ready` 可以检查数据库、配置和关键依赖，但要设置超时，不能让健康检查本身拖垮服务。

---

## 16. 优雅关闭和信号

### 16.1 为什么要优雅关闭

进程被停止时，不能立刻丢弃：

- 正在发送的响应。
- 数据库事务。
- 正在写入的文件。
- 子进程。
- WebSocket 连接。
- 队列消息。

推荐流程：

```text
收到 SIGTERM
    ↓
停止接收新请求
    ↓
停止消费新任务
    ↓
等待正在执行的任务
    ↓
关闭 WebSocket、数据库和其他资源
    ↓
退出进程
```

### 16.2 基础实现

```ts
import { createServer } from "node:http";

const server = createServer(handler);
let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log({ signal }, "开始关闭服务");

  server.close();

  await Promise.all([
    closeDatabase(),
    stopWorkers(),
  ]);

  process.exitCode = 0;
}

process.once("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.once("SIGINT", () => {
  void shutdown("SIGINT");
});
```

实际代码还应该设置关闭超时：

```ts
const forceExitTimer = setTimeout(() => {
  console.error("优雅关闭超时，强制退出");
  process.exit(1);
}, 30_000);
forceExitTimer.unref();
```

要防止清理过程永远等待。每个资源关闭动作都应有自己的超时和错误处理。

---

## 17. TypeScript 工程实践

### 17.1 `strict` 不是负担

本项目的 `tsconfig.json` 使用：

```json
{
  "compilerOptions": {
    "strict": true
  }
}
```

严格模式会在编译阶段发现很多问题：

- 可能为 `undefined` 的值。
- 错误的函数参数。
- 未覆盖的联合类型分支。
- 隐式的 `any`。

不要用大量 `as any` 绕过类型系统。优先缩小类型：

```ts
function isString(value: unknown): value is string {
  return typeof value === "string";
}
```

### 17.2 `unknown` 优于 `any`

外部输入都应该先当作 `unknown`：

```ts
function parseMessage(input: unknown): Message {
  if (!isMessage(input)) {
    throw new Error("消息格式错误");
  }
  return input;
}
```

`any` 会关闭类型检查，适合极少数与第三方类型不完整的边界，不应该在核心业务层扩散。

### 17.3 类型不能替代运行时校验

下面的类型只在编译阶段存在：

```ts
type CreateUserInput = {
  email: string;
};
```

用户发来的 JSON 仍然可能是：

```json
{
  "email": 123
}
```

所以 HTTP、消息队列、文件和外部 CLI 的输入都要做运行时校验。项目已经使用 `zod`，可以定义：

```ts
import { z } from "zod";

const CreateUserSchema = z.object({
  email: z.string().email(),
});

const input = CreateUserSchema.parse(rawBody);
```

类型系统和 Schema 的职责不同：

```text
TypeScript：保护开发者和编译器之间的代码
Schema：保护服务和外部不可信输入之间的边界
```

### 17.4 避免隐式副作用

模块导入时就执行大量副作用，会让测试和复用变难：

```ts
// 导入模块就启动服务器，不利于测试
server.listen(3000);
```

更好的方式：

```ts
export function createServer(config: AppConfig) {
  return http.createServer(createHandler(config));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createServer(loadConfig());
  server.listen(3000);
}
```

也可以把入口和应用工厂拆开：

```text
createApp()     可测试，不监听端口
startServer()   绑定端口
src/index.ts    读取配置并启动
```

---

## 18. 测试：从函数到真实接口

### 18.1 测试层次

推荐从高价值到低成本组合：

```text
单元测试：纯函数、状态转换、业务规则
集成测试：Service + Repository + 测试数据库
接口测试：真实 HTTP 请求和响应
端到端测试：真实依赖或接近真实的环境
```

不要只写单元测试。路由、鉴权、数据库映射和序列化问题通常需要集成测试才能发现。

### 18.2 纯函数最容易测试

```ts
export function calculateRetryDelay(
  attempt: number,
  baseMs = 200,
  maxMs = 10_000,
): number {
  if (attempt < 0) throw new Error("attempt 不能小于 0");
  return Math.min(baseMs * 2 ** attempt, maxMs);
}
```

测试用例应覆盖：

```text
attempt=0
attempt=1
达到上限
负数输入
自定义 baseMs
```

### 18.3 测试替身

可以把外部依赖抽成接口：

```ts
interface Clock {
  now(): number;
}

class FixedClock implements Clock {
  constructor(private readonly value: number) {}
  now(): number {
    return this.value;
  }
}
```

业务逻辑不直接调用 `Date.now()`，而是注入 `Clock`。测试就不会依赖真实时间。

同样的思路适用于：

- 随机 ID。
- HTTP 客户端。
- 数据库。
- 文件系统。
- 队列。
- CLI。

### 18.4 接口测试的核心

至少覆盖：

- 正常成功路径。
- 参数错误。
- 未认证。
- 无权限。
- 资源不存在。
- 重复请求。
- 下游超时。
- 服务关闭时的行为。

接口测试应检查：

```text
状态码
响应头
响应 JSON 结构
错误码
副作用
幂等行为
```

不要只断言返回了 `200`，否则接口可能返回完全错误的业务结果。

### 18.5 测试命令

本项目当前主要提供：

```bash
pnpm build
```

建议逐步补充：

```json
{
  "scripts": {
    "test": "node --test",
    "test:watch": "node --test --watch",
    "lint": "eslint .",
    "check": "pnpm build && pnpm test"
  }
}
```

实际选用哪个测试框架，要根据团队偏好和项目复杂度决定。重要的是把验证命令固定在 `package.json`，让任何开发者和 CI 都能重复执行。

---

## 19. 性能和容量思维

### 19.1 先测量，再优化

不要凭感觉优化。先回答：

- 哪个接口慢？
- 慢在 CPU、数据库、网络还是锁？
- 影响平均延迟还是尾延迟？
- 是所有请求慢，还是特定输入慢？
- 优化后吞吐和错误率有没有变化？

一个简单耗时测量：

```ts
const startedAt = performance.now();

try {
  return await handler();
} finally {
  const durationMs = performance.now() - startedAt;
  logger.info({ durationMs }, "请求完成");
}
```

### 19.2 常见性能问题

- N+1 查询。
- 每次请求重复初始化客户端。
- 没有连接池。
- 把大文件全部读进内存。
- 无限制的 `Promise.all`。
- 同步文件 API 放在请求路径。
- JSON 序列化巨大对象。
- 日志打印完整大对象。
- 无界队列。
- 缺少分页。

### 19.3 分页

偏移分页简单：

```sql
SELECT *
FROM messages
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;
```

数据量大或翻页频繁时，游标分页通常更稳定：

```sql
SELECT *
FROM messages
WHERE created_at < $1
ORDER BY created_at DESC
LIMIT $2;
```

游标应包含足够的排序信息，最好使用稳定的组合键，例如：

```text
(created_at, id)
```

否则相同时间戳的数据可能重复或遗漏。

### 19.4 内存泄漏

常见原因：

- 永不清理的 `Map` 或数组。
- `setInterval` 没有 `clearInterval`。
- 事件监听器重复注册。
- 闭包持有大对象。
- 未消费的流。
- 未关闭的数据库连接。
- 任务失败后仍保留引用。

排查思路：

```text
观察 RSS 和 heapUsed
    -> 查看 GC 日志
    -> 做 heap snapshot
    -> 比较多个时间点的对象增长
    -> 找到持续被引用的根
```

不要只通过增大内存解决泄漏，那只是延迟故障。

---

## 20. 队列、重试和可靠任务

### 20.1 同步请求和异步任务

如果任务耗时较长，不要让 HTTP 请求一直保持连接：

```text
POST /reports
    -> 创建任务
    -> 返回 202 + taskId

GET /reports/:taskId
    -> 查询任务状态
```

或者通过 WebSocket/SSE 推送进度。无论采用哪种方式，任务状态都要持久化，不能只放在内存里。

### 20.2 重试要有边界

可靠重试需要：

- 最大尝试次数。
- 指数退避。
- 随机抖动。
- 可重试错误白名单。
- 幂等键或去重。
- 死信队列。
- 告警和人工处理入口。

重试公式示意：

```ts
function retryDelay(attempt: number): number {
  const base = Math.min(500 * 2 ** attempt, 30_000);
  const jitter = Math.floor(Math.random() * 500);
  return base + jitter;
}
```

### 20.3 至少一次投递意味着重复

消息系统常见的是“至少一次”投递。消费者可能因为：

```text
业务处理成功
    -> ACK 之前进程崩溃
    -> 消息重新投递
```

所以消费者必须幂等。不要假设消息只会到达一次。

### 20.4 Outbox 模式

在同一个数据库事务中写业务数据和待发送事件：

```text
事务：
  写订单
  写 outbox_events

后台 Worker：
  读取未发送事件
  调用消息系统
  标记已发送
```

这样可以避免“数据库写成功但事件没发出去”的问题。事件消费者仍要幂等，因为发送确认和状态更新之间也可能发生故障。

---

## 21. WebSocket 和实时通信

本项目已有 WebSocket 学习文档：

```text
Learn_Docs/02_websocket.md
```

这里补充后端工程注意事项。

实时连接需要维护：

- 连接身份。
- 订阅主题。
- 最后收到的事件 ID。
- 心跳和超时。
- 断线重连。
- 权限变化。
- 服务重启后的恢复。

实时事件建议使用统一信封：

```ts
type EventEnvelope<T> = {
  id: string;
  type: string;
  timestamp: string;
  payload: T;
};
```

发送事件时要考虑慢客户端。如果一个客户端消费很慢，不能让它无限占用内存。常见策略：

- 限制每个连接的发送队列长度。
- 队列超过阈值时断开连接。
- 客户端重连后通过事件 ID 补发。
- 对低价值事件只发送最新状态。

不要把 WebSocket 当作可靠消息队列。连接断开、消息丢失和客户端重连都必须有明确策略。

---

## 22. 部署和生产运行

### 22.1 开发和生产的区别

开发期：

```bash
pnpm exec tsx src/index.ts
```

生产期：

```bash
pnpm install --frozen-lockfile
pnpm build
NODE_ENV=production node dist/index.js
```

生产环境应固定：

- Node.js 大版本。
- lockfile。
- 构建命令。
- 启动命令。
- 环境变量。
- 健康检查。
- 关闭超时。

### 22.2 进程管理

Node.js 服务崩溃后需要被拉起。常见方式：

- 容器编排平台。
- systemd。
- PM2。
- 云平台托管运行时。

无论使用哪种方式，应用本身都要：

- 以非零退出码暴露启动失败。
- 正确处理 `SIGTERM`。
- 输出可采集的日志。
- 提供健康检查。
- 不在本地文件保存唯一业务状态。

### 22.3 多实例

扩容到多个实例后，以下内容不能只存内存：

- 登录会话。
- 任务状态。
- WebSocket 广播状态。
- 去重集合。
- 分布式锁。
- 定时任务执行记录。

需要迁移到共享组件或设计明确的分片策略。

### 22.4 容器中的信号

容器中要确保 Node.js 是能够接收 `SIGTERM` 的主进程，或使用正确的 init 进程转发信号。否则部署平台认为服务已停止，但 Node.js 没有执行优雅关闭。

### 22.5 配置和密钥

不要把环境变量在构建阶段烘焙进前端或镜像层。后端服务应在运行时注入配置，并限制日志、诊断接口和错误页面暴露的信息。

---

## 23. 结合本项目的阅读路线

可以按下面的顺序阅读本项目源码：

### 阶段一：启动和配置

```text
src/index.ts
src/core/bot-registry.ts
src/core/workspace.ts
```

重点问题：

- 配置文件如何读取和校验？
- 环境变量如何注入？
- 工作目录如何解析？
- 启动失败时错误在哪里抛出？

### 阶段二：会话和状态

```text
src/core/session-manager.ts
src/core/session-store.ts
src/core/task-progress.ts
src/core/task-abort.ts
```

重点问题：

- 会话状态有哪些？
- 进程重启后如何恢复？
- 哪些状态保存在文件，哪些状态只在内存？
- 用户取消任务后，底层 CLI 是否真正停止？

### 阶段三：CLI 子进程

```text
src/cli/spawn-cli.ts
src/cli/runner.ts
src/cli/claude-adapter.ts
src/cli/codex-adapter.ts
src/cli/native-sessions.ts
```

重点问题：

- 子进程如何启动、解析输出和结束？
- Claude 和 Codex 的差异如何被适配器隐藏？
- JSONL 半包如何处理？
- 退出码、信号和错误输出如何映射？

### 阶段四：飞书消息和卡片

```text
src/im/lark.ts
src/im/message-parser.ts
src/im/card.ts
src/app/command-handler.ts
src/app/card-action-handler.ts
```

重点问题：

- 外部消息如何解析和校验？
- 如何防止重复消费？
- 交互卡片动作如何关联原会话？
- 外部网络异常如何处理？

### 阶段五：业务编排

```text
src/app/collaboration-service.ts
src/app/clarification-runner.ts
src/app/product-spec-submission.ts
src/app/product-comment-runner.ts
```

重点问题：

- 产品、开发和 CEO 助理之间如何传递任务？
- 如何避免循环派发？
- 任务完成和消息发送之间是否存在重复或丢失？
- 哪些流程应该持久化到数据库？

---

## 24. 一个中级后端练习项目

建议实现一个“任务执行服务”，它和本项目的核心场景相似，但规模更小。

### 24.1 功能范围

实现以下接口：

```text
POST /tasks
GET  /tasks/:id
POST /tasks/:id/cancel
GET  /tasks/:id/events
GET  /health/live
GET  /health/ready
```

任务内容：

```json
{
  "command": "echo hello",
  "idempotencyKey": "client-generated-key"
}
```

安全要求：

- 不能直接执行任意用户命令。
- 只允许调用白名单命令。
- 限制参数长度。
- 限制任务运行时间。
- 限制并发数。

### 24.2 目标架构

```text
HTTP Route
    ↓
Input Schema
    ↓
Task Service
    ↓
Task Repository
    ↓
Database

Task Worker
    ↓
Child Process Adapter
    ↓
Event Store / Queue
```

### 24.3 最小验收标准

1. 创建任务返回 `202` 和任务 ID。
2. 相同幂等键和相同请求返回同一个任务。
3. 相同幂等键但不同请求返回 `409`。
4. 查询任务可以看到 `pending`、`running`、`succeeded`、`failed`、`cancelled`。
5. 取消任务能够真正终止子进程。
6. 子进程输出按事件流保存。
7. 请求超时不会让后台任务无限运行。
8. 进程收到 `SIGTERM` 时停止接收新任务并等待当前任务。
9. 数据库不可用时 `ready` 检查失败，但 `live` 不应因为数据库短暂故障而失败。
10. 测试覆盖成功、失败、取消、重复提交和重启恢复。

### 24.4 推荐实现顺序

```text
1. 纯函数状态机
2. 内存 Repository
3. HTTP 路由和参数校验
4. 子进程适配器
5. 任务取消和超时
6. JSONL 事件解析
7. 测试数据库
8. 持久化恢复
9. 日志和健康检查
10. 多实例和队列改造
```

先做一个可验证的纵向切片，再补充可靠性。不要一开始就搭建所有基础设施。

---

## 25. 中级后端能力检查表

### Node.js 运行时

- [ ] 能解释事件循环和微任务。
- [ ] 知道什么代码会阻塞主线程。
- [ ] 会使用 `worker_threads` 或外部 Worker 处理 CPU 任务。
- [ ] 能正确处理 `SIGTERM` 和子进程生命周期。

### TypeScript

- [ ] 开启 `strict`。
- [ ] 能设计清晰的领域类型。
- [ ] 能用 `unknown` 处理外部输入。
- [ ] 能用 Schema 做运行时校验。
- [ ] 能避免 `any` 在业务层扩散。

### HTTP

- [ ] 能设计资源、方法、状态码和错误结构。
- [ ] 能限制请求体、超时和并发。
- [ ] 能处理上游错误和有限重试。
- [ ] 能区分认证和授权。

### 数据

- [ ] 会使用连接池。
- [ ] 理解事务边界。
- [ ] 使用参数化查询。
- [ ] 理解缓存失效和最终一致性。
- [ ] 能设计幂等键。

### 异步任务

- [ ] 能设计任务状态机。
- [ ] 能处理至少一次投递和重复消费。
- [ ] 会设计 Outbox 或类似可靠投递方案。
- [ ] 能实现取消、超时、重试和死信。

### 可观测性

- [ ] 日志中有 request ID 或 trace ID。
- [ ] 能查看 P95/P99 延迟。
- [ ] 有 live 和 ready 健康检查。
- [ ] 能定位 CPU、内存、事件循环和数据库连接问题。

### 工程交付

- [ ] `pnpm build` 可重复执行。
- [ ] 测试命令固定在 `package.json`。
- [ ] 开发、测试和生产配置分离。
- [ ] 能进行优雅关闭和滚动发布。
- [ ] 多实例部署时不依赖本地内存保存唯一状态。

---

## 26. 常见误区

### 误区一：Node.js 是单线程，所以不能并发

错误。JavaScript 回调主要在一个线程执行，但 Node.js 可以并发等待大量 I/O，也可以使用线程池、Worker 和多个进程。

### 误区二：用了 `async` 就不会阻塞

错误。`async` 只改变 Promise 的写法。`async` 函数里面的同步计算仍然会阻塞事件循环。

### 误区三：`Promise.all` 就是并发控制

错误。它会同时启动所有 Promise。批量任务必须加并发上限。

### 误区四：请求超时后，任务就停止了

错误。HTTP 请求结束不代表底层数据库查询、上游请求或子进程已经停止。需要显式取消。

### 误区五：内存 Map 可以当数据库

错误。重启即丢失，多实例之间也不共享。

### 误区六：捕获异常后继续运行一定更稳定

错误。未知异常可能已经破坏进程状态。很多情况下记录错误并退出，让进程管理器重启更可靠。

### 误区七：状态码 `200` 就够了

错误。客户端需要通过状态码区分成功、参数错误、未授权、冲突、限流和服务不可用。

### 误区八：类型检查通过就安全

错误。TypeScript 类型不会验证用户实际发来的 JSON，也不能阻止 SQL 注入、路径穿越和权限漏洞。

---

## 27. 学习和实践建议

推荐采用以下节奏：

```text
阅读一个概念
    ↓
写一个最小可运行示例
    ↓
制造一个失败场景
    ↓
增加日志和测试
    ↓
思考重启、并发、超时和多实例
```

例如学习子进程时，不要只运行一次 `spawn`。还要测试：

- 命令不存在。
- 输出分成半行到达。
- stderr 很大。
- 子进程卡住。
- 用户中途取消。
- 主进程先收到 `SIGTERM`。
- 子进程返回非零退出码。

真正的中级后端能力，不是记住多少 API，而是能在不确定和失败的情况下保持系统可理解、可恢复、可验证。

