import type { MoonBuffer, ReadonlyMoonBuffer } from "./buffer";
import { terminalDefault } from "./rgba";

declare const currentBuffer: ReadonlyMoonBuffer;
declare const nextBuffer: MoonBuffer;

// @ts-expect-error current/front buffer is inspection-only
currentBuffer.drawText("x", 0, 0, "white");

nextBuffer.drawText("x", 0, 0, terminalDefault());
