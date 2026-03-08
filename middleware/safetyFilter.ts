import { Request, Response, NextFunction } from "express";

const DANGEROUS_PATTERNS: RegExp[] = [
  /import\s+os/i,
  /zipfile/i,
  /base64/i,
  /subprocess/i,
  /exec\(/i,
  /eval\(/i,
  /open\(/i,
  /write\(/i,
  /system\(/i,
  /rm\s+-rf/i,
  /chmod/i,
  /chown/i,
  /mkfs/i,
];

function isUnsafeInput(text: string): boolean {
  return DANGEROUS_PATTERNS.some((pattern) => pattern.test(text));
}

export function safetyFilter(req: Request, res: Response, next: NextFunction) {
  const message: string = req.body?.message || "";

  if (isUnsafeInput(message)) {
    return res.status(400).json({
      message: "Your request was blocked by safety filters.",
      reason: "Potentially unsafe or code-execution content detected.",
    });
  }

  next();
}

export default safetyFilter;
