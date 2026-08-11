//程序内部的交接单
export interface CollaborationMessage {
  dispatchId: string; //标识当前这一次投递
  taskId: string; //标识整项协作
  fromBotId: string; //
  toBotId: string;
  round: number;
  maxRounds: number;
  workspaceDir: string;
  prompt: string;
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
