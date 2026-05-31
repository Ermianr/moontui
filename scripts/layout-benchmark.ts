import {
  BoxRenderable,
  defaultLayoutEngine,
  type LayoutEngine,
  RootRenderable,
  taffyLayoutEngine,
} from "../packages/core/src/renderable";

type BackendName = "taffy" | "typescript";
type Scenario =
  | "child-mutation"
  | "clean-frame"
  | "full-recompute"
  | "resize"
  | "single-prop";

const sizes = [100, 1000, 10_000] as const;
const backends: { engine: LayoutEngine; name: BackendName }[] = [
  { name: "typescript", engine: defaultLayoutEngine },
  { name: "taffy", engine: taffyLayoutEngine },
];
const scenarios: Scenario[] = [
  "clean-frame",
  "full-recompute",
  "single-prop",
  "child-mutation",
  "resize",
];

for (const backend of backends) {
  for (const size of sizes) {
    for (const scenario of scenarios) {
      const result = benchmarkScenario(size, scenario, backend.engine);
      console.log(
        [
          `layout:${scenario}`,
          `backend=${backend.name}`,
          `nodes=${size}`,
          `totalBackendMs=${result.totalBackendMs.toFixed(3)}`,
          `cleanSkipMs=${result.cleanSkipMs.toFixed(3)}`,
        ].join(" ")
      );
    }
  }
}

function benchmarkScenario(
  size: number,
  scenario: Scenario,
  engine: LayoutEngine
): { cleanSkipMs: number; totalBackendMs: number } {
  const root = createTree(size);
  engine.compute(root, 120, 40);

  const cleanSkipStart = performance.now();
  if (!root.layoutDirty) {
    // Clean-frame benchmark intentionally measures the skip guard overhead.
  }
  const cleanSkipMs = performance.now() - cleanSkipStart;

  mutate(root, scenario);

  const computeStart = performance.now();
  if (root.layoutDirty) {
    engine.compute(root, scenario === "resize" ? 160 : 120, 40);
  }
  return {
    cleanSkipMs,
    totalBackendMs: performance.now() - computeStart,
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
  if (scenario === "full-recompute") {
    root.markLayoutDirty();
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
