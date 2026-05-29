use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Schema {
  pub functions: BTreeMap<String, FunctionDef>,
  pub structs: BTreeMap<String, StructDef>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FunctionDef {
  pub receiver: Option<String>,
  pub params: Vec<ParamDef>,
  pub returns: String,
  pub ffi_name: String,
  #[serde(default, skip_serializing_if = "is_false")]
  pub manual: bool,
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub ts_body: Option<String>,
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub ts_args: Option<String>,
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub ts_returns: Option<String>,
}

#[expect(clippy::trivially_copy_pass_by_ref)]
fn is_false(b: &bool) -> bool {
  !b
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParamDef {
  pub name: String,
  pub r#type: String,
  pub role: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StructDef {
  pub repr: String,
  pub fields: Vec<FieldDef>,
  pub size: usize,
  pub alignment: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldDef {
  pub name: String,
  pub r#type: String,
  pub offset: usize,
}
