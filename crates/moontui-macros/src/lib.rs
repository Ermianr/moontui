use proc_macro::TokenStream;
use proc_macro2::Span;
use quote::quote;
use std::fs;
use std::path::PathBuf;
use syn::parse::{Parse, ParseStream};
use syn::spanned::Spanned;
use syn::{
  FnArg, Ident, ImplItem, ItemFn, ItemImpl, ItemStruct, ReturnType, Token, Type, parse_macro_input,
};

mod schema;
use schema::{CallbackDef, FieldDef, FunctionDef, ParamDef, Schema, StructDef};

mod codegen;
use codegen::generate_wrapper;

mod naming;
use naming::snake_to_camel;

struct ExportAttr {
  name: Option<String>,
}

impl Parse for ExportAttr {
  fn parse(input: ParseStream) -> syn::Result<Self> {
    if input.is_empty() {
      return Ok(ExportAttr { name: None });
    }
    let name_ident: Ident = input.parse()?;
    if name_ident != "name" {
      return Err(syn::Error::new(name_ident.span(), "expected `name`"));
    }
    let _: Token![=] = input.parse()?;
    let name_str: syn::LitStr = input.parse()?;
    Ok(ExportAttr { name: Some(name_str.value()) })
  }
}

#[proc_macro_attribute]
pub fn moontui_export(attr: TokenStream, item: TokenStream) -> TokenStream {
  let input = item.clone();
  let export_attr = parse_macro_input!(attr as ExportAttr);

  // Try parsing as impl block first
  if let Ok(impl_block) = syn::parse::<ItemImpl>(input.clone()) {
    match generate_export(&export_attr, &impl_block) {
      Ok(ts) => return ts.into(),
      Err(e) => return e.to_compile_error().into(),
    }
  }

  // Try parsing as struct
  let input2 = item;
  if let Ok(item_struct) = syn::parse::<ItemStruct>(input2.clone()) {
    match generate_struct_export(&item_struct) {
      Ok(ts) => return ts.into(),
      Err(e) => return e.to_compile_error().into(),
    }
  }

  syn::Error::new(Span::call_site(), "expected an impl block or struct").to_compile_error().into()
}

#[proc_macro_attribute]
pub fn moontui_export_manual(_attr: TokenStream, item: TokenStream) -> TokenStream {
  let func = parse_macro_input!(item as ItemFn);
  match generate_manual_export(&func) {
    Ok(ts) => ts.into(),
    Err(e) => e.to_compile_error().into(),
  }
}

#[proc_macro_attribute]
pub fn moontui_skip(_attr: TokenStream, item: TokenStream) -> TokenStream {
  item
}

