import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import app from "../src/server.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const casesPath = path.resolve(__dirname, "cases.json");

async function runEvals() {
  const cases = JSON.parse(fs.readFileSync(casesPath, "utf-8"));
  console.log(`\n======================================================`);
  console.log(`Running Evaluation Suite (${cases.length} test cases)`);
  console.log(`Model: ${process.env.LLM_MODEL || "openrouter/free"}`);
  console.log(`Stub Mode: ${process.env.LLM_STUB === "1" ? "ENABLED" : "DISABLED"}`);
  console.log(`======================================================\n`);

  // Start temporary server for testing
  const port = 3096;
  const server = app.listen(port);

  let categoryMatches = 0;
  let urgencyMatches = 0;
  let totalMatches = 0;
  const failures = [];

  try {
    for (let i = 0; i < cases.length; i++) {
      const testCase = cases[i];
      const startTime = Date.now();

      try {
        const res = await fetch(`http://localhost:${port}/triage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(testCase.input),
        });

        const elapsed = Date.now() - startTime;
        const body = await res.json();

        if (res.status !== 200) {
          failures.push({
            id: testCase.id,
            reason: `HTTP ${res.status}: ${JSON.stringify(body)}`,
          });
          console.log(`❌ [${testCase.id}] HTTP ${res.status} error (${elapsed}ms)`);
          continue;
        }

        const catMatch = body.category === testCase.expected.category;
        const urgMatch = body.urgency === testCase.expected.urgency;

        if (catMatch) categoryMatches++;
        if (urgMatch) urgencyMatches++;
        if (catMatch && urgMatch) totalMatches++;

        const statusIcon = catMatch && urgMatch ? "✅" : catMatch ? "⚠️" : "❌";

        console.log(
          `${statusIcon} [${testCase.id}] ` +
          `Cat: predicted="${body.category}" expected="${testCase.expected.category}" (${catMatch ? "OK" : "MISMATCH"}) | ` +
          `Urg: predicted="${body.urgency}" expected="${testCase.expected.urgency}" (${urgMatch ? "OK" : "MISMATCH"}) ` +
          `[conf=${body.confidence?.toFixed(2)}] (${elapsed}ms)`
        );

        if (!catMatch || !urgMatch) {
          failures.push({
            id: testCase.id,
            description: testCase.description,
            predicted: { category: body.category, urgency: body.urgency, reason: body.reason },
            expected: testCase.expected,
          });
        }
      } catch (err) {
        failures.push({
          id: testCase.id,
          reason: `Network/Execution error: ${err.message}`,
        });
        console.log(`❌ [${testCase.id}] Failed: ${err.message}`);
      }
    }
  } finally {
    server.close();
  }

  const categoryAccuracy = ((categoryMatches / cases.length) * 100).toFixed(1);
  const urgencyAccuracy = ((urgencyMatches / cases.length) * 100).toFixed(1);
  const fullAccuracy = ((totalMatches / cases.length) * 100).toFixed(1);

  console.log(`\n======================================================`);
  console.log(`Evaluation Results Summary:`);
  console.log(`Total Cases:           ${cases.length}`);
  console.log(`Category Accuracy:     ${categoryMatches}/${cases.length} (${categoryAccuracy}%)`);
  console.log(`Urgency Accuracy:      ${urgencyMatches}/${cases.length} (${urgencyAccuracy}%)`);
  console.log(`Perfect Match Rate:    ${totalMatches}/${cases.length} (${fullAccuracy}%)`);
  console.log(`======================================================`);

  if (failures.length > 0) {
    console.log(`\nFailed / Mismatched Cases (${failures.length}):`);
    failures.forEach((f) => {
      console.log(`- Case ${f.id}: expected ${JSON.stringify(f.expected)}, got ${JSON.stringify(f.predicted)}`);
    });
  } else {
    console.log(`\nAll ${cases.length} test cases passed perfectly!`);
  }

  return {
    total: cases.length,
    categoryMatches,
    urgencyMatches,
    totalMatches,
    categoryAccuracy,
    urgencyAccuracy,
    failures,
  };
}

if (process.argv[1] && process.argv[1].endsWith("run-evals.js")) {
  runEvals().catch((err) => {
    console.error("Eval runner fatal error:", err);
    process.exit(1);
  });
}

export { runEvals };
