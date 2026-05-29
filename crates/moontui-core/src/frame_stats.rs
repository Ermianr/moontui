use moontui_macros::moontui_export;

#[moontui_export]
#[repr(C)]
#[derive(Clone, Debug)]
pub struct FrameStats {
  pub last_frame_time_ms: f64,
  pub average_frame_time_ms: f64,
  pub frame_count: u64,
  pub cells_updated: u32,
  pub average_cells_updated: u32,
  pub render_time_us: f64,
  pub stdout_write_time_us: f64,
  pub render_time_valid: bool,
  pub stdout_write_time_valid: bool,
}

impl Default for FrameStats {
  fn default() -> Self {
    Self::new()
  }
}

impl FrameStats {
  pub fn new() -> Self {
    Self {
      last_frame_time_ms: 0.0,
      average_frame_time_ms: 0.0,
      frame_count: 0,
      cells_updated: 0,
      average_cells_updated: 0,
      render_time_us: 0.0,
      stdout_write_time_us: 0.0,
      render_time_valid: false,
      stdout_write_time_valid: false,
    }
  }

  pub fn record_frame(&mut self, cells_updated: u32, render_time_us: f64, write_time_us: f64) {
    self.frame_count += 1;
    self.cells_updated = cells_updated;
    self.render_time_us = render_time_us;
    self.stdout_write_time_us = write_time_us;
    self.render_time_valid = true;
    self.stdout_write_time_valid = true;

    let total_time_ms = (render_time_us + write_time_us) / 1000.0;
    self.last_frame_time_ms = total_time_ms;

    if self.frame_count > 1 {
      let prev_total = self.average_frame_time_ms * (self.frame_count - 1) as f64;
      self.average_frame_time_ms = (prev_total + total_time_ms) / self.frame_count as f64;

      let prev_cells_total = self.average_cells_updated as u64 * (self.frame_count - 1);
      self.average_cells_updated =
        ((prev_cells_total + cells_updated as u64) / self.frame_count) as u32;
    } else {
      self.average_frame_time_ms = total_time_ms;
      self.average_cells_updated = cells_updated;
    }
  }
}