fn generate_export(
  attr: &ExportAttr,
  impl_block: &ItemImpl,
) -> syn::Result<proc_macro2::TokenStream> {
  let self_type = match &*impl_block.self_ty {
    Type::Path(tp) => tp
      .path
      .segments
      .last()
      .ok_or_else(|| syn::Error::new(tp.span(), "expected a type name"))?
      .ident
      .to_string(),
    _ => return Err(syn::Error::new(impl_block.self_ty.span(), "expected a path type")),
  };

  let mut schema = load_schema();
  let mut wrappers = Vec::new();

  for item in &impl_block.items {
    let ImplItem::Fn(method) = item else {
      continue;
    };

    let sig = &method.sig;

    let is_self_receiver = sig.inputs.iter().any(|arg| matches!(arg, FnArg::Receiver(_)));
    if !is_self_receiver {
      continue;
    }

    // Skip methods that return references - they can't be easily converted to extern "C"
    if let ReturnType::Type(_, ty) = &sig.output
      && matches!(ty.as_ref(), Type::Reference(_))
    {
      continue;
    }

    // Skip methods marked with #[moontui_skip]
    if has_skip_attribute(&method.attrs) {
      continue;
    }

    let method_name = sig.ident.to_string();
    let base_name = snake_to_camel(&method_name);

    // Prefix FFI name with type name to avoid conflicts
    let ffi_name = if let Some(ref prefix) = attr.name {
      // Use attribute name as prefix: "buffer" -> "bufferClear", "bufferDrawText"
      format!("{}{}", prefix, capitalize_first(&base_name))
    } else {
      match self_type.as_str() {
        "CliRenderer" => {
          // For CliRenderer, append "Renderer" to the method name
          if base_name == "destroy" || base_name == "resize" {
            format!("{base_name}Renderer")
          } else {
            base_name.clone()
          }
        }
        "OptimizedBuffer" => {
          // For OptimizedBuffer, prefix with "buffer"
          format!("buffer{}", capitalize_first(&base_name))
        }
        _ => base_name.clone(),
      }
    };

    let mut params = Vec::new();
    params.push(ParamDef {
      name: "self_ptr".to_string(),
      r#type: "ptr".to_string(),
      role: "self".to_string(),
      pointer_mutability: None,
    });

    for arg in &sig.inputs {
      if let FnArg::Typed(pat_type) = arg {
        let name = match &*pat_type.pat {
          syn::Pat::Ident(id) => id.ident.to_string(),
          _ => "arg".to_string(),
        };
        let ty = type_to_ffi(&pat_type.ty)?;
        let pointer_mutability = pointer_mutability(&pat_type.ty);
        params.push(ParamDef { name, r#type: ty, role: "arg".to_string(), pointer_mutability });
      }
    }

    let returns = match &sig.output {
      ReturnType::Default => "void".to_string(),
      ReturnType::Type(_, ty) => type_to_ffi(ty)?,
    };

    // Check for @ffi_manual doc comments on methods
    let method_docs = extract_doc_comments(&method.attrs);
    let is_manual = method_docs.iter().any(|c| c.starts_with("@ffi_manual"));
    let ts_metadata = if is_manual {
      parse_ts_metadata(&method_docs)
    } else {
      TsMetadata { ts_body: None, ts_args: None, ts_returns: None }
    };

    let fn_def = FunctionDef {
      rust_name: method_name,
      receiver: Some(self_type.clone()),
      params,
      returns,
      ffi_name: ffi_name.clone(),
      api_group: api_group(Some(&self_type), &ffi_name).to_string(),
      manual: is_manual,
      output_struct: output_struct_for(&ffi_name),
      ts_body: ts_metadata.ts_body,
      ts_args: ts_metadata.ts_args,
      ts_returns: ts_metadata.ts_returns,
    };

    insert_function(&mut schema, &ffi_name, fn_def, sig.ident.span())?;

    let wrapper = generate_wrapper(&self_type, sig, &ffi_name);
    wrappers.push(wrapper);
  }

  save_schema(&schema)?;

  let expanded = quote! {
      #impl_block

      #(#wrappers)*
  };

  Ok(expanded)
}

fn generate_struct_export(item_struct: &ItemStruct) -> syn::Result<proc_macro2::TokenStream> {
  let struct_name = item_struct.ident.to_string();
  let mut schema = load_schema();

  let mut fields = Vec::new();
  let mut offset = 0usize;

  for field in &item_struct.fields {
    let field_name = field
      .ident
      .as_ref()
      .ok_or_else(|| syn::Error::new(field.span(), "expected named field"))?
      .to_string();
    let (ffi_type, size, alignment) = struct_field_info(&field.ty)?;
    // Align offset
    offset = (offset + alignment - 1) & !(alignment - 1);
    fields.push(FieldDef { name: field_name, r#type: ffi_type, offset });
    offset += size;
  }

  // For #[repr(C)], the total size is the offset after the last field plus padding
  // We need the actual alignment of the struct (max field alignment)
  let max_alignment = fields.iter().try_fold(1usize, |acc, f| {
    let (_, _, align) = struct_field_info_by_type(&f.r#type)?;
    Ok::<usize, syn::Error>(acc.max(align))
  })?;
  let total_size = (offset + max_alignment - 1) & !(max_alignment - 1);

  let struct_def =
    StructDef { repr: "C".to_string(), fields, size: total_size, alignment: max_alignment };

  schema.structs.insert(struct_name, struct_def);
  save_schema(&schema)?;

  // Output the struct unchanged
  Ok(quote! { #item_struct })
}

fn struct_field_info(ty: &Type) -> syn::Result<(String, usize, usize)> {
  match ty {
    Type::Path(tp) => {
      let name = tp.path.segments.last().map(|s| s.ident.to_string()).unwrap_or_default();
      struct_field_info_by_type(&name)
    }
    _ => Err(syn::Error::new(ty.span(), "unsupported field type for struct export")),
  }
}

fn struct_field_info_by_type(type_name: &str) -> syn::Result<(String, usize, usize)> {
  match type_name {
    "bool" => Ok(("bool".to_string(), 1, 1)),
    "u8" => Ok(("u8".to_string(), 1, 1)),
    "i8" => Ok(("i8".to_string(), 1, 1)),
    "u16" => Ok(("u16".to_string(), 2, 2)),
    "i16" => Ok(("i16".to_string(), 2, 2)),
    "u32" | "MousePointerStyle" => Ok(("u32".to_string(), 4, 4)),
    "i32" => Ok(("i32".to_string(), 4, 4)),
    "u64" | "usize" => Ok(("u64".to_string(), 8, 8)),
    "i64" => Ok(("i64".to_string(), 8, 8)),
    "f32" => Ok(("f32".to_string(), 4, 4)),
    "f64" => Ok(("f64".to_string(), 8, 8)),
    _ => Err(syn::Error::new(Span::call_site(), format!("unsupported FFI type `{type_name}`"))),
  }
}

fn generate_manual_export(func: &ItemFn) -> syn::Result<proc_macro2::TokenStream> {
  let fn_name = func.sig.ident.to_string();

  // Extract @ffi_manual and TS metadata from doc comments
  let doc_comments = extract_doc_comments(&func.attrs);
  let ts_metadata = parse_ts_metadata(&doc_comments);

  let mut schema = load_schema();

  // Parse function parameters
  let mut params = Vec::new();
  for arg in &func.sig.inputs {
    if let FnArg::Typed(pat_type) = arg {
      let name = match &*pat_type.pat {
        syn::Pat::Ident(id) => id.ident.to_string(),
        _ => "arg".to_string(),
      };
      let ty = type_to_ffi(&pat_type.ty)?;
      let pointer_mutability = pointer_mutability(&pat_type.ty);
      params.push(ParamDef { name, r#type: ty, role: "arg".to_string(), pointer_mutability });
    }
  }

  let returns = match &func.sig.output {
    ReturnType::Default => "void".to_string(),
    ReturnType::Type(_, ty) => type_to_ffi(ty)?,
  };

  let fn_def = FunctionDef {
    rust_name: fn_name.clone(),
    receiver: None,
    params,
    returns,
    ffi_name: fn_name.clone(),
    api_group: api_group(None, &fn_name).to_string(),
    manual: true,
    output_struct: output_struct_for(&fn_name),
    ts_body: ts_metadata.ts_body,
    ts_args: ts_metadata.ts_args,
    ts_returns: ts_metadata.ts_returns,
  };

  insert_function(&mut schema, &fn_name, fn_def, func.sig.ident.span())?;
  save_schema(&schema)?;

  // Output the function unchanged
  Ok(quote! { #func })
}

#[expect(clippy::struct_field_names)]
struct TsMetadata {
  ts_body: Option<String>,
  ts_args: Option<String>,
  ts_returns: Option<String>,
}

fn extract_doc_comments(attrs: &[syn::Attribute]) -> Vec<String> {
  let mut comments = Vec::new();
  for attr in attrs {
    if attr.path().is_ident("doc")
      && let syn::Meta::NameValue(nv) = &attr.meta
      && let syn::Expr::Lit(expr_lit) = &nv.value
      && let syn::Lit::Str(lit_str) = &expr_lit.lit
    {
      let text = lit_str.value();
      let trimmed = text.trim();
      if !trimmed.is_empty() {
        comments.push(trimmed.to_string());
      }
    }
  }
  comments
}

fn parse_ts_metadata(doc_comments: &[String]) -> TsMetadata {
  let mut ts_body = None;
  let mut ts_args = None;
  let mut ts_returns = None;

  for comment in doc_comments {
    if let Some(rest) = comment.strip_prefix("@ts_body ") {
      ts_body = Some(rest.to_string());
    } else if let Some(rest) = comment.strip_prefix("@ts_args ") {
      ts_args = Some(rest.to_string());
    } else if let Some(rest) = comment.strip_prefix("@ts_returns ") {
      ts_returns = Some(rest.to_string());
    }
  }

  TsMetadata { ts_body, ts_args, ts_returns }
}

fn has_skip_attribute(attrs: &[syn::Attribute]) -> bool {
  attrs.iter().any(|attr| attr.path().is_ident("moontui_skip"))
}

fn type_to_ffi(ty: &Type) -> syn::Result<String> {
  match ty {
    Type::Path(tp) => {
      let name = tp.path.segments.last().map(|s| s.ident.to_string()).unwrap_or_default();
      if name == "Option" {
        return Ok("ptr".to_string());
      }
      struct_field_info_by_type(&name).map(|(ffi_type, _, _)| ffi_type)
    }
    Type::Reference(_) | Type::Ptr(_) => Ok("ptr".to_string()),
    _ => Err(syn::Error::new(ty.span(), "unsupported FFI type")),
  }
}

fn pointer_mutability(ty: &Type) -> Option<String> {
  match ty {
    Type::Ptr(ptr) if ptr.mutability.is_some() => Some("mutable".to_string()),
    Type::Ptr(_) | Type::Reference(_) => Some("readonly".to_string()),
    _ => None,
  }
}

fn api_group(receiver: Option<&str>, ffi_name: &str) -> &'static str {
  match receiver {
    Some("OptimizedBuffer") => "buffer",
    Some("CliRenderer") => "renderer",
    _ if ffi_name.starts_with("buffer") => "buffer",
    _ if matches!(ffi_name, "setupTerminal" | "restoreTerminal" | "getTerminalSize") => "terminal",
    _ => "renderer",
  }
}

fn output_struct_for(ffi_name: &str) -> Option<String> {
  match ffi_name {
    "getCapabilities" => Some("Capabilities".to_string()),
    "getRenderStats" => Some("FrameStats".to_string()),
    _ => None,
  }
}

fn insert_function(
  schema: &mut Schema,
  ffi_name: &str,
  fn_def: FunctionDef,
  span: Span,
) -> syn::Result<()> {
  if let Some(existing) = schema.functions.get(ffi_name)
    && (existing.rust_name != fn_def.rust_name || existing.receiver != fn_def.receiver)
  {
    return Err(syn::Error::new(span, format!("duplicate FFI export `{ffi_name}`")));
  }
  schema.functions.insert(ffi_name.to_string(), fn_def);
  Ok(())
}

fn schema_path() -> PathBuf {
  let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR not set");
  PathBuf::from(manifest_dir)
    .parent()
    .expect("no parent dir")
    .parent()
    .expect("no workspace root")
    .join("target")
    .join("moontui-schema.json")
}

fn load_schema() -> Schema {
  let path = schema_path();
  if path.exists() {
    let data = fs::read_to_string(&path).unwrap_or_default();
    serde_json::from_str(&data).unwrap_or_default()
  } else {
    Schema::default()
  }
}

fn save_schema(schema: &Schema) -> syn::Result<()> {
  let mut schema = schema.clone();
  let path = schema_path();
  if path.exists() {
    let data = fs::read_to_string(&path).unwrap_or_default();
    if let Ok(existing) = serde_json::from_str::<Schema>(&data) {
      for (name, function) in existing.functions {
        schema.functions.entry(name).or_insert(function);
      }
      for (name, struct_def) in existing.structs {
        schema.structs.entry(name).or_insert(struct_def);
      }
      for (name, callback) in existing.callbacks {
        schema.callbacks.entry(name).or_insert(callback);
      }
    }
  }
  ensure_schema_metadata(&mut schema);
  let json = serde_json::to_string_pretty(&schema)
    .map_err(|e| syn::Error::new(Span::call_site(), e.to_string()))?;
  fs::write(&path, json).map_err(|e| syn::Error::new(Span::call_site(), e.to_string()))?;
  Ok(())
}

fn ensure_schema_metadata(schema: &mut Schema) {
  if !schema.callbacks.is_empty() {
    return;
  }
  schema.callbacks.insert(
    "event".to_string(),
    CallbackDef {
      name: "EventCallback".to_string(),
      ffi_args: vec!["ptr".to_string(), "u64".to_string(), "ptr".to_string(), "u64".to_string(), "bool".to_string(), "bool".to_string(), "bool".to_string()],
      handler_params: "typePtr: number, typeLen: bigint, keyPtr: number, keyLen: bigint, ctrl: boolean, shift: boolean, alt: boolean".to_string(),
      handler_body: "const tLen = Number(typeLen)\nconst kLen = Number(keyLen)\nif (!typePtr || tLen === 0 || !keyPtr || kLen === 0) { return }\nconst type = decodeStringPointer(typePtr, tLen)\nconst key = decodeStringPointer(keyPtr, kLen)\nif (type !== \"key\") { return }\nhandler({ key, ctrl, shift, alt })".to_string(),
      handler_type: "(event: { key: string; ctrl: boolean; shift: boolean; alt: boolean }) => void".to_string(),
    },
  );
  schema.callbacks.insert(
    "resize".to_string(),
    CallbackDef {
      name: "ResizeCallback".to_string(),
      ffi_args: vec!["u32".to_string(), "u32".to_string()],
      handler_params: "width: number, height: number".to_string(),
      handler_body: "handler({ width, height })".to_string(),
      handler_type: "(event: { width: number; height: number }) => void".to_string(),
    },
  );
  schema.callbacks.insert(
    "mouse".to_string(),
    CallbackDef {
      name: "MouseCallback".to_string(),
      ffi_args: vec!["ptr".to_string(), "u64".to_string(), "ptr".to_string(), "u64".to_string(), "u32".to_string(), "u32".to_string(), "u32".to_string(), "bool".to_string(), "bool".to_string(), "bool".to_string(), "u32".to_string()],
      handler_params: "typePtr: number, typeLen: bigint, kindPtr: number, kindLen: bigint, button: number, x: number, y: number, ctrl: boolean, shift: boolean, alt: boolean, scrollDir: number".to_string(),
      handler_body: "const tLen = Number(typeLen)\nconst kLen = Number(kindLen)\nif (!typePtr || tLen === 0 || !kindPtr || kLen === 0) { return }\nconst type = decodeStringPointer(typePtr, tLen)\nconst kind = decodeStringPointer(kindPtr, kLen)\nif (type !== \"mouse\") { return }\nhandler({ kind, button, x, y, ctrl, shift, alt, scrollDir })".to_string(),
      handler_type: "(event: { kind: string; button: number; x: number; y: number; ctrl: boolean; shift: boolean; alt: boolean; scrollDir: number }) => void".to_string(),
    },
  );
}

fn capitalize_first(s: &str) -> String {
  let mut chars = s.chars();
  match chars.next() {
    None => String::new(),
    Some(c) => c.to_uppercase().to_string() + chars.as_str(),
  }
}
