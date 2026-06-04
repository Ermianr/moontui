import { expect, test } from "bun:test";

import {
  type BenchmarkBackend,
  formatBenchmarkRow,
  runBenchmarkMatrix,
  runBenchmarkRow,
} from "../../../scripts/layout-benchmark";
import { nativeCustomLayoutEngine } from ".";
import { runBalancedFixture } from "./native-custom-layout.test.helpers";

test("benchmark harness records backend errors as rows", () => {
  const backend: BenchmarkBackend = {
    name: "typescript-fallback-oracle",
    create: () => ({
      compute() {
        throw new Error("Synthetic backend failure");
      },
    }),
  };

  const row = runBenchmarkRow(100, "flat", "clean-frame", backend);

  expect(row.error).toBe("synthetic-backend-failure");
  expect(formatBenchmarkRow(row)).toContain("error=synthetic-backend-failure");
});

test("single-prop benchmark rows declare one intended mutation node", () => {
  const [row] = runBenchmarkMatrix({
    backend: "typescript-fallback-oracle",
    scenario: "single-prop",
    shape: "flat",
    size: 100,
  });

  expect(row?.intendedMutationScope).toBe(1);
});

test("parity helpers compare backend output without backend node state", () => {
  const first = runBalancedFixture(nativeCustomLayoutEngine);
  const second = runBalancedFixture(nativeCustomLayoutEngine);

  expect(second).toEqual(first);
});

test("normal benchmark matrix excludes inactive backend rows", () => {
  const rows = runBenchmarkMatrix({
    scenario: "single-prop",
    shape: "flat",
    size: 100,
  });

  expect(rows.map((row) => row.backend)).toEqual([
    "native-custom",
    "typescript-fallback-oracle",
  ]);
});
