// Lightweight user-agent parser that extracts OS name/version and a best-effort device model
// This is intentionally small and avoids large UA libraries to keep dependencies low.
function parseUA(ua) {
  if (!ua || typeof ua !== "string") return {};
  const s = ua;
  const lower = s.toLowerCase();

  const result = { ua: s };

  // OS name/version detection
  const iosMatch = s.match(/(iPhone|iPad).*OS\s([0-9_\.]+)/i);
  if (iosMatch) {
    result.os_name = "iOS";
    result.os_version = iosMatch[2].replace(/_/g, ".");
    result.device_type = iosMatch[1].toLowerCase().includes("ipad")
      ? "tablet"
      : "mobile";
  }

  if (!result.os_name) {
    const androidMatch = s.match(/Android\s([0-9\.]+)/i);
    if (androidMatch) {
      result.os_name = "Android";
      result.os_version = androidMatch[1];
      result.device_type = /mobile/i.test(s)
        ? "mobile"
        : /tablet/i.test(s)
        ? "tablet"
        : "mobile";
    }
  }

  if (!result.os_name) {
    if (/Windows NT/i.test(s)) {
      const m = s.match(/Windows NT\s([0-9\.]+)/i);
      result.os_name = "Windows";
      result.os_version = m ? m[1] : undefined;
      result.device_type = "desktop";
    } else if (/Mac OS X/i.test(s) || /Macintosh/i.test(s)) {
      const m = s.match(/Mac OS X\s([0-9_\.]+)/i);
      result.os_name = "macOS";
      result.os_version = m ? m[1].replace(/_/g, ".") : undefined;
      result.device_type = "desktop";
    }
  }

  // Best-effort device model extraction (very heuristic)
  const modelMatch = s.match(
    /\b(iPhone|iPad|Pixel\s[\dA-Za-z]+|SM-[A-Z0-9-]+|SM[A-Z0-9-]+|Mi[- ]\w+|Redmi|OnePlus|HUAWEI|Huawei|Nokia|OPPO|Vivo|Poco|MOTO|Moto[- ]\w+|XT[0-9]+|GT-[A-Z0-9]+)\b/i
  );
  if (modelMatch) {
    result.device_model = modelMatch[0];
  } else {
    // Sometimes the model appears inside parentheses as 'Build/XYZ' or after a semicolon
    const paren = s.match(/\(([^)]+)\)/);
    if (paren) {
      const inside = paren[1];
      // split on semicolons and try to pick a token that looks like a model
      const tokens = inside
        .split(/;|,|\)/)
        .map((t) => t.trim())
        .filter(Boolean);
      for (const t of tokens) {
        if (
          /\b(SM-|Pixel|Mi|Redmi|OnePlus|HUAWEI|OPPO|Vivo|Poco|MOTO|Moto)\b/i.test(
            t
          )
        ) {
          result.device_model = t;
          break;
        }
      }
    }
  }

  return result;
}

module.exports = { parseUA };
