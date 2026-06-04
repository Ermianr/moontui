import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import {
  BoxRenderable,
  emptyLayoutCounters,
  type InstrumentedLayoutEngine,
  type LayoutComputeTimings,
  type LayoutEngine,
  type LayoutInstrumentationCounters,
  NativeCustomLayoutEngine,
  type Renderable,
  RootRenderable,
  TextRenderable,
  TypeScriptLayoutEngine,
} from "../packages/core/src/renderable";

export type BackendName = "native-custom" | "typescript-fallback-oracle";
export type TreeShape = "balanced" | "deep" | "flat" | "mixed-dashboard";
export type Scenario =
  | "child-mutation"
  | "clean-frame"
  | "cold-build"
  | "full-recompute"
  | "resize"
  | "single-prop";

export interface BenchmarkBackend {
  create: () => BenchmarkEngine;
  name: BackendName;
}

interface BenchmarkEngine extends LayoutEngine {
  computeWithTimings?: (
    root: RootRenderable,
    width: number,
    height: number
  ) => LayoutComputeTimings;
  destroy?: () => void;
  getInstrumentationCounters?: () => LayoutInstrumentationCounters;
}

export interface BenchmarkResult extends LayoutComputeTimings {
  backend: BackendName;
  cleanSkipMs: number;
  computeCalls: number;
  error: string;
  intendedMutationScope: number;
  mutationMs: number;
  nodeCount: number;
  readbackCount: number;
  rectangleApplications: number;
  relationshipUpdates: number;
  scenario: Scenario;
  setupMs: number;
  shape: TreeShape;
  styleUpdates: number;
  synchronizationMs: number;
  touchedNodes: number;
}

const RESULTS_PATH = "openspec/evidence/layout-benchmark-results.txt";
const sizes = [100, 1000] as const;
const backends: BenchmarkBackend[] = [
  { name: "native-custom", create: () => new NativeCustomLayoutEngine() },
  {
    name: "typescript-fallback-oracle",
    create: () => new TypeScriptLayoutEngine(),
  },
];
const shapes: TreeShape[] = ["flat", "deep", "balanced", "mixed-dashboard"];
const scenarios: Scenario[] = [
  "cold-build",
  "clean-frame",
  "full-recompute",
  "single-prop",
  "child-mutation",
  "resize",
];
const LEADING_DASHES = /^--/;

if (import.meta.main) {
  const filters = parseFilters(Bun.argv.slice(2));
  const rows = runBenchmarkMatrix(filters).map(formatBenchmarkRow);
  const output = rows.join("\n");
  await mkdir(dirname(RESULTS_PATH), { recursive: true });
  await Bun.write(RESULTS_PATH, `${output}\n`);
  console.log(output);
}

export function runBenchmarkMatrix(
  filters: {
    backend?: BackendName;
    scenario?: Scenario;
    shape?: TreeShape;
    size?: number;
  } = {}
): BenchmarkResult[] {
  const results: BenchmarkResult[] = [];
  for (const backend of filteredBackends(filters.backend)) {
    for (const size of filteredSizes(filters.size)) {
      for (const shape of filteredShapes(filters.shape)) {
        for (const scenario of filteredScenarios(filters.scenario)) {
          results.push(runBenchmarkRow(size, shape, scenario, backend));
        }
      }
    }
  }
  return results;
}

function filteredBackends(backend: BackendName | undefined) {
  return backends.filter(
    (candidate) => backend === undefined || candidate.name === backend
  );
}

function filteredSizes(size: number | undefined) {
  return sizes.filter((candidate) => size === undefined || candidate === size);
}

function filteredShapes(shape: TreeShape | undefined) {
  return shapes.filter(
    (candidate) => shape === undefined || candidate === shape
  );
}

function filteredScenarios(scenario: Scenario | undefined) {
  return scenarios.filter(
    (candidate) => scenario === undefined || candidate === scenario
  );
}

