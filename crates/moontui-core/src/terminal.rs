use crossterm::{
  ExecutableCommand,
  terminal::{disable_raw_mode, enable_raw_mode, size},
};
use std::env;
use std::io::stdout;

#[derive(Debug, thiserror::Error)]
pub enum TerminalError {
  #[error("failed to enable raw mode: {0}")]
  RawMode(String),
  #[error("failed to disable raw mode: {0}")]
  RawModeRestore(String),
  #[error("I/O error: {0}")]
  Io(#[from] std::io::Error),
}

pub fn init_raw_mode() -> Result<(), TerminalError> {
  enable_raw_mode().map_err(|e| TerminalError::RawMode(e.to_string()))
}

pub fn restore_terminal() -> Result<(), TerminalError> {
  stdout().execute(crossterm::cursor::Show)?;
  disable_raw_mode().map_err(|e| TerminalError::RawModeRestore(e.to_string()))
}

pub fn get_size() -> (u16, u16) {
  size().unwrap_or((80, 24))
}

/// Terminal color capabilities.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
#[repr(C)]
pub struct Capabilities {
  /// 24-bit truecolor support.
  pub rgb: bool,
  /// ANSI 256-color support.
  pub ansi256: bool,
  /// ANSI 16-color support.
  pub ansi16: bool,
}

/// Detect terminal capabilities from environment variables.
pub fn detect_capabilities() -> Capabilities {
  let mut caps = Capabilities::default();

  if let Ok(colorterm) = env::var("COLORTERM")
    && (colorterm == "truecolor" || colorterm == "24bit")
  {
    caps.rgb = true;
    caps.ansi256 = true;
  }

  if env::var("WT_SESSION").is_ok() {
    caps.rgb = true;
    caps.ansi256 = true;
  }

  if let Ok(term) = env::var("TERM")
    && term.contains("256color")
  {
    caps.ansi256 = true;
  }

  #[cfg(target_os = "windows")]
  {
    caps.rgb = true;
    caps.ansi256 = true;
  }

  if !caps.rgb && !caps.ansi256 {
    caps.ansi256 = true;
  }

  caps
}
