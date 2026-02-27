// Disassembles generated x86-64 machine code into annotated assembly text

use super::{Chunk, ChunkExtra, ChunkLinkTarget, CodeSet, ProcedureDebug};
use serde::Serialize;

#[derive(Serialize)]
pub struct AssemblyOutput {
    pub functions: Vec<AsmFunction>,
}

#[derive(Serialize)]
pub struct AsmFunction {
    pub name: String,
    #[serde(rename = "sourceLine")]
    pub source_line: Option<u32>,
    pub artificial: bool,
    pub instructions: Vec<AsmInstruction>,
}

#[derive(Serialize)]
pub struct AsmInstruction {
    pub offset: u64,
    pub bytes: String,
    pub text: String,
    #[serde(rename = "sourceLine")]
    pub source_line: Option<u32>,
}

/// Build a map from relocation offset -> target symbol name for call annotation
fn build_reloc_map(chunk: &Chunk) -> std::collections::HashMap<usize, String> {
    let mut map = std::collections::HashMap::new();
    for link in &chunk.links {
        match &link.to {
            ChunkLinkTarget::Symbol(name, _) => {
                map.insert(link.pos, name.clone());
            }
            ChunkLinkTarget::Data(_) => {
                map.insert(link.pos, "<data>".to_string());
            }
        }
    }
    map
}

/// Look up source line for a given code offset using the procedure's line map.
/// Uses binary search since lines are sorted by code_pos.
fn lookup_source_line(proc_debug: &ProcedureDebug, offset: usize) -> Option<u32> {
    if proc_debug.lines.is_empty() {
        return None;
    }
    // Find the last entry where code_pos <= offset
    let idx = match proc_debug.lines.binary_search_by_key(&offset, |lm| lm.code_pos) {
        Ok(i) => i,
        Err(0) => return None,
        Err(i) => i - 1,
    };
    Some(proc_debug.lines[idx].line_number)
}

/// Disassemble a CodeSet into annotated assembly text
#[allow(private_interfaces)]
pub fn disassemble(code_set: &CodeSet, _source_lines: &[&str]) -> AssemblyOutput {
    use iced_x86::{Decoder, DecoderOptions, Formatter, IntelFormatter};

    let mut functions = Vec::new();

    for chunk in &code_set.chunks {
        let proc_debug = match &chunk.extra {
            ChunkExtra::Procedure(p) => p,
            ChunkExtra::Data { .. } => continue,
        };

        let reloc_map = build_reloc_map(chunk);

        let mut decoder = Decoder::with_ip(64, &chunk.code, 0, DecoderOptions::NONE);
        let mut formatter = IntelFormatter::new();

        // Configure formatter
        formatter.options_mut().set_uppercase_mnemonics(false);
        formatter.options_mut().set_uppercase_registers(false);
        formatter.options_mut().set_space_after_operand_separator(true);
        formatter.options_mut().set_hex_prefix("0x");
        formatter.options_mut().set_hex_suffix("");

        let mut instructions = Vec::new();
        let mut output = String::new();

        while decoder.can_decode() {
            let instr = decoder.decode();
            let offset = instr.ip();

            // Format the instruction
            output.clear();
            formatter.format(&instr, &mut output);

            // Build hex bytes string
            let start = offset as usize;
            let end = start + instr.len();
            let bytes_hex: Vec<String> = chunk.code[start..end]
                .iter()
                .map(|b| format!("{:02x}", b))
                .collect();

            // Check if this is a call instruction with a relocation
            // x86-64 RIP-relative calls have a 4-byte displacement starting at offset+1
            let mut text = output.clone();
            if instr.is_call_near() {
                // The relocation for a call is at the displacement bytes position
                // For E8 xx xx xx xx, the reloc is at offset+1
                let reloc_pos = start + 1;
                if let Some(target_name) = reloc_map.get(&reloc_pos) {
                    // Replace the raw address with the symbol name
                    text = format!("call {}", target_name);
                }
            }

            let source_line = lookup_source_line(proc_debug, start);

            instructions.push(AsmInstruction {
                offset,
                bytes: bytes_hex.join(" "),
                text,
                source_line,
            });
        }

        functions.push(AsmFunction {
            name: chunk.name.clone(),
            source_line: if proc_debug.decl_line > 0 {
                Some(proc_debug.decl_line)
            } else {
                None
            },
            artificial: proc_debug.artificial,
            instructions,
        });
    }

    AssemblyOutput { functions }
}