export function runBenchmarkRow(
  targetSize: number,
  shape: TreeShape,
  scenario: Scenario,
  backend: BenchmarkBackend
): BenchmarkResult {
  try {
    return benchmarkScenario(targetSize, shape, scenario, backend);
  } catch (error) {
    const nodeCount = expectedNodeCount(targetSize, shape, scenario);
    return {
      ...emptyTimingFields(),
      ...counterFields(emptyLayoutCounters()),
      backend: backend.name,
      cleanSkipMs: 0,
      error: sanitizeBenchmarkError(error),
      intendedMutationScope: intendedMutationScope(nodeCount, scenario),
      mutationMs: 0,
      nodeCount,
      scenario,
      setupMs: 0,
      shape,
      synchronizationMs: 0,
    };
  }
}

export function formatBenchmarkRow(result: BenchmarkResult): string {
  return benchmarkFields([
    `layout:${result.scenario}`,
    `backend=${result.backend}`,
    `shape=${result.shape}`,
    `nodes=${result.nodeCount}`,
    `setupMs=${result.setupMs.toFixed(3)}`,
    `mutationMs=${result.mutationMs.toFixed(3)}`,
    `synchronizationMs=${result.synchronizationMs.toFixed(3)}`,
    `nativeComputeMs=${result.nativeComputeMs.toFixed(3)}`,
    `readbackCount=${result.readbackCount}`,
    `rectangleApplicationMs=${result.rectangleApplicationMs.toFixed(3)}`,
    `rectangleApplications=${result.rectangleApplications}`,
    `totalBackendMs=${result.totalBackendMs.toFixed(3)}`,
    `intendedMutationScope=${result.intendedMutationScope}`,
    `touchedNodes=${result.touchedNodes}`,
    `styleUpdates=${result.styleUpdates}`,
    `relationshipUpdates=${result.relationshipUpdates}`,
    `computeCalls=${result.computeCalls}`,
    `flatteningMs=${result.flatteningMs.toFixed(3)}`,
    `relationshipConstructionMs=${result.relationshipConstructionMs.toFixed(3)}`,
    `ffiInputMs=${result.ffiInputMs.toFixed(3)}`,
    `ffiOutputMs=${result.ffiOutputMs.toFixed(3)}`,
    `cleanSkipMs=${result.cleanSkipMs.toFixed(3)}`,
    `error=${result.error}`,
  ]).join(" ");
}

function benchmarkFields(baseFields: string[]): string[] {
  return baseFields;
}

function benchmarkScenario(
  targetSize: number,
  shape: TreeShape,
  scenario: Scenario,
  backend: BenchmarkBackend
): BenchmarkResult {
  const setupStart = performance.now();
  const root = createTree(targetSize, shape);
  const engine = backend.create();
  try {
    if (scenario === "cold-build") {
      const timings = compute(engine, root, 120, 40);
      const counters = instrumentationCounters(engine);
      return makeResult({
        backend,
        cleanSkipMs: 0,
        counters,
        error: "",
        mutationMs: 0,
        nodeCount: countNodes(root),
        scenario,
        setupMs: timings.totalBackendMs,
        shape,
        timings,
      });
    }

    compute(engine, root, 120, 40);
    const setupMs = performance.now() - setupStart;
    const cleanSkipStart = performance.now();
    if (!root.layoutDirty) {
      // Clean-frame benchmark intentionally measures the skip guard overhead.
    }
    const cleanSkipMs = performance.now() - cleanSkipStart;

    const mutationStart = performance.now();
    mutate(root, scenario);
    const mutationMs = performance.now() - mutationStart;

    if (!root.layoutDirty) {
      return makeResult({
        backend,
        cleanSkipMs,
        counters: emptyLayoutCounters(),
        error: "",
        mutationMs,
        nodeCount: countNodes(root),
        scenario,
        setupMs,
        shape,
        timings: emptyTimingFields(),
      });
    }

    const width = scenario === "resize" ? 160 : 120;
    const synchronizationStart = performance.now();
    const timings = compute(engine, root, width, 40);
    const synchronizationMs =
      timings.flatteningMs +
      timings.relationshipConstructionMs +
      timings.ffiInputMs;
    const counters = instrumentationCounters(engine);
    return makeResult({
      backend,
      cleanSkipMs,
      counters,
      error: "",
      mutationMs,
      nodeCount: countNodes(root),
      scenario,
      setupMs,
      shape,
      synchronizationMs:
        synchronizationMs || performance.now() - synchronizationStart,
      timings,
    });
  } finally {
    engine.destroy?.();
  }
}

