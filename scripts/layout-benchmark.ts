import {
  BoxRenderable,
  defaultLayoutEngine,
  type LayoutEngine,
  RootRenderable,
} from "../packages/core/src/renderable";

type Scenario = "child-mutation" | "clean-frame" | "resize" | "single-prop";

const sizes = [100, 1000, 10_000] as const;
const scenarios: Scenario[] = [
  "clean-frame",
  "single-prop",
  "child-mutation",
  "resize",
];

for (const size of sizes) {
  for (const scenario of scenarios) {
    const result = benchmarkScenario(size, scenario, defaultLayoutEngine);
    console.log(
      [
        `layout:${scenario}`,
        `nodes=${size}`,
        `syncAndComputeMs=${result.syncAndComputeMs.toFixed(3)}`,
        `boundaryMs=${result.boundaryMs.toFixed(3)}`,
      ].join(" ")
    );
  }
}

function benchmarkScenario(
  size: number,
  scenario: Scenario,
  engine: LayoutEngine
): { boundaryMs: number; syncAndComputeMs: number } {
  const root = createTree(size);
  engine.compute(root, 120, 40);

  const boundaryStart = performance.now();
  if (!root.layoutDirty) {
    // Clean-frame benchmark intentionally measures the skip guard overhead.
  }
  const boundaryMs = performance.now() - boundaryStart;

  mutate(root, scenario);

  const computeStart = performance.now();
  if (root.layoutDirty) {
    engine.compute(root, scenario === "resize" ? 160 : 120, 40);
  }
  return {
    boundaryMs,
    syncAndComputeMs: performance.now() - computeStart,
  };
}

function createTree(size: number): RootRenderable {
  const root = new RootRenderable(120, 40);
  root.setLayoutProps({ flexDirection: "column", gap: 0 });
  for (let index = 0; index < size; index++) {
    root.add(new BoxRenderable({ flexGrow: 1, minHeight: 0 }));
  }
  return root;
}

function mutate(root: RootRenderable, scenario: Scenario): void {
  if (scenario === "clean-frame") {
    return;
  }
  if (scenario === "single-prop") {
    root.children[0]?.setLayoutProps({ minHeight: 1 });
    return;
  }
  if (scenario === "child-mutation") {
    root.add(new BoxRenderable({ flexGrow: 1 }));
    return;
  }
  root.width = 160;
}
