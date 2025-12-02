const enabled = true;

const times: Map<string, number[]> = new Map();
const stack: { name: string; start: number }[] = [];

export function trace<T>(name: string, fn: () => T): T {
  if (!enabled) return fn();

  const indent = "  ".repeat(stack.length);
  const start = performance.now();
  stack.push({ name, start });
  console.error(`${indent}[TRACE] → ${name}`);

  try {
    const result = fn();
    const elapsed = performance.now() - start;
    stack.pop();
    console.error(`${indent}[TRACE] ← ${name} (${elapsed.toFixed(2)}ms)`);

    if (!times.has(name)) times.set(name, []);
    times.get(name)!.push(elapsed);

    return result;
  } catch (e) {
    const elapsed = performance.now() - start;
    stack.pop();
    console.error(`${indent}[TRACE] ✗ ${name} (${elapsed.toFixed(2)}ms) ERROR`);
    throw e;
  }
}

export function traceAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
  if (!enabled) return fn();

  const indent = "  ".repeat(stack.length);
  const start = performance.now();
  stack.push({ name, start });
  console.error(`${indent}[TRACE] → ${name}`);

  return fn()
    .then((result) => {
      const elapsed = performance.now() - start;
      stack.pop();
      console.error(`${indent}[TRACE] ← ${name} (${elapsed.toFixed(2)}ms)`);
      if (!times.has(name)) times.set(name, []);
      times.get(name)!.push(elapsed);
      return result;
    })
    .catch((e) => {
      const elapsed = performance.now() - start;
      stack.pop();
      console.error(`${indent}[TRACE] ✗ ${name} (${elapsed.toFixed(2)}ms) ERROR`);
      throw e;
    });
}

export function printSummary() {
  if (!enabled || times.size === 0) return;

  console.error("\n[TRACE] ========== SUMMARY ==========");
  const sorted = [...times.entries()].sort(
    (a, b) => b[1].reduce((x, y) => x + y, 0) - a[1].reduce((x, y) => x + y, 0)
  );
  for (const [name, durations] of sorted) {
    const total = durations.reduce((a, b) => a + b, 0);
    const avg = total / durations.length;
    const calls = durations.length;
    console.error(
      `[TRACE] ${name}: ${total.toFixed(2)}ms total, ${avg.toFixed(2)}ms avg, ${calls} calls`
    );
  }
  console.error("[TRACE] ==================================\n");
}