function makeResult(args: {
  backend: BenchmarkBackend;
  cleanSkipMs: number;
  counters: LayoutInstrumentationCounters;
  error: string;
  mutationMs: number;
  nodeCount: number;
  scenario: Scenario;
  setupMs: number;
  shape: TreeShape;
  synchronizationMs?: number;
  timings: LayoutComputeTimings;
}): BenchmarkResult {
  return {
    ...args.timings,
    ...counterFields(args.counters),
    backend: args.backend.name,
    cleanSkipMs: args.cleanSkipMs,
    error: args.error,
    intendedMutationScope: intendedMutationScope(args.nodeCount, args.scenario),
    mutationMs: args.mutationMs,
    nodeCount: args.nodeCount,
    scenario: args.scenario,
    setupMs: args.setupMs,
    shape: args.shape,
    synchronizationMs: args.synchronizationMs ?? 0,
  };
}

function compute(
  engine: BenchmarkEngine,
  root: RootRenderable,
  width: number,
  height: number
): LayoutComputeTimings {
  if (engine.computeWithTimings) {
    return engine.computeWithTimings(root, width, height);
  }
  const totalStart = performance.now();
  engine.compute(root, width, height);
  const totalBackendMs = performance.now() - totalStart;
  return {
    ffiInputMs: 0,
    ffiOutputMs: 0,
    flatteningMs: totalBackendMs,
    nativeComputeMs: 0,
    rectangleApplicationMs: totalBackendMs,
    relationshipConstructionMs: 0,
    totalBackendMs,
  };
}

function instrumentationCounters(
  engine: BenchmarkEngine
): LayoutInstrumentationCounters {
  if (isInstrumentedLayoutEngine(engine)) {
    return engine.getInstrumentationCounters();
  }
  return emptyLayoutCounters();
}

function isInstrumentedLayoutEngine(
  engine: BenchmarkEngine
): engine is BenchmarkEngine & InstrumentedLayoutEngine {
  return typeof engine.getInstrumentationCounters === "function";
}

function counterFields(counters: LayoutInstrumentationCounters) {
  return {
    computeCalls: counters.computeCalls,
    readbackCount: counters.readbackCount,
    rectangleApplications: counters.rectangleApplications,
    relationshipUpdates: counters.relationshipUpdates,
    styleUpdates: counters.styleUpdates,
    touchedNodes: counters.touchedNodes,
  };
}

function emptyTimingFields(): LayoutComputeTimings {
  return {
    ffiInputMs: 0,
    ffiOutputMs: 0,
    flatteningMs: 0,
    nativeComputeMs: 0,
    rectangleApplicationMs: 0,
    relationshipConstructionMs: 0,
    totalBackendMs: 0,
  };
}

function createTree(targetSize: number, shape: TreeShape): RootRenderable {
  if (shape === "deep") {
    return createDeepTree(Math.min(targetSize, 1000));
  }
  if (shape === "balanced") {
    return createBalancedTree(targetSize);
  }
  if (shape === "mixed-dashboard") {
    return createDashboardTree(targetSize);
  }
  return createFlatTree(targetSize);
}

function expectedNodeCount(
  targetSize: number,
  shape: TreeShape,
  scenario: Scenario
): number {
  const base = shape === "deep" ? Math.min(targetSize, 1000) : targetSize;
  return scenario === "child-mutation" ? base + 1 : base;
}

function intendedMutationScope(nodeCount: number, scenario: Scenario): number {
  if (scenario === "single-prop") {
    return 1;
  }
  if (scenario === "child-mutation") {
    return 2;
  }
  if (scenario === "clean-frame") {
    return 0;
  }
  return nodeCount;
}

function sanitizeBenchmarkError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "");
}

function createFlatTree(size: number): RootRenderable {
  const root = new RootRenderable(120, 40);
  root.setLayoutProps({ flexDirection: "column", gap: 0 });
  for (let index = 1; index < size; index++) {
    root.add(new BoxRenderable({ flexGrow: 1, minHeight: 0 }));
  }
  return root;
}

