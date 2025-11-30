// Small helper to extract the most likely client IP from common proxy headers
function getClientIp(req) {
  if (!req || typeof req !== "object") return null;
  // check common headers, prefer X-Forwarded-For and take first entry
  const headerOrder = [
    "x-forwarded-for",
    "cf-connecting-ip",
    "true-client-ip",
    "x-real-ip",
    "x-client-ip",
    "fastly-client-ip",
    "forwarded",
  ];

  for (const h of headerOrder) {
    const val = req.headers?.[h];
    if (!val) continue;
    // x-forwarded-for can contain a list
    const parts = String(val)
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length) return parts[0];
  }

  // fallback to req.ip or connection remote address
  if (req.ip) return req.ip;
  if (req.connection && req.connection.remoteAddress)
    return req.connection.remoteAddress;
  if (req.socket && req.socket.remoteAddress) return req.socket.remoteAddress;
  return null;
}

module.exports = { getClientIp };
