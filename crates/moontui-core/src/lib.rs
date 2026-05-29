#![allow(clippy::not_unsafe_ptr_arg_deref)]

use moontui_macros::moontui_export_manual;

mod ansi;
pub mod buffer;
mod diff_renderer;
mod event_bridge;
mod frame_stats;
pub mod input;
mod output_sink;
pub mod renderer;
mod terminal;

// Re-export all public items from renderer and buffer modules
// This makes macro-generated functions accessible from the crate root
pub use buffer::*;
pub use renderer::*;

/// @ffi_manual
/// @ts_args width: number, height: number, testMode: boolean
/// @ts_returns Pointer<Renderer>
/// @ts_body return toPointer(lib.symbols.createRenderer(width, height, ffiBool(testMode)))
#[moontui_export_manual]
#[expect(unsafe_code)]
#[unsafe(no_mangle)]
pub extern "C" fn createRenderer(width: u32, height: u32, test_mode: bool) -> *mut CliRenderer {
  let output = if test_mode { OutputSink::Captured(Vec::new()) } else { OutputSink::Stdout };
  let renderer = Box::new(CliRenderer::new(width, height, output));
  Box::into_raw(renderer)
}

/// @ffi_manual
/// @ts_args p: Pointer<Renderer>
/// @ts_returns number
/// @ts_body return lib.symbols.destroyRenderer(p)
#[moontui_export_manual]
#[expect(unsafe_code)]
#[unsafe(no_mangle)]
pub extern "C" fn destroyRenderer(renderer: *mut CliRenderer) -> i32 {
  if renderer.is_null() {
    return 0;
  }
  unsafe {
    let mut renderer = Box::from_raw(renderer);
    match renderer.destroy() {
      Ok(()) => 0,
      Err(_) => 1,
    }
  }
}

/// @ffi_manual
/// @ts_args p: Pointer<Renderer>, force: boolean
/// @ts_returns number
/// @ts_body return lib.symbols.render(p, ffiBool(force))
#[moontui_export_manual]
#[expect(unsafe_code)]
#[unsafe(no_mangle)]
pub extern "C" fn render(renderer: *mut CliRenderer, force: bool) -> i32 {
  if renderer.is_null() {
    return 1;
  }
  unsafe {
    match (*renderer).render(force) {
      Ok(()) => 0,
      Err(_) => 1,
    }
  }
}

/// @ffi_manual
/// @ts_args p: Pointer<Renderer>, useAlternateScreen: boolean
/// @ts_returns number
/// @ts_body return lib.symbols.setupTerminal(p, ffiBool(useAlternateScreen))
#[moontui_export_manual]
#[expect(unsafe_code)]
#[unsafe(no_mangle)]
pub extern "C" fn setupTerminal(renderer: *mut CliRenderer, use_alternate_screen: bool) -> i32 {
  if renderer.is_null() {
    return 1;
  }
  unsafe {
    match (*renderer).setup_terminal(use_alternate_screen) {
      Ok(()) => 0,
      Err(_) => 1,
    }
  }
}

/// @ffi_manual
/// @ts_args p: Pointer<Renderer>
/// @ts_returns number
/// @ts_body return lib.symbols.restoreTerminal(p)
#[moontui_export_manual]
#[expect(unsafe_code)]
#[unsafe(no_mangle)]
pub extern "C" fn restoreTerminal(renderer: *mut CliRenderer) -> i32 {
  if renderer.is_null() {
    return 1;
  }
  unsafe {
    match (*renderer).restore_terminal() {
      Ok(()) => 0,
      Err(_) => 1,
    }
  }
}

/// @ffi_manual
/// @ts_args p: Pointer<Renderer>, outPtr: Pointer<void>
/// @ts_returns Pointer<void>
/// @ts_body return toPointer(lib.symbols.getCapturedOutput(p, outPtr))
#[moontui_export_manual]
#[expect(unsafe_code)]
#[unsafe(no_mangle)]
pub extern "C" fn getCapturedOutput(renderer: *mut CliRenderer, out_len: *mut usize) -> *const u8 {
  if renderer.is_null() || out_len.is_null() {
    return std::ptr::null();
  }
  unsafe {
    let data = (*renderer).get_output_data();
    if data.is_empty() {
      return std::ptr::null();
    }
    *out_len = data.len();
    data.as_ptr()
  }
}

