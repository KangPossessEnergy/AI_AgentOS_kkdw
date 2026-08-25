import { z } from 'zod';
import { CollaborationOrigin } from './product-spec';


//程序内部的交接单
export interface CollaborationMessage {
  dispatchId: string; //标识当前这一次投递
  taskId: string; //标识整项协作
  ownerOpenId: string; //整个任务的用户发起人，贯穿所有轮次。
  ownerUnionId?: string; //整个任务的用户发起人，贯穿所有轮次。
  fromBotId: string; //
  reportToBotId: string; //成员完成当前环节后，结果自动回到谁那里。
  objective: string; //这一轮协作要完成什么，直接展示在协作卡片上。
  instruction: string;//交给对方的完整要求。
  expectedOutput?: string;//期望产出，给接收方一个清晰的验收方向。
  toBotId: string;
  round: number;
  maxRounds: number;
  workspaceDir: string;
}

export function collaborationTurnKey(message: CollaborationMessage): string {
  return `${message.taskId}:${message.round}:${message.toBotId}`;
}

//做两件事：
// 发送前用 register() 登记, 目标 bot 收到任务编号后用consume() 领取。
// 领取时还会核对目标 bot，成功后立即删除。同一条派活消息不会再次执行，并发交接也不会互相覆盖。
export class CollaborationInbox {
  private readonly messages = new Map<string, CollaborationMessage>();

  register(message: CollaborationMessage): void {
    this.messages.set(message.dispatchId, message);
  }

  consume(
    dispatchId: string,
    toBotId: string,
  ): CollaborationMessage | undefined {
    const message = this.messages.get(dispatchId);
    if (!message || message.toBotId !== toBotId) return undefined;
    this.messages.delete(dispatchId);
    return message;
  }
}

export function collaborationOrigin(
  message: CollaborationMessage,
): CollaborationOrigin {
  return {
    taskId: message.taskId,
    fromBotId: message.fromBotId,
    reportToBotId: message.reportToBotId,
    round: message.round,
    maxRounds: message.maxRounds,
  };
}


export function buildCollaborationPrompt(
  message: CollaborationMessage,
): string {
  return [
    `协作目标：${message.objective}`,
    `执行要求：${message.instruction}`,
    message.expectedOutput
      ? `期望产出：${message.expectedOutput}`
      : '',
    `完成后，把结果交回 ${message.reportToBotId} 继续组织后续工作；已经可以交付时，明确给出最终结论。`,
  ].filter(Boolean).join('\n\n');
}





//给 dispatch_task 定义一份 Zod Schema，并补一个从工具调用里提取派发请求的函数：
 export const DispatchTaskRequestSchema = z.object({
   targetBotId: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,31}$/),
   objective: z.string().trim().min(1).max(200),
   instruction: z.string().trim().min(1).max(2_000),
   expectedOutput: z.string().trim().min(1).max(500).optional(),
 });

 export type DispatchTaskRequest = z.infer<typeof DispatchTaskRequestSchema>;

 export function findDispatchTaskRequest(
   toolCalls: Array<{ toolName: string; input: unknown }> | undefined,
 ): DispatchTaskRequest | undefined {
   for (let index = (toolCalls?.length ?? 0) - 1; index >= 0; index -= 1) {
     const call = toolCalls?.[index];
     if (call?.toolName !== 'dispatch_task') continue;
     const parsed = DispatchTaskRequestSchema.safeParse(call.input);
     if (parsed.success) return parsed.data;
   }
   return undefined;
 }