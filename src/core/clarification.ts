/*

 参考数据结构
  {
  "title": "确认用户详情需求",
  "intro": "以下选择会影响页面入口和验收范围。",
  "questions": [
    {
      "id": "entry",
      "prompt": "从哪里进入用户详情？",
      "recommendedOptionId": "name",
      "options": [
        { "id": "name", "label": "点击列表姓名" },
        { "id": "menu", "label": "从操作菜单进入" }
      ]
    }
  ]
 }

 */

import { z } from "zod";

const OptionSchema = z.object({
  id: z.string().regex(/^[a-z0-9_-]{1,32}$/),
  label: z.string().trim().min(1).max(100),
});

const QuestionSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9_-]{1,32}$/),
    prompt: z.string().trim().min(1).max(300),
    options: z.array(OptionSchema).min(2).max(4),
    recommendedOptionId: z
      .string()
      .regex(/^[a-z0-9_-]{1,32}$/)
      .optional(),
  })
  .superRefine((question, ctx) => {
    const optionIds = question.options.map((option) => option.id);
    if (new Set(optionIds).size !== optionIds.length) {
      ctx.addIssue({
        code: "custom",
        message: "同一道问题的选项 ID 不能重复",
        path: ["options"],
      });
    }
    if (
      question.recommendedOptionId &&
      !optionIds.includes(question.recommendedOptionId)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "推荐项必须指向当前问题中的选项",
        path: ["recommendedOptionId"],
      });
    }
  });

export const ClarificationRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(80).default("需求澄清"),
    intro: z.string().trim().max(300).optional().default(""),
    questions: z.array(QuestionSchema).min(1).max(5),
  })
  .superRefine((request, ctx) => {
    const questionIds = request.questions.map((question) => question.id);
    if (new Set(questionIds).size !== questionIds.length) {
      ctx.addIssue({
        code: "custom",
        message: "同一份澄清请求的问题 ID 不能重复",
        path: ["questions"],
      });
    }
  });

export type ClarificationRequest = z.infer<typeof ClarificationRequestSchema>;

// 可以从工具调用历史中提取出来最近的问题内容。
export function findClarificationRequest(
  toolCalls: Array<{ toolName: string; input: unknown }> | undefined,
): ClarificationRequest | undefined {
  for (let index = (toolCalls?.length ?? 0) - 1; index >= 0; index -= 1) {
    const call = toolCalls?.[index];
    if (call?.toolName !== "request_clarification") continue;
    const parsed = ClarificationRequestSchema.safeParse(call.input);
    if (parsed.success) return parsed.data;
  }
  return undefined;
}