/// @ffi_manual
/// @ts_args p: Pointer<Renderer>
/// @ts_returns Pointer<Buffer>
/// @ts_body return toPointer(lib.symbols.getCurrentBuffer(p))
#[moontui_export_manual]
#[expect(unsafe_code)]
#[unsafe(no_mangle)]
pub extern "C" fn getCurrentBuffer(renderer: *mut CliRenderer) -> *mut OptimizedBuffer {
  if renderer.is_null() {
    return std::ptr::null_mut();
  }
  unsafe {
    let buf = (*renderer).get_current_buffer();
    buf as *const OptimizedBuffer as *mut OptimizedBuffer
  }
}

/// @ffi_manual
/// @ts_args p: Pointer<Renderer>
/// @ts_returns Pointer<Buffer>
/// @ts_body return toPointer(lib.symbols.getNextBuffer(p))
#[moontui_export_manual]
#[expect(unsafe_code)]
#[unsafe(no_mangle)]
pub extern "C" fn getNextBuffer(renderer: *mut CliRenderer) -> *mut OptimizedBuffer {
  if renderer.is_null() {
    return std::ptr::null_mut();
  }
  unsafe {
    let buf = (*renderer).get_next_buffer();
    buf as *const OptimizedBuffer as *mut OptimizedBuffer
  }
}

/// @ffi_manual
/// @ts_args p: Pointer<Renderer>
/// @ts_returns { lastFrameTimeMs: number; averageFrameTimeMs: number; frameCount: number; cellsUpdated: number; averageCellsUpdated: number; renderTimeUs: number; stdoutWriteTimeUs: number }
/// @ts_body const buf = new Uint8Array(56)\nconst bufPtr = backend.ptr(buf)\nlib.symbols.getRenderStats(p, bufPtr)\nconst view = new DataView(buf.buffer)\nreturn {\n  lastFrameTimeMs: view.getFloat64(0, true),\n  averageFrameTimeMs: view.getFloat64(8, true),\n  frameCount: Number(view.getBigUint64(16, true)),\n  cellsUpdated: view.getUint32(24, true),\n  averageCellsUpdated: view.getUint32(28, true),\n  renderTimeUs: view.getFloat64(32, true),\n  stdoutWriteTimeUs: view.getFloat64(40, true),\n}
#[moontui_export_manual]
#[expect(unsafe_code)]
#[unsafe(no_mangle)]
pub extern "C" fn getRenderStats(renderer: *mut CliRenderer, out_ptr: *mut RenderStats) {
  if renderer.is_null() || out_ptr.is_null() {
    return;
  }
  unsafe {
    let stats = (*renderer).get_stats();
    *out_ptr = stats.clone();
  }
}

/// @ffi_manual
/// @ts_args
/// @ts_returns { width: number; height: number }
/// @ts_body const size = normalizeU64(lib.symbols.getTerminalSize())\nreturn {\n  // biome-ignore lint/suspicious/noBitwiseOperators: packed u64 terminal size\n  width: Number((size >> 32n) & 0xffffffffn),\n  // biome-ignore lint/suspicious/noBitwiseOperators: packed u64 terminal size\n  height: Number(size & 0xffffffffn),\n}
#[moontui_export_manual]
#[expect(unsafe_code)]
#[unsafe(no_mangle)]
pub extern "C" fn getTerminalSize() -> u64 {
  let (w, h) = terminal::get_size();
  ((w as u64) << 32) | (h as u64)
}

/// @ffi_manual
/// @ts_args buf: Pointer<Buffer>, codepoint: number, x: number, y: number, fg: RGBAInput, bg: RGBAInput, attributes: number
/// @ts_returns void
/// @ts_body lib.symbols.bufferDrawChar(buf, codepoint, x, y, rgbaPtr(fg), rgbaPtr(bg), attributes)
#[moontui_export_manual]
#[expect(unsafe_code)]
#[unsafe(no_mangle)]
pub extern "C" fn bufferDrawChar(
  buf: *mut OptimizedBuffer,
  char_codepoint: u32,
  x: u32,
  y: u32,
  fg: *const u16,
  bg: *const u16,
  attributes: u32,
) {
  if buf.is_null() || fg.is_null() || bg.is_null() {
    return;
  }
  unsafe {
    let fg_slice = &*(fg as *const [u16; 4]);
    let bg_slice = &*(bg as *const [u16; 4]);
    (*buf).draw_char(char_codepoint, x, y, fg_slice, bg_slice, attributes);
  }
}

