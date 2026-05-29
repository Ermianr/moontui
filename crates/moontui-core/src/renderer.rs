use crate::ansi;
use crate::buffer::OptimizedBuffer;
use crate::diff_renderer::DiffRenderer;
use crate::event_bridge::EventBridge;
use crate::frame_stats::FrameStats;
use moontui_macros::{moontui_export, moontui_skip};
use std::io::{self, Write};
use std::time::Instant;

pub use crate::diff_renderer::DirtyRect;
pub use crate::event_bridge::EventCallback;
pub use crate::frame_stats::FrameStats as RenderStats;
pub use crate::output_sink::OutputSink;

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
}

#[moontui_export]
impl CliRenderer {
  pub fn new(width: u32, height: u32, output: OutputSink) -> Self {
    Self {
      front_buffer: OptimizedBuffer::new(width, height),
      back_buffer: OptimizedBuffer::new(width, height),
      width,
      height,
      stats: FrameStats::new(),
      event_bridge: EventBridge::new(),
      output,
      cursor: CursorState::new(),
      diff_renderer: DiffRenderer::new(),
      raw_mode_enabled: false,
      alternate_screen: false,
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
  pub fn setup_terminal(&mut self, use_alternate_screen: bool) -> io::Result<()> {
    if crate::terminal::init_raw_mode().is_ok() {
      self.raw_mode_enabled = true;
    }
    let mut buf = Vec::new();
    if use_alternate_screen {
      ansi::write_enter_alt_screen(&mut buf);
      self.alternate_screen = true;
    }
    ansi::write_clear_screen(&mut buf);
    ansi::write_hide_cursor(&mut buf);
    self.output.write_all(&buf)?;
    self.output.flush()?;
    Ok(())
  }

  #[moontui_skip]
  pub fn restore_terminal(&mut self) -> io::Result<()> {
    let mut first_err: Option<io::Error> = None;
    let mut buf = Vec::new();
    ansi::write_show_cursor(&mut buf);
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

    self.stats.record_frame(cells_updated, render_time_us, write_time_us);

    write_result
  }

  pub fn process_events(&mut self) -> usize {
    self.event_bridge.process_events()
  }

  pub fn resize(&mut self, width: u32, height: u32) {
    self.front_buffer = OptimizedBuffer::new(width, height);
    self.back_buffer = OptimizedBuffer::new(width, height);
    self.width = width;
    self.height = height;
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

  pub fn set_cursor_position(&mut self, x: i32, y: i32, visible: bool) {
    self.cursor.x = x;
    self.cursor.y = y;
    self.cursor.visible = visible;
  }

  pub fn set_event_callback(&mut self, cb: Option<EventCallback>) {
    self.event_bridge.set_callback(cb);
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
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_diff_identical_buffers() {
    let mut renderer = CliRenderer::create_test_renderer(5, 5);
    renderer.render(false).unwrap();
    assert_eq!(renderer.stats.cells_updated, 0);
  }

  #[test]
  fn test_diff_one_changed_cell() {
    let mut renderer = CliRenderer::create_test_renderer(5, 5);
    let fg = [65535, 65535, 65535, 65535];
    let bg = [0, 0, 0, 65535];
    renderer.back_buffer.draw_char('X' as u32, 2, 2, &fg, &bg, 0);
    renderer.render(false).unwrap();
    assert_eq!(renderer.stats.cells_updated, 1);
  }

  #[test]
  fn test_diff_full_clear() {
    let mut renderer = CliRenderer::create_test_renderer(5, 5);
    renderer.back_buffer.clear(&[100, 100, 100, 65535]);
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
}
