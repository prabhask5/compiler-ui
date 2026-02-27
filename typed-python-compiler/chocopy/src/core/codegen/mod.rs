#[cfg(feature = "native")]
mod codeview;
#[cfg(feature = "native")]
mod debug;
#[cfg(feature = "native")]
mod dwarf;
#[cfg(feature = "native")]
mod gimli_writer;
#[allow(dead_code)]
mod x64;
#[allow(dead_code)]
pub mod asm_text;

use crate::common::local_env::*;
use crate::common::node::*;
use std::collections::BTreeMap;
use std::collections::HashMap;

#[cfg(feature = "native")]
use debug::*;
#[cfg(feature = "native")]
use object::{write::*, *};
#[cfg(feature = "native")]
use std::convert::*;
#[cfg(feature = "native")]
use std::ffi::OsStr;
#[cfg(feature = "native")]
use std::io::Write;
#[cfg(feature = "native")]
use std::path::*;

// Names for special symbol
// These constants are used by x64.rs and gen_object (native only).
#[allow(dead_code)]
const BOOL_PROTOTYPE: &str = "bool.$proto";
#[allow(dead_code)]
const INT_PROTOTYPE: &str = "int.$proto";
#[allow(dead_code)]
const STR_PROTOTYPE: &str = "str.$proto";
#[allow(dead_code)]
const BOOL_LIST_PROTOTYPE: &str = "[bool].$proto";
#[allow(dead_code)]
const INT_LIST_PROTOTYPE: &str = "[int].$proto";
#[allow(dead_code)]
const OBJECT_LIST_PROTOTYPE: &str = "[object].$proto";
#[allow(dead_code)]
const BUILTIN_ALLOC_OBJ: &str = "$alloc_obj";
#[allow(dead_code)]
const BUILTIN_DIV_ZERO: &str = "$div_zero";
#[allow(dead_code)]
const BUILTIN_OUT_OF_BOUND: &str = "$out_of_bound";
#[allow(dead_code)]
const BUILTIN_NONE_OP: &str = "$none_op";
#[allow(dead_code)]
const BUILTIN_LEN: &str = "$len";
#[allow(dead_code)]
const BUILTIN_INPUT: &str = "$input";
#[allow(dead_code)]
const BUILTIN_PRINT: &str = "$print";
#[allow(dead_code)]
const BUILTIN_INIT: &str = "$init";
#[allow(dead_code)]
const BUILTIN_CHOCOPY_MAIN: &str = "$chocopy_main";
#[allow(dead_code)]
const GLOBAL_SECTION: &str = "$global";
#[allow(dead_code)]
const INIT_PARAM: &str = "$init_param";

#[derive(PartialEq, Eq, Clone, Copy)]
pub enum Platform {
    Windows,
    Linux,
    Macos,
}

// The types below are constructed by x64.rs and consumed by gen_object/debug (native).
// When building without native, some fields appear unused — allow(dead_code) silences this.

/// Type for debug info
///
/// Example: `[[[str]]]` will be `TypeDebug { core_name: "str", array_level: 3 }`
#[derive(PartialEq, Eq, Hash, Clone)]
#[allow(dead_code)]
struct TypeDebug {
    core_name: String,
    array_level: u32,
}

/// Represents a group of types for debug info
#[allow(dead_code)]
struct TypeDebugRepresentive<'a> {
    core_name: &'a str,
    max_array_level: u32,
}

#[allow(dead_code)]
impl TypeDebug {
    /// Construct a non-list type
    fn class_type(name: &str) -> TypeDebug {
        TypeDebug {
            core_name: name.to_owned(),
            array_level: 0,
        }
    }
    fn from_annotation(type_annotation: &TypeAnnotation) -> TypeDebug {
        match type_annotation {
            TypeAnnotation::ClassType(c) => TypeDebug {
                core_name: c.class_name.clone(),
                array_level: 0,
            },
            TypeAnnotation::ListType(l) => {
                let mut type_debug = TypeDebug::from_annotation(&l.element_type);
                type_debug.array_level += 1;
                type_debug
            }
        }
    }
}

impl std::fmt::Display for TypeDebug {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        for _ in 0..self.array_level {
            write!(f, "[")?;
        }
        write!(f, "{}", &self.core_name)?;
        for _ in 0..self.array_level {
            write!(f, "]")?;
        }
        Ok(())
    }
}

