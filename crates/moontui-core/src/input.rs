use crossterm::event::{
  KeyCode, KeyEvent, KeyModifiers, MouseButton as CrosstermMouseButton,
  MouseEvent as CrosstermMouseEvent, MouseEventKind,
};
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

#[derive(Clone, Debug)]
pub struct MouseEvent {
  pub event_type: Cow<'static, str>,
  pub kind: Cow<'static, str>,
  pub button: u32,
  pub x: u32,
  pub y: u32,
  pub ctrl: bool,
  pub shift: bool,
  pub alt: bool,
  pub scroll_dir: u32,
}

pub fn convert_mouse_event(mouse: CrosstermMouseEvent) -> MouseEvent {
  let kind: Cow<'static, str> = match mouse.kind {
    MouseEventKind::Down(_) => Cow::Borrowed("down"),
    MouseEventKind::Up(_) => Cow::Borrowed("up"),
    MouseEventKind::Drag(_) => Cow::Borrowed("drag"),
    MouseEventKind::Moved => Cow::Borrowed("move"),
    MouseEventKind::ScrollUp
    | MouseEventKind::ScrollDown
    | MouseEventKind::ScrollLeft
    | MouseEventKind::ScrollRight => Cow::Borrowed("scroll"),
  };

  let button = match mouse.kind {
    MouseEventKind::Down(btn) | MouseEventKind::Up(btn) | MouseEventKind::Drag(btn) => match btn {
      CrosstermMouseButton::Left => 0,
      CrosstermMouseButton::Middle => 1,
      CrosstermMouseButton::Right => 2,
    },
    MouseEventKind::Moved
    | MouseEventKind::ScrollUp
    | MouseEventKind::ScrollDown
    | MouseEventKind::ScrollLeft
    | MouseEventKind::ScrollRight => 3,
  };

  let scroll_dir = match mouse.kind {
    MouseEventKind::ScrollUp => 1,
    MouseEventKind::ScrollDown => 2,
    MouseEventKind::ScrollLeft => 3,
    MouseEventKind::ScrollRight => 4,
    _ => 0,
  };

  MouseEvent {
    event_type: Cow::Borrowed("mouse"),
    kind,
    button,
    x: u32::from(mouse.column),
    y: u32::from(mouse.row),
    ctrl: mouse.modifiers.contains(KeyModifiers::CONTROL),
    shift: mouse.modifiers.contains(KeyModifiers::SHIFT),
    alt: mouse.modifiers.contains(KeyModifiers::ALT),
    scroll_dir,
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

  fn make_mouse(
    kind: MouseEventKind,
    col: u16,
    row: u16,
    modifiers: KeyModifiers,
  ) -> CrosstermMouseEvent {
    CrosstermMouseEvent { kind, column: col, row, modifiers }
  }

  #[test]
  fn test_mouse_down_left() {
    let event = convert_mouse_event(make_mouse(
      MouseEventKind::Down(CrosstermMouseButton::Left),
      10,
      5,
      KeyModifiers::empty(),
    ));
    assert_eq!(event.event_type, "mouse");
    assert_eq!(event.kind, "down");
    assert_eq!(event.button, 0);
    assert_eq!(event.x, 10);
    assert_eq!(event.y, 5);
    assert!(!event.ctrl);
    assert!(!event.shift);
    assert!(!event.alt);
    assert_eq!(event.scroll_dir, 0);
  }

  #[test]
  fn test_mouse_up_right() {
    let event = convert_mouse_event(make_mouse(
      MouseEventKind::Up(CrosstermMouseButton::Right),
      20,
      15,
      KeyModifiers::empty(),
    ));
    assert_eq!(event.kind, "up");
    assert_eq!(event.button, 2);
    assert_eq!(event.x, 20);
    assert_eq!(event.y, 15);
  }

  #[test]
  fn test_mouse_drag_middle() {
    let event = convert_mouse_event(make_mouse(
      MouseEventKind::Drag(CrosstermMouseButton::Middle),
      30,
      25,
      KeyModifiers::empty(),
    ));
    assert_eq!(event.kind, "drag");
    assert_eq!(event.button, 1);
  }

  #[test]
  fn test_mouse_move() {
    let event =
      convert_mouse_event(make_mouse(MouseEventKind::Moved, 40, 35, KeyModifiers::empty()));
    assert_eq!(event.kind, "move");
    assert_eq!(event.button, 3);
  }

  #[test]
  fn test_mouse_scroll_up() {
    let event =
      convert_mouse_event(make_mouse(MouseEventKind::ScrollUp, 5, 2, KeyModifiers::empty()));
    assert_eq!(event.kind, "scroll");
    assert_eq!(event.scroll_dir, 1);
  }

  #[test]
  fn test_mouse_scroll_down() {
    let event =
      convert_mouse_event(make_mouse(MouseEventKind::ScrollDown, 5, 2, KeyModifiers::empty()));
    assert_eq!(event.kind, "scroll");
    assert_eq!(event.scroll_dir, 2);
  }

  #[test]
  fn test_mouse_scroll_left() {
    let event =
      convert_mouse_event(make_mouse(MouseEventKind::ScrollLeft, 5, 2, KeyModifiers::empty()));
    assert_eq!(event.kind, "scroll");
    assert_eq!(event.scroll_dir, 3);
  }

  #[test]
  fn test_mouse_scroll_right() {
    let event =
      convert_mouse_event(make_mouse(MouseEventKind::ScrollRight, 5, 2, KeyModifiers::empty()));
    assert_eq!(event.kind, "scroll");
    assert_eq!(event.scroll_dir, 4);
  }

  #[test]
  fn test_mouse_with_modifiers() {
    let event = convert_mouse_event(make_mouse(
      MouseEventKind::Down(CrosstermMouseButton::Left),
      10,
      5,
      KeyModifiers::CONTROL | KeyModifiers::SHIFT,
    ));
    assert!(event.ctrl);
    assert!(event.shift);
    assert!(!event.alt);
  }
}