function createDeepTree(size: number): RootRenderable {
  const root = new RootRenderable(120, 40);
  root.setLayoutProps({ flexDirection: "column" });
  let parent: BoxRenderable | RootRenderable = root;
  for (let index = 1; index < size; index++) {
    const child = new BoxRenderable({ flexGrow: 1, minHeight: 0 });
    child.setLayoutProps({ flexDirection: index % 2 === 0 ? "row" : "column" });
    parent.add(child);
    parent = child;
  }
  return root;
}

function createBalancedTree(size: number): RootRenderable {
  const root = new RootRenderable(120, 40);
  root.setLayoutProps({ flexDirection: "column", gap: 1 });
  const queue: (BoxRenderable | RootRenderable)[] = [root];
  let created = 1;
  while (created < size) {
    const parent = queue.shift();
    if (!parent) {
      break;
    }
    for (let index = 0; index < 3 && created < size; index++) {
      const child = new BoxRenderable({
        flexDirection: created % 2 === 0 ? "row" : "column",
        flexGrow: 1,
        minHeight: 0,
        minWidth: 0,
      });
      parent.add(child);
      queue.push(child);
      created++;
    }
  }
  return root;
}

function createDashboardTree(size: number): RootRenderable {
  const root = new RootRenderable(120, 40);
  root.setLayoutProps({ flexDirection: "column", gap: 1, padding: 1 });
  const header = new TextRenderable({ content: "Dashboard", height: 1 });
  const body = new BoxRenderable({ flexDirection: "row", flexGrow: 1, gap: 1 });
  const sidebar = new BoxRenderable({
    width: 18,
    flexDirection: "column",
    gap: 1,
  });
  const content = new BoxRenderable({
    flexDirection: "column",
    flexGrow: 1,
    gap: 1,
  });
  const hidden = new BoxRenderable({ display: "none", height: 3 });
  const absolute = new BoxRenderable({
    bottom: 1,
    height: 2,
    position: "absolute",
    right: 2,
    width: 12,
  });
  root.add(header).add(body).add(hidden).add(absolute);
  body.add(sidebar).add(content);

  const containers = [sidebar, content];
  let created = countNodes(root);
  while (created < size) {
    const parent = containers[created % containers.length] ?? content;
    const panel = new BoxRenderable({
      flexDirection: created % 3 === 0 ? "row" : "column",
      flexGrow: created % 4 === 0 ? 1 : 0,
      height: created % 4 === 0 ? undefined : 1,
      minHeight: 0,
      minWidth: 0,
      width: created % 5 === 0 ? "50%" : undefined,
    });
    parent.add(panel);
    if (created % 6 === 0) {
      containers.push(panel);
    }
    created++;
  }
  return root;
}

function mutate(root: RootRenderable, scenario: Scenario): void {
  if (scenario === "clean-frame" || scenario === "cold-build") {
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

function countNodes(root: Renderable): number {
  let count = 0;
  const visit = (node: Renderable): void => {
    count++;
    for (const child of node.children) {
      visit(child);
    }
  };
  visit(root);
  return count;
}

function parseFilters(args: string[]): {
  backend?: BackendName;
  scenario?: Scenario;
  shape?: TreeShape;
  size?: number;
} {
  const filters: {
    backend?: BackendName;
    scenario?: Scenario;
    shape?: TreeShape;
    size?: number;
  } = {};
  for (const arg of args) {
    const [key, value] = arg.replace(LEADING_DASHES, "").split("=");
    if (key === "backend" && isBackendName(value)) {
      filters.backend = value;
    }
    if (key === "scenario" && isScenario(value)) {
      filters.scenario = value;
    }
    if (key === "shape" && isTreeShape(value)) {
      filters.shape = value;
    }
    if (key === "size") {
      const size = Number(value);
      if (Number.isFinite(size)) {
        filters.size = size;
      }
    }
  }
  return filters;
}

function isBackendName(value: string | undefined): value is BackendName {
  return ["native-custom", "typescript-fallback-oracle"].includes(value ?? "");
}

function isScenario(value: string | undefined): value is Scenario {
  return [
    "child-mutation",
    "clean-frame",
    "cold-build",
    "full-recompute",
    "resize",
    "single-prop",
  ].includes(value ?? "");
}

function isTreeShape(value: string | undefined): value is TreeShape {
  return ["balanced", "deep", "flat", "mixed-dashboard"].includes(value ?? "");
}