// Variable info for debug info
#[derive(Clone)]
#[allow(dead_code)]
struct VarDebug {
    offset: i32,
    line: u32,
    name: String,
    var_type: TypeDebug,
}

// Relates machine code with source code
#[allow(dead_code)]
pub(crate) struct LineMap {
    pub(crate) code_pos: usize,
    pub(crate) line_number: u32,
}

// Procedure info for debug info
#[allow(dead_code)]
pub(crate) struct ProcedureDebug {
    pub(crate) decl_line: u32,
    pub(crate) artificial: bool,
    parent: Option<String>,
    pub(crate) lines: Vec<LineMap>,
    return_type: TypeDebug,
    params: Vec<VarDebug>,
    locals: Vec<VarDebug>,
    frame_size: u32,
}

impl ProcedureDebug {
    #[allow(dead_code)]
    fn used_types(&self) -> impl Iterator<Item = &TypeDebug> {
        std::iter::once(&self.return_type)
            .chain(self.params.iter().map(|param| &param.var_type))
            .chain(self.locals.iter().map(|local| &local.var_type))
    }
}

// Extra info for a chunk
#[allow(dead_code)]
pub(crate) enum ChunkExtra {
    Procedure(ProcedureDebug),
    Data { writable: bool },
}

// The target of a relocation
#[allow(dead_code)]
pub(crate) enum ChunkLinkTarget {
    Symbol(String, i32),
    Data(Vec<u8>),
}

// Relocation between chunks
#[allow(dead_code)]
pub(crate) struct ChunkLink {
    pub(crate) pos: usize,
    pub(crate) to: ChunkLinkTarget,
}

// A piece of data with a symbol name
#[allow(dead_code)]
pub(crate) struct Chunk {
    pub(crate) name: String,
    pub(crate) code: Vec<u8>,
    pub(crate) links: Vec<ChunkLink>,
    pub(crate) extra: ChunkExtra,
}

// Relocation type for debug chunk
#[allow(dead_code)]
enum DebugChunkLinkType {
    Absolute,
    SectionRelative,
    SectionId,
    ImageRelative,
}

// Relocation between chunks, specifically when the source chunk is debug info
#[allow(dead_code)]
struct DebugChunkLink {
    link_type: DebugChunkLinkType,
    pos: usize,
    to: String,
    size: u8,
}

// Chunk for debug info
#[allow(dead_code)]
struct DebugChunk {
    name: String,
    code: Vec<u8>,
    links: Vec<DebugChunkLink>,
    discardable: bool,
}

// Method type info for debug info
#[derive(Clone, PartialEq, Eq, Hash)]
#[allow(dead_code)]
struct MethodDebug {
    params: Vec<TypeDebug>,
    return_type: TypeDebug,
}

// Class info for debug info
#[derive(Clone)]
#[allow(dead_code)]
struct ClassDebug {
    size: u32,
    attributes: Vec<VarDebug>,
    methods: BTreeMap<u32, (String, MethodDebug)>,
}

impl ClassDebug {
    #[allow(dead_code)]
    fn used_types(&self) -> impl Iterator<Item = &TypeDebug> {
        self.attributes.iter().map(|attribute| &attribute.var_type)
    }
}

// The generated ChocoPy program, without linking to other libraries
#[allow(dead_code, private_interfaces)]
pub struct CodeSet {
    pub(crate) chunks: Vec<Chunk>,
    global_size: u64,
    globals_debug: Vec<VarDebug>,
    classes_debug: HashMap<String, ClassDebug>,
}

impl CodeSet {
    #[allow(dead_code)]
    fn used_types(&self) -> impl Iterator<Item = &TypeDebug> {
        self.chunks
            .iter()
            .filter_map(|chunk| {
                if let ChunkExtra::Procedure(procedure) = &chunk.extra {
                    Some(procedure.used_types())
                } else {
                    None
                }
            })
            .flatten()
            .chain(self.globals_debug.iter().map(|global| &global.var_type))
            .chain(
                self.classes_debug
                    .iter()
                    .flat_map(|(_, class)| class.used_types()),
            )
    }

