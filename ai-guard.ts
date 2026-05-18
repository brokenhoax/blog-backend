const AI_GUARD_KEY = process.env.AI_GUARD_KEY || "";

interface ExecutePolicyRequest {
  policyId: number;
  direction: "IN" | "OUT";
  content: string;
}
export async function runAiGuard(payload: ExecutePolicyRequest): Promise<{
  action: "ALLOW" | "BLOCK";
  severity: string;
  direction: "IN" | "OUT";
  maskedContent: string;
  sendToApplication: boolean;
}> {
  const response = await fetch(
    "https://api.zseclipse.net/v1/detection/execute-policy",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AI_GUARD_KEY}`,
      },
      body: JSON.stringify(payload),
    },
  );

  const verdict = await response.json();

  return {
    action: verdict.action,
    severity: verdict.severity,
    direction: verdict.direction,
    maskedContent: verdict.maskedContent,
    sendToApplication: verdict.sendToApplication,
  };
}
