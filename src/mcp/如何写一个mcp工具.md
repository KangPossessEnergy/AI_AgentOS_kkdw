# 如何写一个 MCP 工具

本文以本项目的 `clarification-server.ts`（向用户提问的工具）为例，说明如何基于 `@modelcontextprotocol/sdk` 编写一个通过 stdio 运行的 MCP 工具，并把它接入 Claude Code / Codex CLI。

## 整体结构

一个 MCP 工具由四部分组成：

1. **输入 Schema**（zod）：定义工具参数的形状和约束。
2. **McpServer 实例**：声明服务器名称和版本。
3. **registerTool**：注册工具名、描述、Schema 和处理函数。
4. **StdioServerTransport**：通过标准输入输出与宿主（CLI）通信。

最小完整示例（即 `src/mcp/clarification-server.ts` 的全部内容）：

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ClarificationRequestSchema } from "../core/clarification.js";
import { CLARIFICATION_TOOL_NAME } from "../cli/app-tools.js";

// 1. 创建服务器实例
const server = new McpServer({
  name: "agent-os",
  version: "1.0.0",
});

// 2. 注册工具
server.registerTool(
  CLARIFICATION_TOOL_NAME, // 工具名，如 "request_clarification"
  {
    title: "向用户提问",
    description: [
      "当产品需求仍有会实质影响方案的歧义时，调用此工具提交结构化问题。",
      "一次最多提交 5 个问题，每题提供 2 到 4 个清晰选项。",
      "提交后不要自行补全用户答案，本轮回复可以简短收束。",
    ].join(""),
    inputSchema: ClarificationRequestSchema, // 直接传 zod schema
  },
  // 3. 处理函数：参数已通过 schema 校验，可直接解构使用
  async ({ questions }) => ({
    content: [
      {
        type: "text",
        text: `已把 ${questions.length} 个结构化问题交给 Agent OS。`,
      },
    ],
  }),
);

// 4. 用 stdio 传输启动（顶层 await，ESM）
await server.connect(new StdioServerTransport());
```

## 第一步：用 zod 定义输入 Schema

工具的参数校验直接复用 zod schema，不需要手写 JSON Schema。参考 `src/core/clarification.ts`：

```ts
import { z } from "zod";

export const ClarificationRequestSchema = z.object({
  title: z.string().trim().min(1).max(80).default("需求澄清"),
  intro: z.string().trim().max(300).optional().default(""),
  questions: z.array(QuestionSchema).min(1).max(5),
});
```

要点：

- **约束写在 schema 里**：长度、数量、正则都交给 zod，处理函数拿到的就是合法数据。
- **跨字段校验用 `superRefine`**：例如"推荐项必须是选项之一"这类规则（见 `clarification.ts:39`）。
- **合理设置 `default`**：可选字段给默认值，处理函数里不用再判空。
- schema 同时是**类型来源**：`z.infer<typeof Schema>` 导出 TypeScript 类型，供其他模块使用。

## 第二步：写清 description

`description` 是给模型看的"使用说明书"，直接决定模型何时、如何调用工具。本项目的写法值得借鉴：

- 说明**触发条件**（"当需求仍有实质影响方案的歧义时"）；
- 说明**参数约束的意图**（"一次最多 5 个问题，每题 2 到 4 个选项"）；
- 说明**调用后的行为约定**（"不要自行补全用户答案"）。

## 第三步：实现处理函数

处理函数接收**已校验**的入参，返回 `{ content: [...] }`：

```ts
async ({ questions }) => ({
  content: [{ type: "text", text: `已把 ${questions.length} 个结构化问题交给 Agent OS。` }],
});
```

- 返回的 `text` 会作为工具结果回传给模型。
- 出错时抛异常即可，SDK 会把它转成 MCP 错误响应。
- 注意：本项目的 clarification 工具是"哑"工具——真正的交互逻辑在 CLI 适配层（`src/cli/claude-adapter.ts`、`src/cli/codex-adapter.ts`）拦截工具调用后完成。如果你也需要在宿主侧拦截，工具名要保持一致。

## 第四步：通过 stdio 启动

```ts
await server.connect(new StdioServerTransport());
```

**关键纪律：stdio 服务器的 stdout 是协议通道，绝对不要 `console.log`**，任何打印都会破坏 MCP 协议帧。调试信息请写 stderr（`console.error`）或文件。

## 第五步：接入宿主 CLI

服务器本身只是个可执行脚本，需要告诉 CLI 如何启动它。本项目在 `src/cli/app-tools.ts` 中处理：

- 开发态（`.ts`）：用 `node node_modules/tsx/dist/cli.mjs <server.ts>` 启动；
- 构建后（`.js`）：直接 `node <server.js>`。

然后生成各 CLI 的启动参数：

```ts
// Claude Code：--mcp-config 传 JSON
{
  mcpServers: {
    agent_os: { type: "stdio", command: "...", args: ["..."] }
  }
}

// Codex：-c 传配置项
mcp_servers.agent_os.command="..."
mcp_servers.agent_os.args=["..."]
```

工具名约定：服务器名为 `agent_os`、工具名为 `request_clarification` 时，Claude 侧看到的完整工具名是 `mcp__agent_os__request_clarification`（见 `app-tools.ts:4`），拦截或日志匹配时要用全名。

## 添加一个新工具的清单

1. 在 `src/core/` 定义并导出 zod schema（和对应类型）。
2. 在 `src/mcp/` 新建 server 文件（或加入现有 server），按上面的四段式注册工具。
3. 在 `src/cli/app-tools.ts` 中更新启动参数（新文件需要加入 `args`，或复用同一 server）。
4. 如需在宿主侧拦截调用，在 `claude-adapter.ts` / `codex-adapter.ts` 中按工具名匹配处理。
5. 本地验证：直接 `pnpm tsx src/mcp/your-server.ts` 启动后应阻塞等待 stdio 输入（Ctrl+C 退出即正常），再由 CLI 端到端联调。

## 常见坑

- **`console.log` 破坏协议**：stdio 模式下 stdout 只能走 SDK。
- **schema 过于宽松**：模型会传边界值，约束（min/max/正则）尽量在 schema 层收紧。
- **工具名不一致**：注册名、`app-tools.ts` 常量、适配层拦截名三处必须一致，建议像本项目一样用常量统一定义。
- **Node 版本**：项目要求 Node ≥ 22，低版本会在 SDK 依赖处直接报错。
