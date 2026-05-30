use moontui_core::{ATTR_BOLD, renderer::CliRenderer};

fn assert_ordered(output: &str, parts: &[&str]) {
  let mut offset = 0;
  for part in parts {
    let Some(index) = output[offset..].find(part) else {
      panic!("missing ordered ANSI fragment: {part:?}");
    };
    offset += index + part.len();
  }
}

#[test]
fn test_single_colored_cell_ansi() {
  let mut renderer = CliRenderer::create_test_renderer(10, 5);
  let fg = [65535, 0, 0, 65535];
  let bg = [0, 0, 0, 65535];
  renderer.get_next_buffer_mut().draw_char('X' as u32, 0, 0, &fg, &bg, 0);
  renderer.render(false).unwrap();
  let output = renderer.get_output_data().to_vec();
  let output_str = String::from_utf8_lossy(&output);
  assert!(output_str.contains("\x1b[38;2;255;0;0m"), "should set foreground color");
  assert!(output_str.contains("\x1b[48;2;0;0;0m"), "should set background color");
  assert!(output_str.contains('X'), "should render character X");
}

#[test]
fn test_colored_cell_keeps_color_until_character() {
  let mut renderer = CliRenderer::create_test_renderer(10, 5);
  let fg = [65535, 0, 0, 65535];
  let bg = [0, 0, 0, 65535];
  renderer.get_next_buffer_mut().draw_char('X' as u32, 0, 0, &fg, &bg, 0);

  renderer.render(false).unwrap();

  let output = renderer.get_output_data().to_vec();
  let output_str = String::from_utf8_lossy(&output);
  assert_ordered(&output_str, &["\x1b[0m", "\x1b[38;2;255;0;0m", "\x1b[48;2;0;0;0m", "X"]);
}

#[test]
fn test_attribute_change_rebuilds_colors_before_text() {
  let mut renderer = CliRenderer::create_test_renderer(10, 5);
  let fg = [65535, 65535, 65535, 65535];
  let bg = [0, 0, 0, 65535];
  renderer.get_next_buffer_mut().draw_char('A' as u32, 0, 0, &fg, &bg, 0);
  renderer.get_next_buffer_mut().draw_char('B' as u32, 1, 0, &fg, &bg, ATTR_BOLD);

  renderer.render(false).unwrap();

  let output = renderer.get_output_data().to_vec();
  let output_str = String::from_utf8_lossy(&output);
  assert_ordered(
    &output_str,
    &["A", "\x1b[0m", "\x1b[38;2;255;255;255m", "\x1b[48;2;0;0;0m", "\x1b[1m", "B"],
  );
}

#[test]
fn test_frame_ends_with_reset_before_cursor_update() {
  let mut renderer = CliRenderer::create_test_renderer(10, 5);
  let fg = [65535, 65535, 65535, 65535];
  let bg = [0, 0, 0, 65535];
  renderer.get_next_buffer_mut().draw_char('X' as u32, 0, 0, &fg, &bg, 0);

  renderer.render(false).unwrap();

  let output = renderer.get_output_data().to_vec();
  let output_str = String::from_utf8_lossy(&output);
  assert!(
    output_str.contains("X\x1b[0m\x1b[?25l"),
    "frame should reset style before hiding cursor"
  );
}

#[test]
fn test_run_of_identical_cells_batches_color() {
  let mut renderer = CliRenderer::create_test_renderer(10, 5);
  let fg = [65535, 0, 0, 65535];
  let bg = [0, 0, 0, 65535];
  renderer.get_next_buffer_mut().draw_text("AAAAA", 0, 0, &fg, &bg, 0);
  renderer.render(false).unwrap();
  let output = renderer.get_output_data().to_vec();
  let output_str = String::from_utf8_lossy(&output);
  let count = output_str.matches("\x1b[38;2;255;0;0m").count();
  assert_eq!(count, 1, "color should be set once for the entire run");
}

#[test]
fn test_cursor_visible_true() {
  let mut renderer = CliRenderer::create_test_renderer(10, 5);
  renderer.set_cursor_position(2, 3, true);
  renderer.render(false).unwrap();
  let output = renderer.get_output_data().to_vec();
  let output_str = String::from_utf8_lossy(&output);
  assert!(output_str.contains("\x1b[?25h"), "should show cursor when visible");
  assert!(output_str.contains("\x1b[4;3H"), "should move cursor to (2,3)");
}

#[test]
fn test_cursor_visible_false() {
  let mut renderer = CliRenderer::create_test_renderer(10, 5);
  renderer.set_cursor_position(2, 3, false);
  renderer.render(false).unwrap();
  let output = renderer.get_output_data().to_vec();
  let output_str = String::from_utf8_lossy(&output);
  assert!(output_str.contains("\x1b[?25l"), "should hide cursor when not visible");
}

#[test]
fn test_dirty_rects_only_changed_cells() {
  let mut renderer = CliRenderer::create_test_renderer(10, 5);
  let fg = [65535, 65535, 65535, 65535];
  let bg = [0, 0, 0, 65535];
  renderer.get_next_buffer_mut().draw_char('X' as u32, 2, 2, &fg, &bg, 0);
  renderer.render(false).unwrap();
  let output = renderer.get_output_data().to_vec();
  let output_str = String::from_utf8_lossy(&output);
  assert!(output_str.contains("\x1b[3;3H"), "should move cursor to (2,2)");
  assert!(!output_str.contains("\x1b[1;1H"), "should NOT move cursor to (0,0)");
  assert_eq!(renderer.get_stats().cells_updated, 1, "should update only 1 cell");
}

#[test]
fn test_stats_cells_updated() {
  let mut renderer = CliRenderer::create_test_renderer(10, 5);
  let fg = [65535, 65535, 65535, 65535];
  let bg = [0, 0, 0, 65535];
  renderer.get_next_buffer_mut().draw_text("ABCDE", 0, 0, &fg, &bg, 0);
  renderer.render(false).unwrap();
  assert_eq!(renderer.get_stats().cells_updated, 5, "should report 5 updated cells");
}

#[test]
fn test_stats_frame_count_increments() {
  let mut renderer = CliRenderer::create_test_renderer(10, 5);
  assert_eq!(renderer.get_stats().frame_count, 0);
  renderer.render(false).unwrap();
  assert_eq!(renderer.get_stats().frame_count, 1);
  renderer.render(false).unwrap();
  assert_eq!(renderer.get_stats().frame_count, 2);
}

#[test]
fn test_stats_render_time_nonzero() {
  let mut renderer = CliRenderer::create_test_renderer(10, 5);
  renderer.render(false).unwrap();
  assert!(renderer.get_stats().render_time_us > 0.0, "render_time_us should be non-zero");
}

#[test]
fn test_stats_force_render_updates_all_cells() {
  let mut renderer = CliRenderer::create_test_renderer(10, 5);
  renderer.render(true).unwrap();
  assert_eq!(
    renderer.get_stats().cells_updated,
    50,
    "force render on 10x5 should update all 50 cells"
  );
}
