pub struct HitGrid {
  cells: Vec<u32>,
  width: u32,
  height: u32,
  dirty: bool,
  scissor_stack: Vec<(u32, u32, u32, u32)>,
}

impl HitGrid {
  pub fn new(width: u32, height: u32) -> Self {
    let (width, height, size) =
      checked_cell_count(width, height).map_or((0, 0, 0), |size| (width, height, size));
    Self { cells: vec![0; size], width, height, dirty: false, scissor_stack: Vec::new() }
  }

  pub fn add(&mut self, x: u32, y: u32, width: u32, height: u32, id: u32) {
    if width == 0 || height == 0 || id == 0 {
      return;
    }

    let (start_x, start_y, end_x, end_y) =
      if let Some(&(sx, sy, sw, sh)) = self.scissor_stack.last() {
        let ax = x.max(sx);
        let ay = y.max(sy);
        let bx = x.saturating_add(width).min(sx.saturating_add(sw));
        let by = y.saturating_add(height).min(sy.saturating_add(sh));
        if ax >= bx || ay >= by {
          return;
        }
        (ax, ay, bx, by)
      } else {
        let ax = x;
        let ay = y;
        let bx = x.saturating_add(width).min(self.width);
        let by = y.saturating_add(height).min(self.height);
        if ax >= bx || ay >= by {
          return;
        }
        (ax, ay, bx, by)
      };

    for row in start_y..end_y {
      let offset = row * self.width;
      for col in start_x..end_x {
        self.cells[(offset + col) as usize] = id;
      }
    }
    self.dirty = true;
  }

  pub fn check_hit(&self, x: u32, y: u32) -> u32 {
    if x >= self.width || y >= self.height {
      return 0;
    }
    self.cells[(y * self.width + x) as usize]
  }

  pub fn clear(&mut self) {
    self.cells.iter_mut().for_each(|c| *c = 0);
    self.dirty = true;
  }

  pub fn resize(&mut self, new_width: u32, new_height: u32) {
    let Some(size) = checked_cell_count(new_width, new_height) else {
      self.cells.clear();
      self.width = 0;
      self.height = 0;
      self.dirty = true;
      return;
    };
    let mut new_cells = vec![0u32; size];
    let copy_width = self.width.min(new_width);
    let copy_height = self.height.min(new_height);
    for row in 0..copy_height {
      let src_start = row.saturating_mul(self.width) as usize;
      let dst_start = row.saturating_mul(new_width) as usize;
      let src_end = src_start + copy_width as usize;
      let dst_end = dst_start + copy_width as usize;
      new_cells[dst_start..dst_end].copy_from_slice(&self.cells[src_start..src_end]);
    }
    self.cells = new_cells;
    self.width = new_width;
    self.height = new_height;
    self.dirty = true;
  }

  pub fn push_scissor(&mut self, x: u32, y: u32, w: u32, h: u32) {
    let clipped = if let Some(&(sx, sy, sw, sh)) = self.scissor_stack.last() {
      let ax = x.max(sx);
      let ay = y.max(sy);
      let bx = x.saturating_add(w).min(sx.saturating_add(sw));
      let by = y.saturating_add(h).min(sy.saturating_add(sh));
      (ax, ay, bx.saturating_sub(ax), by.saturating_sub(ay))
    } else {
      (x, y, w, h)
    };
    self.scissor_stack.push(clipped);
  }

  pub fn pop_scissor(&mut self) {
    self.scissor_stack.pop();
  }

  pub fn clear_scissors(&mut self) {
    self.scissor_stack.clear();
  }

  pub fn is_dirty(&self) -> bool {
    self.dirty
  }

  pub fn clear_dirty(&mut self) {
    self.dirty = false;
  }

  #[cfg(test)]
  pub(crate) fn width(&self) -> u32 {
    self.width
  }

  #[cfg(test)]
  pub(crate) fn height(&self) -> u32 {
    self.height
  }
}