/// @ffi_manual
/// @ts_args buf: Pointer<Buffer>, text: string, x: number, y: number, fg: RGBAInput, bg: RGBAInput, attributes: number
/// @ts_returns void
/// @ts_body const encoded = textEncoder.encode(text)\nlib.symbols.bufferDrawText(buf, backend.ptr(encoded), encoded.length, x, y, rgbaPtr(fg), rgbaPtr(bg), attributes)
#[moontui_export_manual]
#[expect(unsafe_code)]
#[unsafe(no_mangle)]
pub extern "C" fn bufferDrawText(
  buf: *mut OptimizedBuffer,
  text_ptr: *const u8,
  text_len: usize,
  x: u32,
  y: u32,
  fg: *const u16,
  bg: *const u16,
  attributes: u32,
) {
  if buf.is_null() || text_ptr.is_null() || fg.is_null() || bg.is_null() {
    return;
  }
  unsafe {
    let text_bytes = std::slice::from_raw_parts(text_ptr, text_len);
    let Ok(text) = std::str::from_utf8(text_bytes) else { return };
    let fg_slice = &*(fg as *const [u16; 4]);
    let bg_slice = &*(bg as *const [u16; 4]);
    (*buf).draw_text(text, x, y, fg_slice, bg_slice, attributes);
  }
}

/// @ffi_manual
/// @ts_args buf: Pointer<Buffer>, x: number, y: number, width: number, height: number, bg: RGBAInput
/// @ts_returns void
/// @ts_body lib.symbols.bufferFillRect(buf, x, y, width, height, rgbaPtr(bg))
#[moontui_export_manual]
#[expect(unsafe_code)]
#[unsafe(no_mangle)]
pub extern "C" fn bufferFillRect(
  buf: *mut OptimizedBuffer,
  x: u32,
  y: u32,
  width: u32,
  height: u32,
  bg: *const u16,
) {
  if buf.is_null() || bg.is_null() {
    return;
  }
  unsafe {
    let bg_slice = &*(bg as *const [u16; 4]);
    (*buf).fill_rect(x, y, width, height, bg_slice);
  }
}

/// @ffi_manual
/// @ts_args buf: Pointer<Buffer>, x: number, y: number, width: number, height: number, borderChars: Uint32Array, packedOptions: number, borderColor: RGBAInput, bgColor: RGBAInput
/// @ts_returns void
/// @ts_body lib.symbols.bufferDrawBox(buf, x, y, width, height, backend.ptr(borderChars), packedOptions, rgbaPtr(borderColor), rgbaPtr(bgColor))
#[moontui_export_manual]
#[expect(unsafe_code)]
#[unsafe(no_mangle)]
pub extern "C" fn bufferDrawBox(
  buf: *mut OptimizedBuffer,
  x: i32,
  y: i32,
  width: u32,
  height: u32,
  border_chars: *const u32,
  packed_options: u32,
  border_color: *const u16,
  bg_color: *const u16,
) {
  if buf.is_null() || border_chars.is_null() || border_color.is_null() || bg_color.is_null() {
    return;
  }
  unsafe {
    let bc_slice = &*(border_chars as *const [u32; 8]);
    let fg_slice = &*(border_color as *const [u16; 4]);
    let bg_slice = &*(bg_color as *const [u16; 4]);
    (*buf).draw_box(x, y, width, height, bc_slice, packed_options, fg_slice, bg_slice);
  }
}

/// @ffi_manual
/// @ts_args p: Pointer<Buffer>, outPtr: Pointer<void>, len: number, addLineBreaks: boolean
/// @ts_returns number
/// @ts_body return lib.symbols.bufferWriteResolvedChars(p, outPtr, len, ffiBool(addLineBreaks))
#[moontui_export_manual]
#[expect(unsafe_code)]
#[unsafe(no_mangle)]
pub extern "C" fn bufferWriteResolvedChars(
  buf: *mut OptimizedBuffer,
  output_ptr: *mut u8,
  output_len: usize,
  add_line_breaks: bool,
) -> u32 {
  if buf.is_null() || output_ptr.is_null() || output_len == 0 {
    return 0;
  }
  unsafe {
    let output = std::slice::from_raw_parts_mut(output_ptr, output_len);
    (*buf).write_resolved_chars(output, add_line_breaks)
  }
}
