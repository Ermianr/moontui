use crossterm::{
  ExecutableCommand,
  terminal::{disable_raw_mode, enable_raw_mode, size},
};
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
