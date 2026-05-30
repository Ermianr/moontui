use crate::ansi;
use crate::buffer::OptimizedBuffer;
use crate::color;
use crate::diff_renderer::DiffRenderer;
use crate::event_bridge::EventBridge;
use crate::frame_stats::FrameStats;
use crate::hit_grid::HitGrid;
use crate::terminal::Capabilities;
use moontui_macros::{moontui_export, moontui_skip};
use std::io::{self, Write};
use std::time::Instant;

pub use crate::diff_renderer::DirtyRect;
pub use crate::event_bridge::EventCallback;
pub use crate::event_bridge::MouseCallback;
pub use crate::event_bridge::ResizeCallback;
pub use crate::frame_stats::FrameStats as RenderStats;
pub use crate::output_sink::OutputSink;

#[repr(C)]
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum MousePointerStyle {
  #[default]
  Default = 0,
  Pointer = 1,
  Text = 2,
  Crosshair = 3,
  Move = 4,
  NotAllowed = 5,
}

struct CursorState {
  x: i32,
  y: i32,
  visible: bool,
}

impl CursorState {
  fn new() -> Self {
    Self { x: 0, y: 0, visible: false }
  }
}

pub struct CliRenderer {
  front_buffer: OptimizedBuffer,
  back_buffer: OptimizedBuffer,
  width: u32,
  height: u32,
  stats: FrameStats,
  event_bridge: EventBridge,
  pub(crate) output: OutputSink,
  cursor: CursorState,
  diff_renderer: DiffRenderer,
  raw_mode_enabled: bool,
  alternate_screen: bool,
  caps: Capabilities,
  mouse_enabled: bool,
  mouse_motion_enabled: bool,
  mouse_pointer_style: MousePointerStyle,
  hit_grid: HitGrid,
}

#[moontui_export]
impl CliRenderer {
  pub fn new(width: u32, height: u32, output: OutputSink) -> Self {
    let caps = crate::terminal::detect_capabilities();
    Self {
      front_buffer: OptimizedBuffer::new(width, height),
      back_buffer: OptimizedBuffer::new(width, height),
      width,
      height,
      stats: FrameStats::new(),
      event_bridge: EventBridge::new(),
      output,
      cursor: CursorState::new(),
      diff_renderer: DiffRenderer::new(caps),
      raw_mode_enabled: false,
      alternate_screen: false,
      caps,
      mouse_enabled: false,
      mouse_motion_enabled: false,
      mouse_pointer_style: MousePointerStyle::Default,
      hit_grid: HitGrid::new(width, height),
    }
  }

  pub fn create(width: u32, height: u32) -> Self {
    Self::new(width, height, OutputSink::Stdout)
  }

  pub fn create_test_renderer(width: u32, height: u32) -> Self {
    Self::new(width, height, OutputSink::Captured(Vec::new()))
  }

  #[moontui_skip]
  pub fn destroy(&mut self) -> io::Result<()> {
    if self.raw_mode_enabled {
      crate::terminal::restore_terminal().map_err(io::Error::other)?;
    }
    Ok(())
  }

  #[moontui_skip]
  pub fn setup_terminal(
    &mut self,
    use_alternate_screen: bool,
    enable_mouse: bool,
    enable_mouse_movement: bool,
  ) -> io::Result<()> {
    if crate::terminal::init_raw_mode().is_ok() {
      self.raw_mode_enabled = true;
    }
    let mut buf = Vec::new();
    ansi::write_reset(&mut buf);
    if use_alternate_screen {
      ansi::write_enter_alt_screen(&mut buf);
      self.alternate_screen = true;
    }
    ansi::write_clear_screen(&mut buf);
    ansi::write_hide_cursor(&mut buf);
    if enable_mouse {
      if enable_mouse_movement {
        ansi::write_enable_mouse_with_motion(&mut buf);
      } else {
        ansi::write_enable_mouse(&mut buf);
      }
      self.mouse_enabled = true;
      self.mouse_motion_enabled = enable_mouse_movement;
    }
    self.output.write_all(&buf)?;
    self.output.flush()?;
    Ok(())
  }

