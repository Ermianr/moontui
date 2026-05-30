#![allow(unsafe_code)]

use moontui_core::renderer::CliRenderer;

#[test]
fn test_setup_terminal_alternate_screen() {
  let mut renderer = CliRenderer::create_test_renderer(10, 5);
  renderer.setup_terminal(true, false, false).unwrap();
  let output = renderer.get_output_data().to_vec();
  let output_str = String::from_utf8_lossy(&output);
  assert!(output_str.contains("\x1b[?1049h"), "should enter alt screen");
  assert!(output_str.contains("\x1b[2J\x1b[H"), "should clear screen");
  assert!(output_str.contains("\x1b[?25l"), "should hide cursor");
}

#[test]
fn test_setup_terminal_no_alternate_screen() {
  let mut renderer = CliRenderer::create_test_renderer(10, 5);
  renderer.setup_terminal(false, false, false).unwrap();
  let output = renderer.get_output_data().to_vec();
  let output_str = String::from_utf8_lossy(&output);
  assert!(!output_str.contains("\x1b[?1049h"), "should NOT enter alt screen");
  assert!(output_str.contains("\x1b[2J\x1b[H"), "should clear screen");
  assert!(output_str.contains("\x1b[?25l"), "should hide cursor");
}

#[test]
fn test_restore_terminal_after_alternate_screen() {
  let mut renderer = CliRenderer::create_test_renderer(10, 5);
  renderer.setup_terminal(true, false, false).unwrap();
  renderer.clear_output();
  renderer.restore_terminal().unwrap();
  let output = renderer.get_output_data().to_vec();
  let output_str = String::from_utf8_lossy(&output);
  assert!(output_str.contains("\x1b[?25h"), "should show cursor");
  assert!(output_str.contains("\x1b[?1049l"), "should exit alt screen");
}

#[test]
fn test_restore_terminal_after_non_alternate_screen() {
  let mut renderer = CliRenderer::create_test_renderer(10, 5);
  renderer.setup_terminal(false, false, false).unwrap();
  renderer.clear_output();
  renderer.restore_terminal().unwrap();
  let output = renderer.get_output_data().to_vec();
  let output_str = String::from_utf8_lossy(&output);
  assert!(output_str.contains("\x1b[?25h"), "should show cursor");
  assert!(!output_str.contains("\x1b[?1049l"), "should NOT exit alt screen");
}

#[test]
fn test_setup_restore_terminal_pair_no_dangling() {
  let mut renderer = CliRenderer::create_test_renderer(10, 5);
  renderer.setup_terminal(true, false, false).unwrap();
  renderer.restore_terminal().unwrap();
  let output = renderer.get_output_data().to_vec();
  let output_str = String::from_utf8_lossy(&output);
  assert!(output_str.contains("\x1b[?1049h"));
  assert!(output_str.contains("\x1b[?1049l"));
  assert!(output_str.contains("\x1b[2J\x1b[H"));
  assert!(output_str.contains("\x1b[?25l"));
  assert!(output_str.contains("\x1b[?25h"));
  let count_1049h = output_str.matches("\x1b[?1049h").count();
  let count_1049l = output_str.matches("\x1b[?1049l").count();
  assert_eq!(count_1049h, 1, "should enter alt screen exactly once");
  assert_eq!(count_1049l, 1, "should exit alt screen exactly once");
}
