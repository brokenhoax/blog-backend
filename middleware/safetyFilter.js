const DANGEROUS_PATTERNS = [
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

function isUnsafeInput(text) {
  return DANGEROUS_PATTERNS.some((pattern) => pattern.test(text));
}

function safetyFilter(req, res, next) {
  const message = req.body?.message || "";

  if (isUnsafeInput(message)) {
    return res.status(400).json({
      reply: "Your request was blocked by safety filters.",
      reason: "Potentially unsafe or code-execution content detected.",
    });
  }

  next();
}

module.exports = safetyFilter;