  #[moontui_skip]
  pub fn restore_terminal(&mut self) -> io::Result<()> {
    let mut first_err: Option<io::Error> = None;
    let mut buf = Vec::new();
    ansi::write_show_cursor(&mut buf);
    if self.mouse_enabled {
      ansi::write_disable_mouse(&mut buf);
      self.mouse_enabled = false;
      self.mouse_motion_enabled = false;
    }
    ansi::write_pointer_style(&mut buf, 0);
    self.mouse_pointer_style = MousePointerStyle::Default;
    if self.alternate_screen {
      ansi::write_exit_alt_screen(&mut buf);
      self.alternate_screen = false;
    }
    if let Err(e) = self.output.write_all(&buf) {
      first_err.get_or_insert(e);
    }
    if self.raw_mode_enabled {
      if let Err(e) = crate::terminal::restore_terminal().map_err(io::Error::other) {
        first_err.get_or_insert(e);
      }
      self.raw_mode_enabled = false;
    }
    if let Err(e) = self.output.flush() {
      first_err.get_or_insert(e);
    }
    match first_err {
      Some(e) => Err(e),
      None => Ok(()),
    }
  }

  #[moontui_skip]
  pub fn render(&mut self, force: bool) -> io::Result<()> {
    let render_start = Instant::now();

    let dirty_rects = if force {
      vec![DirtyRect { x: 0, y: 0, width: self.width, height: self.height }]
    } else {
      DiffRenderer::compute_dirty_rects(
        &self.front_buffer,
        &self.back_buffer,
        self.width,
        self.height,
      )
    };

    let mut output = Vec::new();
    let cells_updated = self.diff_renderer.render(
      &dirty_rects,
      &self.back_buffer,
      self.width,
      self.height,
      self.cursor.x,
      self.cursor.y,
      self.cursor.visible,
      &mut output,
    );

    let ansi_done = Instant::now();
    let render_time_us = ansi_done.duration_since(render_start).as_micros() as f64;

    let write_start = Instant::now();
    let write_result = self.output.write_all(&output).and_then(|()| self.output.flush());
    let write_time_us = write_start.elapsed().as_micros() as f64;

    std::mem::swap(&mut self.front_buffer, &mut self.back_buffer);
    self.back_buffer.clear(&color::default_color(0, 0, 0, 255));

    self.stats.record_frame(cells_updated, render_time_us, write_time_us);

    write_result
  }

  pub fn process_events(&mut self) -> usize {
    let count = self.event_bridge.process_events();
    if let Some((w, h)) = self.event_bridge.take_pending_resize() {
      self.resize(w, h);
      self.front_buffer.clear(&color::default_color(0, 0, 0, 255));
      let _ = self.render(true);
    }
    count
  }

  pub fn resize(&mut self, width: u32, height: u32) {
    self.front_buffer = OptimizedBuffer::new(width, height);
    self.back_buffer = OptimizedBuffer::new(width, height);
    self.width = width;
    self.height = height;
    self.hit_grid.resize(width, height);
  }

  #[moontui_skip]
  pub fn get_current_buffer(&self) -> &OptimizedBuffer {
    &self.front_buffer
  }

  pub fn get_current_buffer_mut(&mut self) -> &mut OptimizedBuffer {
    &mut self.front_buffer
  }

  #[moontui_skip]
  pub fn get_next_buffer(&self) -> &OptimizedBuffer {
    &self.back_buffer
  }

  pub fn get_next_buffer_mut(&mut self) -> &mut OptimizedBuffer {
    &mut self.back_buffer
  }

  pub fn width(&self) -> u32 {
    self.width
  }

  pub fn height(&self) -> u32 {
    self.height
  }

  #[moontui_skip]
  pub fn cursor_position(&self) -> (i32, i32, bool) {
    (self.cursor.x, self.cursor.y, self.cursor.visible)
  }

  #[moontui_skip]
  pub fn get_stats(&self) -> &FrameStats {
    &self.stats
  }

  #[moontui_skip]
  pub fn get_capabilities(&self) -> Capabilities {
    self.caps
  }

  pub fn set_cursor_position(&mut self, x: i32, y: i32, visible: bool) {
    self.cursor.x = x;
    self.cursor.y = y;
    self.cursor.visible = visible;
  }

  pub fn set_event_callback(&mut self, cb: Option<EventCallback>) {
    self.event_bridge.set_callback(cb);
  }

