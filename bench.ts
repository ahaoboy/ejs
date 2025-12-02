import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";

const CASES_FILE = "cases.csv";
const PLAYERS_DIR = "src/yt/solver/test/players";
const JS_FILE = "run.js";

// Colors
const RED = "\x1b[0;31m";
const GREEN = "\x1b[0;32m";
const YELLOW = "\x1b[1;33m";
const BLUE = "\x1b[0;34m";
const NC = "\x1b[0m";

// Parse arguments
let maxTests = 0;
const runtimes: string[] = [];

const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === "-n" || args[i] === "--count") {
    maxTests = parseInt(args[++i], 10);
  } else {
    runtimes.push(args[i]);
  }
}

if (runtimes.length === 0) {
  runtimes.push("bun", "node", "deno");
}

if (!existsSync(JS_FILE)) {
  console.error(`${RED}Error: Cannot find ${JS_FILE}${NC}`);
  process.exit(1);
}

console.log(`${BLUE}JS file: ${JS_FILE}${NC}`);
console.log(`${BLUE}Cases file: ${CASES_FILE}${NC}`);
console.log(`${BLUE}Players dir: ${PLAYERS_DIR}${NC}`);
console.log(`${BLUE}Max tests: ${maxTests > 0 ? maxTests : "all"}${NC}`);
console.log("");

function getCmd(runtime: string): string | null {
  switch (runtime) {
    case "bun":
      return `bun ${JS_FILE}`;
    case "node":
      return `node ${JS_FILE}`;
    case "deno":
      return `deno --allow-read ${JS_FILE}`;
    default:
      return null;
  }
}

interface TestCase {
  player: string;
  type: "n" | "sig";
  input: string;
  expected: string;
}

interface TestResult {
  runtime: string;
  passed: number;
  failed: number;
  total: number;
  duration: number;
}

function loadCases(): TestCase[] {
  const content = readFileSync(CASES_FILE, "utf-8");
  return content
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => {
      const [player, type, input, expected] = line.split(" ");
      return { player, type: type as "n" | "sig", input, expected };
    });
}

function runTests(runtime: string): TestResult {
  const cmd = getCmd(runtime);
  if (!cmd) {
    console.error(`${RED}Unknown runtime: ${runtime}${NC}`);
    return { runtime, passed: 0, failed: 0, total: 0, duration: 0 };
  }

  console.log(`${BLUE}Testing runtime: ${YELLOW}${runtime}${NC}`);
  console.log(`${BLUE}Command: ${cmd}${NC}`);
  console.log("----------------------------------------");

  const cases = loadCases();
  const startTime = performance.now();

  // Group by player
  const grouped = new Map<string, TestCase[]>();
  let testCount = 0;

  for (const c of cases) {
    if (maxTests > 0 && testCount >= maxTests) break;
    if (!grouped.has(c.player)) grouped.set(c.player, []);
    grouped.get(c.player)!.push(c);
    testCount++;
  }

  let passed = 0;
  let failed = 0;
  let total = 0;

  for (const [player, tests] of grouped) {
    const playerFile = `${PLAYERS_DIR}/${player}`;
    if (!existsSync(playerFile)) continue;

    const nArgs = tests
      .filter((t) => t.type === "n")
      .map((t) => `n:${t.input}`)
      .join(" ");
    const sigArgs = tests
      .filter((t) => t.type === "sig")
      .map((t) => `sig:${t.input}`)
      .join(" ");

    const fullCmd = `${cmd} ${playerFile} ${nArgs} ${sigArgs}`.trim();

    let output = "";
    try {
      output = execSync(fullCmd, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
    } catch (e: unknown) {
      if (e && typeof e === "object" && "stdout" in e) {
        output = (e as { stdout: string }).stdout || "";
      }
    }

    for (const test of tests) {
      total++;
      const expected = `"${test.input}":"${test.expected}"`;
      if (output.includes(expected)) {
        passed++;
      } else {
        failed++;
        console.log(`${RED}FAIL${NC}: ${player} ${test.type}`);
        console.log(`  Input: ${test.input}`);
        console.log(`  Expected: ${test.expected}`);
      }
    }
  }

  const duration = (performance.now() - startTime) / 1000;

  console.log("");
  if (failed === 0) {
    console.log(`${GREEN}Results: ${passed}/${total} passed${NC} (${duration.toFixed(3)}s)`);
  } else {
    console.log(`${YELLOW}Results: ${passed}/${total} passed, ${failed} failed${NC} (${duration.toFixed(3)}s)`);
  }
  console.log("");

  return { runtime, passed, failed, total, duration };
}

// Run tests for each runtime
const results: TestResult[] = [];
for (const runtime of runtimes) {
  results.push(runTests(runtime));
}

// Print summary
console.log("========================================");
console.log(`${BLUE}SUMMARY${NC}`);
console.log("========================================");
console.log(
  "Runtime".padEnd(10) +
    "Passed".padStart(8) +
    "Failed".padStart(8) +
    "Total".padStart(8) +
    "Time".padStart(12)
);
console.log("----------------------------------------");

for (const r of results) {
  const color = r.failed === 0 ? GREEN : YELLOW;
  console.log(
    `${color}${r.runtime.padEnd(10)}${r.passed.toString().padStart(8)}${r.failed.toString().padStart(8)}${r.total.toString().padStart(8)}${(r.duration.toFixed(3) + "s").padStart(12)}${NC}`
  );
}