import { readFile, writeFile } from "node:fs/promises";
import { basename, join, relative } from "node:path";
import nodemailer from "nodemailer";
import { config } from "./config";
import type { TestResult } from "./types";

function summarise(results: TestResult[]) {
  const total = results.length;
  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;
  const skipped = results.filter((r) => r.status === "skip").length;
  return { total, passed, failed, skipped };
}

export function generateConsoleReport(results: TestResult[]): void {
  const { total, passed, failed, skipped } = summarise(results);
  console.log("");
  console.log(`────────────────────────────────────────`);
  console.log(`Renisual smoke-test`);
  console.log(`Base: ${config.baseUrl}`);
  console.log(`Total: ${total}   ✅ ${passed}   ❌ ${failed}   ⏭ ${skipped}`);
  console.log(`────────────────────────────────────────`);
  if (failed > 0) {
    console.log("Failed tests:");
    for (const r of results.filter((r) => r.status === "fail")) {
      console.log(`  • ${r.suite} › ${r.name}`);
      if (r.error) console.log(`    ${r.error.split("\n")[0]}`);
      if (r.screenshotPath) console.log(`    screenshot: ${r.screenshotPath}`);
    }
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function generateHtmlReport(results: TestResult[]): string {
  const { total, passed, failed, skipped } = summarise(results);
  const ts = new Date().toISOString();

  const grouped = new Map<string, TestResult[]>();
  for (const r of results) {
    if (!grouped.has(r.suite)) grouped.set(r.suite, []);
    grouped.get(r.suite)!.push(r);
  }

  const sections = [...grouped.entries()]
    .map(([suite, items]) => {
      const rows = items
        .map((r) => {
          const stripe =
            r.status === "pass"
              ? "background:#dcfce7"
              : r.status === "skip"
              ? "background:#f5f5f4"
              : "background:#fee2e2";
          const icon = r.status === "pass" ? "✅" : r.status === "skip" ? "⏭" : "❌";
          const error = r.error ? `<pre style="white-space:pre-wrap;margin:4px 0 0 0;font-size:11px">${escapeHtml(r.error)}</pre>` : "";
          const shotRel = r.screenshotPath
            ? relative(config.reportDir, r.screenshotPath).split("\\").join("/")
            : "";
          const shot = shotRel
            ? `<a href="${shotRel}" target="_blank"><img src="${shotRel}" alt="screenshot" style="max-width:200px;border:1px solid #ccc;border-radius:4px"/></a>`
            : "—";
          const retry = r.attempts > 1 ? ` (retry ${r.attempts})` : "";
          return `
            <tr style="${stripe}">
              <td style="text-align:center">${icon}</td>
              <td>${escapeHtml(r.name)}${retry}${error}</td>
              <td>${r.duration} ms</td>
              <td>${shot}</td>
            </tr>`;
        })
        .join("");
      return `
        <h2 style="margin-top:24px">${escapeHtml(suite)}</h2>
        <table>
          <thead><tr><th></th><th>Test</th><th>Time</th><th>Screenshot</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`;
    })
    .join("");

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/>
<title>Renisual smoke-test — ${ts}</title>
<style>
  body { font-family: ui-monospace, monospace; max-width: 1000px; margin: 24px auto; padding: 0 16px; color: #111; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  h2 { font-size: 16px; border-top: 1px solid #ddd; padding-top: 16px; }
  .meta { color: #666; font-size: 13px; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 8px; border-bottom: 1px solid #eee; text-align: left; font-size: 13px; vertical-align: top; }
  th { background: #f5f5f5; font-weight: 600; }
  .ok { color: #166534; font-weight: 600; }
  .fail { color: #991b1b; font-weight: 600; }
  pre { font-family: ui-monospace, monospace; }
</style>
</head><body>
<h1>Renisual smoke-test</h1>
<p class="meta">${ts} · base <code>${escapeHtml(config.baseUrl)}</code></p>
<p>
  Total ${total} ·
  <span class="ok">✅ ${passed}</span> ·
  <span class="${failed > 0 ? "fail" : ""}">❌ ${failed}</span> ·
  ⏭ ${skipped}
</p>
${sections}
</body></html>`;
}

export async function writeReportFiles(results: TestResult[]): Promise<{ html: string; json: string }> {
  const html = generateHtmlReport(results);
  const htmlPath = join(config.reportDir, "report.html");
  const jsonPath = join(config.reportDir, "report.json");
  await writeFile(htmlPath, html, "utf8");
  await writeFile(
    jsonPath,
    JSON.stringify(
      {
        base: config.baseUrl,
        ts: new Date().toISOString(),
        ...summarise(results),
        results,
      },
      null,
      2
    ),
    "utf8"
  );
  return { html: htmlPath, json: jsonPath };
}

export async function sendEmailReport(results: TestResult[]): Promise<{ sent: boolean; reason?: string }> {
  const summary = summarise(results);
  if (summary.failed === 0) {
    return { sent: false, reason: "no failures" };
  }
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return { sent: false, reason: "SMTP env vars missing" };
  }
  const html = generateHtmlReport(results);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  const attachments = results
    .filter((r) => r.screenshotPath)
    .map((r) => ({ filename: basename(r.screenshotPath!), path: r.screenshotPath! }));
  const subject = `[Renisual] smoke-test FAILED — ${summary.failed}/${summary.total} on ${config.baseUrl}`;
  const reportPath = join(config.reportDir, "report.html");
  let reportBody = html;
  try {
    reportBody = await readFile(reportPath, "utf8");
  } catch {
    /* keep generated copy */
  }
  await transporter.sendMail({
    from: `"Renisual CI" <${process.env.SMTP_USER}>`,
    to: config.notifyEmail,
    subject,
    html: reportBody,
    attachments,
  });
  return { sent: true };
}