  pub fn set_resize_callback(&mut self, cb: Option<ResizeCallback>) {
    self.event_bridge.set_resize_callback(cb);
  }

  pub fn set_mouse_callback(&mut self, cb: Option<MouseCallback>) {
    self.event_bridge.set_mouse_callback(cb);
  }

  pub fn enable_mouse(&mut self, enable_movement: bool) {
    let mut buf = Vec::new();
    if enable_movement {
      ansi::write_enable_mouse_with_motion(&mut buf);
    } else {
      ansi::write_enable_mouse(&mut buf);
    }
    let _ = self.output.write_all(&buf);
    let _ = self.output.flush();
    self.mouse_enabled = true;
    self.mouse_motion_enabled = enable_movement;
  }

  pub fn disable_mouse(&mut self) {
    let mut buf = Vec::new();
    ansi::write_disable_mouse(&mut buf);
    let _ = self.output.write_all(&buf);
    let _ = self.output.flush();
    self.mouse_enabled = false;
    self.mouse_motion_enabled = false;
  }

  pub fn set_mouse_pointer_style(&mut self, style: MousePointerStyle) {
    let mut buf = Vec::new();
    ansi::write_pointer_style(&mut buf, style as u32);
    let _ = self.output.write_all(&buf);
    let _ = self.output.flush();
    self.mouse_pointer_style = style;
  }

  pub fn get_mouse_pointer_style(&self) -> MousePointerStyle {
    self.mouse_pointer_style
  }

  pub fn hit_grid_add(&mut self, x: u32, y: u32, width: u32, height: u32, id: u32) {
    self.hit_grid.add(x, y, width, height, id);
  }

  pub fn hit_grid_check_hit(&self, x: u32, y: u32) -> u32 {
    self.hit_grid.check_hit(x, y)
  }

  pub fn hit_grid_clear(&mut self) {
    self.hit_grid.clear();
  }

  pub fn hit_grid_push_scissor_rect(&mut self, x: u32, y: u32, w: u32, h: u32) {
    self.hit_grid.push_scissor(x, y, w, h);
  }

  pub fn hit_grid_pop_scissor_rect(&mut self) {
    self.hit_grid.pop_scissor();
  }

  pub fn hit_grid_clear_scissor_rects(&mut self) {
    self.hit_grid.clear_scissors();
  }

  pub fn hit_grid_is_dirty(&self) -> bool {
    self.hit_grid.is_dirty()
  }

  pub fn hit_grid_clear_dirty(&mut self) {
    self.hit_grid.clear_dirty();
  }

  #[moontui_skip]
  pub fn get_output_data(&self) -> &[u8] {
    self.output.data()
  }

  pub fn clear_output(&mut self) {
    self.output.clear();
  }

  #[moontui_skip]
  pub fn inject_key_event(&self, key: &str, ctrl: bool, shift: bool, alt: bool) {
    self.event_bridge.inject_key_event(key, ctrl, shift, alt);
  }

  #[moontui_skip]
  pub fn inject_resize_event(&mut self, width: u32, height: u32) {
    self.event_bridge.inject_resize_event(width, height);
    self.resize(width, height);
    self.front_buffer.clear(&color::default_color(0, 0, 0, 255));
    let _ = self.render(true);
  }