    #[allow(dead_code)]
    fn used_types_representive(&self) -> impl Iterator<Item = TypeDebugRepresentive<'_>> {
        let mut array_level_map = HashMap::<&str, u32>::new();
        for type_used in self.used_types() {
            if let Some(array_level) = array_level_map.get_mut(type_used.core_name.as_str()) {
                *array_level = std::cmp::max(*array_level, type_used.array_level)
            } else {
                array_level_map.insert(&type_used.core_name, type_used.array_level);
            }
        }
        array_level_map.entry("int").or_insert(0);
        array_level_map.entry("str").or_insert(0);
        array_level_map.entry("bool").or_insert(0);
        array_level_map.entry("object").or_insert(0);
        array_level_map.entry("<None>").or_insert(0);
        array_level_map
            .into_iter()
            .map(|(core_name, max_array_level)| TypeDebugRepresentive {
                core_name,
                max_array_level,
            })
    }
}

/// Generate machine code from a typed AST (public wrapper for WASM use)
#[allow(dead_code, private_interfaces)]
pub fn gen_code_set(ast: Program, platform: Platform) -> CodeSet {
    x64::gen_code_set(ast, platform)
}

#[cfg(feature = "native")]
#[derive(Debug)]
struct ToolChainError;

#[cfg(feature = "native")]
impl std::fmt::Display for ToolChainError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "Failed to find MSVC tools. Please install Visual Studio or Visual C++ Build Tools"
        )
    }
}

#[cfg(feature = "native")]
impl std::error::Error for ToolChainError {}

#[cfg(feature = "native")]
#[derive(Debug)]
pub struct PathError;

#[cfg(feature = "native")]
impl std::fmt::Display for PathError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "Illegal path")
    }
}

#[cfg(feature = "native")]
impl std::error::Error for PathError {}

#[cfg(feature = "native")]
fn windows_path_escape(path: &Path) -> std::result::Result<String, Box<dyn std::error::Error>> {
    let path = path.to_str().ok_or(PathError)?;

    if path
        .find(|c| matches!(c, '\"' | '\'' | '^') || c.is_control())
        .is_some()
        || path.ends_with('\\')
    {
        return Err(PathError.into());
    }

    Ok(path.to_owned())
}