fn checked_cell_count(width: u32, height: u32) -> Option<usize> {
  (width as usize).checked_mul(height as usize)
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_new_hit_grid() {
    let grid = HitGrid::new(80, 24);
    assert_eq!(grid.width(), 80);
    assert_eq!(grid.height(), 24);
    assert!(!grid.is_dirty());
  }

  #[test]
  fn test_add_and_check_hit() {
    let mut grid = HitGrid::new(40, 20);
    grid.add(5, 3, 10, 4, 42);
    assert!(grid.is_dirty());
    assert_eq!(grid.check_hit(5, 3), 42);
    assert_eq!(grid.check_hit(14, 6), 42);
    assert_eq!(grid.check_hit(15, 3), 0);
    assert_eq!(grid.check_hit(5, 7), 0);
  }

  #[test]
  fn test_add_zero_size() {
    let mut grid = HitGrid::new(40, 20);
    grid.add(5, 3, 0, 0, 1);
    assert!(!grid.is_dirty());
  }

  #[test]
  fn test_add_zero_id() {
    let mut grid = HitGrid::new(40, 20);
    grid.add(5, 3, 10, 4, 0);
    assert!(!grid.is_dirty());
  }

  #[test]
  fn test_add_clipped_to_bounds() {
    let mut grid = HitGrid::new(40, 20);
    grid.add(35, 18, 10, 10, 1);
    assert_eq!(grid.check_hit(35, 18), 1);
    assert_eq!(grid.check_hit(39, 19), 1);
    assert_eq!(grid.check_hit(40, 18), 0);
    assert_eq!(grid.check_hit(35, 20), 0);
  }

  #[test]
  fn test_clear() {
    let mut grid = HitGrid::new(40, 20);
    grid.add(5, 3, 10, 4, 42);
    grid.clear_dirty();
    grid.clear();
    assert!(grid.is_dirty());
    assert_eq!(grid.check_hit(5, 3), 0);
  }

  #[test]
  fn test_resize_larger() {
    let mut grid = HitGrid::new(40, 20);
    grid.add(5, 3, 10, 4, 42);
    grid.resize(60, 30);
    assert_eq!(grid.check_hit(5, 3), 42);
    assert_eq!(grid.check_hit(50, 25), 0);
  }

  #[test]
  fn test_resize_smaller() {
    let mut grid = HitGrid::new(40, 20);
    grid.add(5, 3, 10, 4, 42);
    grid.resize(20, 10);
    assert_eq!(grid.check_hit(5, 3), 42);
    assert_eq!(grid.check_hit(15, 8), 0);
    assert_eq!(grid.check_hit(25, 3), 0);
  }

  #[test]
  fn test_scissor_clips_add() {
    let mut grid = HitGrid::new(40, 20);
    grid.push_scissor(10, 10, 20, 10);
    grid.add(5, 5, 30, 20, 1);
    assert_eq!(grid.check_hit(9, 9), 0);
    assert_eq!(grid.check_hit(10, 10), 1);
    assert_eq!(grid.check_hit(29, 19), 1);
    assert_eq!(grid.check_hit(30, 10), 0);
  }

  #[test]
  fn test_scissor_pop() {
    let mut grid = HitGrid::new(40, 20);
    grid.push_scissor(10, 10, 20, 10);
    grid.pop_scissor();
    grid.add(5, 5, 30, 20, 1);
    assert_eq!(grid.check_hit(5, 5), 1);
  }

  #[test]
  fn test_scissor_pop_empty() {
    let mut grid = HitGrid::new(40, 20);
    grid.pop_scissor();
    grid.add(5, 5, 10, 10, 1);
    assert_eq!(grid.check_hit(5, 5), 1);
  }

  #[test]
  fn test_scissor_nested() {
    let mut grid = HitGrid::new(40, 20);
    grid.push_scissor(0, 0, 40, 20);
    grid.push_scissor(10, 10, 20, 10);
    grid.add(5, 5, 30, 20, 1);
    assert_eq!(grid.check_hit(9, 9), 0);
    assert_eq!(grid.check_hit(10, 10), 1);
    assert_eq!(grid.check_hit(29, 19), 1);
    grid.pop_scissor();
    grid.clear();
    grid.clear_dirty();
    grid.add(5, 5, 10, 10, 2);
    assert_eq!(grid.check_hit(5, 5), 2);
    assert_eq!(grid.check_hit(14, 14), 2);
    assert_eq!(grid.check_hit(15, 15), 0);
  }

  #[test]
  fn test_dirty_tracking() {
    let mut grid = HitGrid::new(40, 20);
    assert!(!grid.is_dirty());
    grid.clear_dirty();
    assert!(!grid.is_dirty());
    grid.add(5, 3, 10, 4, 1);
    assert!(grid.is_dirty());
    grid.clear_dirty();
    assert!(!grid.is_dirty());
  }

  #[test]
  fn test_out_of_bounds_check_hit() {
    let grid = HitGrid::new(40, 20);
    assert_eq!(grid.check_hit(100, 100), 0);
  }
}
