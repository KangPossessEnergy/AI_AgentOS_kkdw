import type { Bot, BotIdentity } from "../im/lark.js";
import type { ActiveRun } from "../core/task-abort.js";
import type { BotConfig } from "../core/bot-registry.js";
import type { CollaborationInbox } from "../core/collaboration.js";
import type { ClarificationFlowStore } from "../core/clarification.js";
import type { ProductSpecFlowStore } from "../core/product-spec.js";
import type { SessionManager } from "../core/session-manager.js";
import type { TeamRegistry } from "../core/team-registry.js";

// 一台已经连接飞书的 Bot
export interface BotRuntime {
  config: BotConfig;
  bot: Bot;
  identity: BotIdentity;
}

// 保存整个进程共同使用的状态
export interface AppRuntime {
  sessions: SessionManager;
  teamRegistry: TeamRegistry;
  activeRuns: Map<string, ActiveRun>;
  contextWindows: Map<string, number>;
  botRuntimes: Map<string, BotRuntime>;
  processedCollaborationTurns: Set<string>;
  collaborationInbox: CollaborationInbox;
  clarificationFlows: ClarificationFlowStore;
  productSpecFlows: ProductSpecFlowStore;
}