#[cfg(feature = "native")]
pub fn gen_object(
    source_path: &str,
    ast: Program,
    obj_path: &Path,
    platform: Platform,
) -> std::result::Result<(), Box<dyn std::error::Error>> {
    let current_dir_buf = std::env::current_dir();
    let current_dir = current_dir_buf
        .as_ref()
        .map(|s| s.to_str())
        .ok()
        .flatten()
        .unwrap_or("");

    let mut debug: Box<dyn DebugWriter> = match platform {
        Platform::Windows => Box::new(codeview::Codeview::new(
            source_path,
            current_dir,
            obj_path.as_os_str().to_str().unwrap_or(""),
        )?),
        Platform::Linux => Box::new(dwarf::Dwarf::new(
            dwarf::DwarfFlavor::Linux,
            source_path,
            current_dir,
        )),
        Platform::Macos => Box::new(dwarf::Dwarf::new(
            dwarf::DwarfFlavor::Macos,
            source_path,
            current_dir,
        )),
    };

    let binary_format = match platform {
        Platform::Windows => BinaryFormat::Coff,
        Platform::Linux => BinaryFormat::Elf,
        Platform::Macos => BinaryFormat::MachO,
    };

    let mut obj = Object::new(binary_format, Architecture::X86_64, Endianness::Little);

    let import_function = |obj: &mut Object, name: &str| {
        obj.add_symbol(Symbol {
            name: name.into(),
            value: 0,
            size: 0,
            kind: SymbolKind::Text,
            scope: SymbolScope::Linkage,
            weak: false,
            section: SymbolSection::Undefined,
            flags: SymbolFlags::None,
        })
    };

    import_function(&mut obj, BUILTIN_ALLOC_OBJ);
    import_function(&mut obj, BUILTIN_DIV_ZERO);
    import_function(&mut obj, BUILTIN_OUT_OF_BOUND);
    import_function(&mut obj, BUILTIN_NONE_OP);
    import_function(&mut obj, BUILTIN_LEN);
    import_function(&mut obj, BUILTIN_PRINT);
    import_function(&mut obj, BUILTIN_INPUT);
    import_function(&mut obj, BUILTIN_INIT);

    let code_set = x64::gen_code_set(ast, platform);

    for t in code_set.used_types_representive() {
        debug.add_type(t);
    }

    for (class_name, classes_debug) in code_set.classes_debug {
        debug.add_class(class_name, classes_debug);
    }

    let bss_section = obj.section_id(StandardSection::UninitializedData);

    let global_symbol = obj.add_symbol(Symbol {
        name: GLOBAL_SECTION.into(),
        value: 0,
        size: code_set.global_size,
        kind: SymbolKind::Data,
        scope: SymbolScope::Compilation,
        weak: false,
        section: SymbolSection::Undefined,
        flags: SymbolFlags::None,
    });

    obj.add_symbol_bss(global_symbol, bss_section, code_set.global_size, 8);

    for global_debug in code_set.globals_debug {
        debug.add_global(global_debug);
    }

    let mut section_map = HashMap::new();

    let text_section = obj.section_id(StandardSection::Text);
    let data_section = obj.section_id(StandardSection::Data);
    let ro_section = obj.section_id(StandardSection::ReadOnlyData);
    let ro_reloc_section = obj.section_id(StandardSection::ReadOnlyDataWithRel);

    for chunk in &code_set.chunks {
        debug.add_chunk(chunk);

        let section;
        let align;
        let kind;
        match chunk.extra {
            ChunkExtra::Procedure(_) => {
                section = text_section;
                align = 1;
                kind = SymbolKind::Text;
            }
            ChunkExtra::Data { writable } => {
                section = if writable {
                    data_section
                } else if chunk.links.is_empty() {
                    ro_section
                } else {
                    ro_reloc_section
                };
                align = 8;
                kind = SymbolKind::Data;
            }
        }

        let scope = if chunk.name == BUILTIN_CHOCOPY_MAIN {
            SymbolScope::Linkage
        } else {
            SymbolScope::Compilation
        };

        let offset = obj.append_section_data(section, &chunk.code, align);
        obj.add_symbol(Symbol {
            name: chunk.name.as_bytes().into(),
            value: offset,
            size: chunk.code.len() as u64,
            kind,
            scope,
            weak: false,
            section: SymbolSection::Section(section),
            flags: SymbolFlags::None,
        });
        section_map.insert(&chunk.name, (section, offset));
    }

    let mut data_id = 0;

    for chunk in &code_set.chunks {
        let (from, from_offset) = section_map[&chunk.name];
        let size;
        let kind;
        let encoding;
        let addend;
        if let ChunkExtra::Procedure(_) = chunk.extra {
            size = 32;
            kind = RelocationKind::Relative;
            encoding = RelocationEncoding::X86RipRelative;
            addend = -4;
        } else {
            size = 64;
            kind = RelocationKind::Absolute;
            encoding = RelocationEncoding::Generic;
            addend = 0;
        };
        for link in &chunk.links {
            let (symbol, symbol_addend) = match &link.to {
                ChunkLinkTarget::Symbol(symbol, addend) => {
                    (obj.symbol_id(symbol.as_bytes()).unwrap(), *addend)
                }
                ChunkLinkTarget::Data(data) => {
                    let name = format!("$str{}", data_id);
                    data_id += 1;
                    let offset = obj.append_section_data(ro_section, data, 1);

                    (
                        obj.add_symbol(Symbol {
                            name: name.into(),
                            value: offset,
                            size: 0,
                            kind: SymbolKind::Data,
                            scope: SymbolScope::Compilation,
                            weak: false,
                            section: SymbolSection::Section(ro_section),
                            flags: SymbolFlags::None,
                        }),
                        0,
                    )
                }
            };
            obj.add_relocation(
                from,
                Relocation {
                    offset: from_offset + link.pos as u64,
                    size,
                    kind,
                    encoding,
                    symbol,
                    addend: addend + symbol_addend as i64,
                },
            )?;
        }
    }

    let debug_chunks = debug.finalize();
    let mut debug_section_map = HashMap::new();
    for chunk in &debug_chunks {
        let kind = if chunk.discardable {
            SectionKind::Debug
        } else {
            SectionKind::ReadOnlyData
        };
        let section = obj.add_section(
            obj.segment_name(StandardSegment::Debug).into(),
            chunk.name.as_bytes().into(),
            kind,
        );
        obj.append_section_data(section, &chunk.code, 8);
        debug_section_map.insert(chunk.name.clone(), section);
    }

    for chunk in debug_chunks {
        for link in chunk.links {
            let to = obj
                .symbol_id(link.to.as_bytes())
                .unwrap_or_else(|| obj.section_symbol(debug_section_map[&link.to]));
            let kind = match link.link_type {
                DebugChunkLinkType::Absolute => RelocationKind::Absolute,
                DebugChunkLinkType::SectionRelative => RelocationKind::SectionOffset,
                DebugChunkLinkType::SectionId => RelocationKind::SectionIndex,
                DebugChunkLinkType::ImageRelative => RelocationKind::ImageOffset,
            };
            obj.add_relocation(
                debug_section_map[&chunk.name],
                Relocation {
                    offset: link.pos as u64,
                    size: link.size * 8,
                    kind,
                    encoding: RelocationEncoding::Generic,
                    symbol: to,
                    addend: 0,
                },
            )?;
        }
    }

    let mut obj_file = std::fs::File::create(obj_path)?;
    obj_file.write_all(&obj.write()?)?;

    Ok(())
}

