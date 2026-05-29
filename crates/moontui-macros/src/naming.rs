pub fn snake_to_camel(s: &str) -> String {
  let mut result = String::new();
  let mut capitalize_next = false;

  for c in s.chars() {
    if c == '_' {
      capitalize_next = true;
    } else if capitalize_next {
      result.push(c.to_ascii_uppercase());
      capitalize_next = false;
    } else {
      result.push(c);
    }
  }

  result
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_snake_to_camel() {
    assert_eq!(snake_to_camel("setup_terminal"), "setupTerminal");
    assert_eq!(snake_to_camel("restore_terminal"), "restoreTerminal");
    assert_eq!(snake_to_camel("render"), "render");
    assert_eq!(snake_to_camel("get_char_ptr"), "getCharPtr");
    assert_eq!(snake_to_camel("process_events"), "processEvents");
    assert_eq!(snake_to_camel("set_cursor_position"), "setCursorPosition");
    assert_eq!(snake_to_camel("set_event_callback"), "setEventCallback");
    assert_eq!(snake_to_camel("destroy"), "destroy");
    assert_eq!(snake_to_camel("resize"), "resize");
    assert_eq!(snake_to_camel("real_char_size"), "realCharSize");
  }
}
