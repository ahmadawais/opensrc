import { confirm as clackConfirm } from "@clack/prompts";

export async function confirm(question: string): Promise<boolean> {
  const result = await clackConfirm({ message: question });
  if (typeof result !== "boolean") return false;
  return result;
}
