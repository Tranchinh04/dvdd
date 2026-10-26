import { load } from "cheerio";
import { pathToFileURL } from "node:url";

const MAX_BYTES = 2_000_000;

// Fixed, anonymous, read-only checks. Never accept credentials or arbitrary URLs.
const checks = [
  { name: "login-form", url: "https://dvdd.casa/login.php", form: "login" },
  {
    name: "register-form",
    url: "https://dvdd.casa/register.php",
    form: "register",
  },
  {
    name: "otp-api",
    url: "https://api.dvdd-api.workers.dev?apiKey=otpflash-network-check-invalid&func=getOtp&orderCode=QA00000000000001",
  },
];

async function readLimited(response) {
  if (Number(response.headers.get("content-length")) > MAX_BYTES) {
    await response.body?.cancel();
    throw new Error("BODY_TOO_LARGE");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("EMPTY_BODY");
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) throw new Error("BODY_TOO_LARGE");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function runCheck(check, fetcher) {
  let status = null;
  try {
    const response = await fetcher(check.url, {
      method: "GET",
      headers: {
        Accept: check.form ? "text/html" : "application/json",
        "User-Agent": "DVDD-Workspace/1.0",
      },
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    status = response.status;
    const body = await readLimited(response);
    let code;
    if (!response.ok) {
      code = status === 403 ? "ACCESS_DENIED" : "HTTP_ERROR";
    } else if (check.form) {
      const $ = load(body);
      const form = $('input[name="emailAddress"]').closest("form");
      const fields = check.form === "login"
        ? ["emailAddress", "pass", "sessionKey"]
        : ["name", "emailAddress", "phone", "pass", "repass", "register"];
      const valid = fields.every((name) => form.find(`input[name="${name}"]`).length > 0);
      code = valid ? "FORM_AVAILABLE" : "FORM_UNAVAILABLE";
    } else {
      let data;
      try { data = JSON.parse(body); } catch { /* Never print supplier bodies. */ }
      // An invalid-key response confirms reachability, not a working account.
      code = data && (data.success === false || data.success === 0)
        ? "API_REACHABLE_INVALID_TEST_KEY"
        : "UNEXPECTED_API_RESPONSE";
    }
    return {
      name: check.name,
      status,
      ok: ["FORM_AVAILABLE", "API_REACHABLE_INVALID_TEST_KEY"].includes(code),
      code,
    };
  } catch {
    // Error strings, URLs, headers and response bodies may contain private data.
    return { name: check.name, status, ok: false, code: "CHECK_FAILED" };
  }
}

export async function checkDvdd(fetcher = fetch) {
  const results = await Promise.all(checks.map((check) => runCheck(check, fetcher)));
  return { ok: results.every((result) => result.ok), results };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await checkDvdd();
  for (const result of report.results) {
    console.log(`[DVDD preflight] ${result.name}: HTTP ${result.status ?? "n/a"}, ${result.code}`);
  }
  console.log("[DVDD preflight] Anonymous checks only; real login and account reads still require verification.");
  if (!report.ok) {
    console.warn("[DVDD preflight] Some DVDD features may be unavailable from this server. Review the checks before routing users here.");
    if (!process.argv.includes("--report-only")) process.exitCode = 1;
  }
}
