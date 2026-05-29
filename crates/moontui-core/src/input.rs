use crossterm::event::{KeyCode, KeyEvent, KeyModifiers};
use std::borrow::Cow;

#[derive(Clone, Debug)]
pub struct InputEvent {
  pub event_type: Cow<'static, str>,
  pub key: Cow<'static, str>,
  pub ctrl: bool,
  pub shift: bool,
  pub alt: bool,
}

pub fn convert_key_event(key: KeyEvent) -> InputEvent {
  let key_str: Cow<'static, str> = match key.code {
    KeyCode::Char(c) => Cow::Owned(c.to_string()),
    KeyCode::Up => Cow::Borrowed("ArrowUp"),
    KeyCode::Down => Cow::Borrowed("ArrowDown"),
    KeyCode::Left => Cow::Borrowed("ArrowLeft"),
    KeyCode::Right => Cow::Borrowed("ArrowRight"),
    KeyCode::Enter => Cow::Borrowed("Enter"),
    KeyCode::Esc => Cow::Borrowed("Escape"),
    KeyCode::Backspace => Cow::Borrowed("Backspace"),
    KeyCode::Tab => Cow::Borrowed("Tab"),
    KeyCode::Delete => Cow::Borrowed("Delete"),
    KeyCode::Home => Cow::Borrowed("Home"),
    KeyCode::End => Cow::Borrowed("End"),
    KeyCode::PageUp => Cow::Borrowed("PageUp"),
    KeyCode::PageDown => Cow::Borrowed("PageDown"),
    KeyCode::F(n) => Cow::Owned(format!("F{n}")),
    _ => Cow::Owned(format!("{:?}", key.code)),
  };

  InputEvent {
    event_type: Cow::Borrowed("key"),
    key: key_str,
    ctrl: key.modifiers.contains(KeyModifiers::CONTROL),
    shift: key.modifiers.contains(KeyModifiers::SHIFT),
    alt: key.modifiers.contains(KeyModifiers::ALT),
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use crossterm::event::{KeyCode, KeyEvent, KeyModifiers};

  fn make_key(code: KeyCode, modifiers: KeyModifiers) -> KeyEvent {
    KeyEvent::new(code, modifiers)
  }

  #[test]
  fn test_convert_char() {
    let event = convert_key_event(make_key(KeyCode::Char('a'), KeyModifiers::empty()));
    assert_eq!(event.key, "a");
    assert!(!event.ctrl);
    assert!(!event.shift);
    assert!(!event.alt);
  }

  #[test]
  fn test_convert_with_modifiers() {
    let event = convert_key_event(make_key(KeyCode::Char('c'), KeyModifiers::CONTROL));
    assert_eq!(event.key, "c");
    assert!(event.ctrl);
    assert!(!event.shift);
    assert!(!event.alt);
  }
}
