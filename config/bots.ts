/**
 * bots.json 文件中每个 bot 的配置项
 * id                  Agent OS 内部使用的稳定标识
 * appIdEnv            环境变量中存储的飞书应用 ID
 * appSecretEnv        环境变量中存储的飞书应用 Secret
 * defaultCli          默认使用的 CLI，支持 claude、codex、chatgpt 等。决定新话题默认交给Claude Code 还是 Codex
 * systemPrompt        给每台bot一份清晰的职责
 * 
 * 
 */


/**
 * 工作流：grill-with-docs → to-spec → to-tickets → implement → code-review
 * grill-me：纯拷问——问完直接开始开发了，对其结果在对话里
 * to-spec：把共识合成需求文档
 * to-tickets：把spec拆成一个个详细任务
 * implement：按TDD逐个实现。 TDD：测试驱动开发。
 * code-review：对着 diff 做一轮独立审查
 * 
 */