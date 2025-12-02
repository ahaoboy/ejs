import { writeFileSync } from "node:fs";
import { tests, players } from "./src/yt/solver/test/tests.ts";

const lines: string[] = [];

for (const test of tests) {
  const variants = test.variants ?? [...players.keys()];
  for (const variant of variants) {
    for (const step of test.n || []) {
      lines.push(`${test.player}-${variant} n ${step.input} ${step.expected}`);
    }
    for (const step of test.sig || []) {
      lines.push(`${test.player}-${variant} sig ${step.input} ${step.expected}`);
    }
  }
}

writeFileSync("cases.csv", lines.join("\n"));
