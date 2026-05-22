const AI_GUARD_KEY = process.env.AI_GUARD_KEY || "";

interface ExecutePolicyRequest {
  policyId: number;
  direction: "IN" | "OUT";
  content: string;
}

export type AiGuardVerdict = {
  action: "ALLOW" | "BLOCK";
  severity: string;
  direction: "IN" | "OUT";
  maskedContent: string;
  sendToApplication: boolean;
};

export type AiGuardErrorCode =
  | "missing_api_key"
  | "network"
  | "http_error"
  | "invalid_response";

export type AiGuardResult =
  | { ok: true; verdict: AiGuardVerdict }
  | { ok: false; code: AiGuardErrorCode; message: string; status?: number };

export async function runAiGuard(
  payload: ExecutePolicyRequest,
): Promise<AiGuardResult> {
  if (!AI_GUARD_KEY) {
    return {
      ok: false,
      code: "missing_api_key",
      message: "AI_GUARD_KEY is not set in the environment.",
    };
  }

  let response: Response;
  try {
    response = await fetch(
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
  } catch (err) {
    console.error("AI Guard network error:", err);
    return {
      ok: false,
      code: "network",
      message: "Could not reach the AI Guard service.",
    };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (err) {
    console.error("AI Guard invalid JSON:", err);
    return {
      ok: false,
      code: "invalid_response",
      message: "AI Guard returned a non-JSON response.",
      status: response.status,
    };
  }

  if (!response.ok) {
    const detail =
      typeof body === "object" &&
      body !== null &&
      "message" in body &&
      typeof (body as { message: unknown }).message === "string"
        ? (body as { message: string }).message
        : response.statusText;

    console.error("AI Guard API error:", response.status, detail);
    return {
      ok: false,
      code: "http_error",
      message: detail || `AI Guard request failed (${response.status}).`,
      status: response.status,
    };
  }

  const verdict = body as Record<string, unknown>;
  if (verdict.action !== "ALLOW" && verdict.action !== "BLOCK") {
    console.error("AI Guard unexpected payload:", body);
    return {
      ok: false,
      code: "invalid_response",
      message: "AI Guard response did not include a valid action.",
      status: response.status,
    };
  }

  return {
    ok: true,
    verdict: {
      action: verdict.action,
      severity: String(verdict.severity ?? ""),
      direction: (verdict.direction as "IN" | "OUT") ?? payload.direction,
      maskedContent: String(verdict.maskedContent ?? ""),
      sendToApplication: Boolean(verdict.sendToApplication),
    },
  };
}