#[cfg(feature = "native")]
pub fn link(
    obj_path: &Path,
    path: &str,
    static_lib: bool,
    platform: Platform,
) -> std::result::Result<(), Box<dyn std::error::Error>> {
    let lib_file = match platform {
        Platform::Windows => "chocopy_stdlib.lib",
        Platform::Linux | Platform::Macos => "libchocopy_stdlib.a",
    };

    let mut lib_path = std::env::current_exe()?;
    lib_path.set_file_name(lib_file);

    let ld_output = match platform {
        Platform::Windows => {
            let vcvarsall = (|| -> Option<PathBuf> {
                let linker = cc::windows_registry::find_tool("x86_64-pc-windows-msvc", "link.exe")?;
                Some(
                    linker
                        .path()
                        .ancestors()
                        .nth(7)?
                        .join("Auxiliary")
                        .join("Build")
                        .join("vcvarsall.bat"),
                )
            })()
            .ok_or(ToolChainError)?;

            let libs = if static_lib {
                "libvcruntime.lib libucrt.lib libcmt.lib"
            } else {
                "vcruntime.lib ucrt.lib msvcrt.lib"
            };

            let batch_content = format!(
                "@echo off
    call \"{}\" amd64
    link /NOLOGO /NXCOMPAT /OPT:REF,NOICF \
    \"{}\" \"{}\" /OUT:\"{}\" \
    kernel32.lib advapi32.lib ws2_32.lib userenv.lib Bcrypt.lib ntdll.lib {} \
    /SUBSYSTEM:CONSOLE /DEBUG",
                windows_path_escape(&vcvarsall)?,
                windows_path_escape(obj_path)?,
                windows_path_escape(&lib_path)?,
                windows_path_escape(Path::new(path))?,
                libs
            );

            let mut bat_path = std::env::temp_dir();
            let bat_name = format!("chocopy-{}.bat", rand::random::<u32>());
            bat_path.push(bat_name);

            std::fs::write(&bat_path, batch_content)?;

            let ld_output = std::process::Command::new("cmd")
                .args([OsStr::new("/c"), bat_path.as_os_str()])
                .output()?;
            std::fs::remove_file(&bat_path)?;
            ld_output
        }
        Platform::Linux | Platform::Macos => {
            let mut command = std::process::Command::new("cc");
            command.args([
                OsStr::new("-arch"),
                OsStr::new("x86_64"),
                OsStr::new("-o"),
                OsStr::new(path),
                obj_path.as_os_str(),
                lib_path.as_os_str(),
                OsStr::new("-pthread"),
                OsStr::new("-ldl"),
            ]);
            if static_lib {
                command.arg("-static");
            }
            command.output()?
        }
    };

    if !ld_output.status.success() {
        eprintln!("Error: Linker returned {}", ld_output.status);
        if !ld_output.stdout.is_empty() {
            eprintln!("STDOUT from linker:");
            std::io::stderr().write_all(&ld_output.stdout).unwrap();
        }
        if !ld_output.stderr.is_empty() {
            eprintln!("STDERR from linker:");
            std::io::stderr().write_all(&ld_output.stderr).unwrap();
        }
    }

    Ok(())
}

#[cfg(feature = "native")]
pub fn codegen(
    source_path: &str,
    ast: Program,
    path: &str,
    no_link: bool,
    static_lib: bool,
    platform: Platform,
) -> std::result::Result<(), Box<dyn std::error::Error>> {
    let obj_path = if no_link {
        let obj_path = Path::new(path);
        obj_path.to_owned()
    } else {
        let mut obj_path = std::env::temp_dir();
        let obj_name = format!("chocopy-{}.o", rand::random::<u32>());
        obj_path.push(obj_name);
        obj_path
    };

    gen_object(source_path, ast, &obj_path, platform)?;

    if no_link {
        return Ok(());
    }

    link(&obj_path, path, static_lib, platform)?;

    std::fs::remove_file(&obj_path)?;

    Ok(())
}