  #[moontui_skip]
  pub fn inject_mouse_event(
    &self,
    kind: &str,
    button: u32,
    x: u32,
    y: u32,
    ctrl: bool,
    shift: bool,
    alt: bool,
    scroll_dir: u32,
  ) {
    self.event_bridge.inject_mouse_event(kind, button, x, y, ctrl, shift, alt, scroll_dir);
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::color;

  #[test]
  fn test_diff_identical_buffers() {
    let mut renderer = CliRenderer::create_test_renderer(5, 5);
    renderer.render(false).unwrap();
    assert_eq!(renderer.stats.cells_updated, 0);
  }

  #[test]
  fn test_diff_one_changed_cell() {
    let mut renderer = CliRenderer::create_test_renderer(5, 5);
    let fg = color::rgb_color(255, 255, 255, 255);
    let bg = color::rgb_color(0, 0, 0, 255);
    renderer.back_buffer.draw_char('X' as u32, 2, 2, &fg, &bg, 0);
    renderer.render(false).unwrap();
    assert_eq!(renderer.stats.cells_updated, 1);
  }

  #[test]
  fn test_diff_full_clear() {
    let mut renderer = CliRenderer::create_test_renderer(5, 5);
    renderer.back_buffer.clear(&color::rgb_color(100, 100, 100, 255));
    renderer.render(false).unwrap();
    assert_eq!(renderer.stats.cells_updated, 25);
  }

  #[test]
  fn test_force_render() {
    let mut renderer = CliRenderer::create_test_renderer(3, 3);
    renderer.render(true).unwrap();
    assert_eq!(renderer.stats.cells_updated, 9);
  }

  #[test]
  fn test_resize() {
    let mut renderer = CliRenderer::create_test_renderer(5, 5);
    renderer.resize(10, 10);
    assert_eq!(renderer.width, 10);
    assert_eq!(renderer.height, 10);
    assert_eq!(renderer.front_buffer.width, 10);
    assert_eq!(renderer.back_buffer.width, 10);
  }

  #[test]
  fn test_mouse_enable_disable() {
    let mut renderer = CliRenderer::create_test_renderer(10, 10);
    assert!(!renderer.mouse_enabled);
    assert!(!renderer.mouse_motion_enabled);

    renderer.enable_mouse(true);
    assert!(renderer.mouse_enabled);
    assert!(renderer.mouse_motion_enabled);

    renderer.disable_mouse();
    assert!(!renderer.mouse_enabled);
    assert!(!renderer.mouse_motion_enabled);
  }

  #[test]
  fn test_mouse_enable_without_motion() {
    let mut renderer = CliRenderer::create_test_renderer(10, 10);
    renderer.enable_mouse(false);
    assert!(renderer.mouse_enabled);
    assert!(!renderer.mouse_motion_enabled);
  }

  #[test]
  fn test_mouse_pointer_style() {
    let mut renderer = CliRenderer::create_test_renderer(10, 10);
    assert_eq!(renderer.get_mouse_pointer_style(), MousePointerStyle::Default);

    renderer.set_mouse_pointer_style(MousePointerStyle::Pointer);
    assert_eq!(renderer.get_mouse_pointer_style(), MousePointerStyle::Pointer);

    renderer.set_mouse_pointer_style(MousePointerStyle::Crosshair);
    assert_eq!(renderer.get_mouse_pointer_style(), MousePointerStyle::Crosshair);

    renderer.set_mouse_pointer_style(MousePointerStyle::Default);
    assert_eq!(renderer.get_mouse_pointer_style(), MousePointerStyle::Default);
  }

  #[test]
  fn test_setup_terminal_writes_mouse_enable_sequences() {
    let mut renderer = CliRenderer::create_test_renderer(10, 10);
    renderer.setup_terminal(false, true, true).unwrap();
    let output = renderer.get_output_data();
    assert!(output.windows(8).any(|w| w == b"\x1B[?1000h"), "missing click tracking");
    assert!(output.windows(8).any(|w| w == b"\x1B[?1002h"), "missing drag tracking");
    assert!(output.windows(8).any(|w| w == b"\x1B[?1003h"), "missing motion tracking");
    assert!(output.windows(8).any(|w| w == b"\x1B[?1006h"), "missing SGR mode");
  }

  #[test]
  fn test_setup_terminal_without_mouse_no_ansi() {
    let mut renderer = CliRenderer::create_test_renderer(10, 10);
    renderer.setup_terminal(false, false, false).unwrap();
    let output = renderer.get_output_data();
    assert!(!output.windows(8).any(|w| w == b"\x1B[?1000h"), "should not enable mouse");
    assert!(!output.windows(8).any(|w| w == b"\x1B[?1006h"), "should not enable SGR");
  }

  #[test]
  fn test_restore_terminal_writes_mouse_disable() {
    let mut renderer = CliRenderer::create_test_renderer(10, 10);
    renderer.setup_terminal(false, true, true).unwrap();
    renderer.restore_terminal().unwrap();
    let output = renderer.get_output_data();
    assert!(output.windows(8).any(|w| w == b"\x1B[?1006l"), "missing SGR disable");
    assert!(output.windows(8).any(|w| w == b"\x1B[?1000l"), "missing click disable");
  }
}
