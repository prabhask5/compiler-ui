<script lang="ts">
  /**
   * CodeMirror 6 editor wrapper for Python source code.
   *
   * Provides a full-featured code editor with Python syntax highlighting (via
   * @codemirror/lang-python), the One Dark theme, undo/redo history, bracket
   * matching, and search. On top of the base editor, two custom StateFields
   * drive decoration layers:
   *
   * - **highlightField** -- renders a background highlight range in response to
   *   AST node clicks or error clicks, allowing the user to see which source
   *   region corresponds to a selected element.
   * - **errorField** -- renders red underline decorations beneath spans that
   *   produced compiler errors.
   *
   * The component uses Svelte 5 runes ($effect) to reactively sync the
   * external `source`, `highlightLoc`, and `errors` props into the CodeMirror
   * state via dispatched StateEffects.
   */
  import { onMount, onDestroy } from 'svelte';
  import {
    EditorView,
    keymap,
    lineNumbers,
    highlightActiveLine,
    highlightActiveLineGutter,
    drawSelection,
    highlightSpecialChars,
    Decoration,
    type DecorationSet
  } from '@codemirror/view';
  import { EditorState, StateField, StateEffect } from '@codemirror/state';
  import { defaultKeymap, indentWithTab, history, historyKeymap } from '@codemirror/commands';
  import { python } from '@codemirror/lang-python';
  import { oneDark } from '@codemirror/theme-one-dark';
  import {
    bracketMatching,
    indentOnInput,
    syntaxHighlighting,
    defaultHighlightStyle
  } from '@codemirror/language';
  import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
  import type { CompilerError } from '$lib/compiler/types';

  let {
    source = $bindable(''),
    highlightLoc,
    scrollToHighlight = false,
    errors
  }: {
    /** Two-way bound Python source text displayed in the editor. */
    source: string;
    /** Source location tuple [startRow, startCol, endRow, endCol] to highlight, or null. */
    highlightLoc: [number, number, number, number] | null;
    /** When true, the editor scrolls to and places the cursor at the highlighted range. */
    scrollToHighlight?: boolean;
    /** Compiler errors whose locations are underlined in the editor gutter. */
    errors: CompilerError[];
  } = $props();

  /** DOM element that hosts the CodeMirror EditorView. */
  let containerEl: HTMLDivElement;
  /** The CodeMirror EditorView instance; undefined until onMount fires. */
  let view: EditorView | undefined;

  // --- StateEffects used to push decoration updates into the CodeMirror state ---

  /** Effect to set or clear the highlight decoration range. */
  const setHighlight = StateEffect.define<{ from: number; to: number } | null>();
  /** Effect to replace the full set of error underline ranges. */
  const setErrors = StateEffect.define<{ from: number; to: number }[]>();

  /**
   * StateField that manages the highlight decoration layer.
   * Listens for `setHighlight` effects and maps existing decorations through
   * document changes so positions stay accurate after edits.
   */
  const highlightField = StateField.define<DecorationSet>({
    create: () => Decoration.none,
    update(decos, tr) {
      for (const e of tr.effects) {
        if (e.is(setHighlight)) {
          if (e.value) {
            return Decoration.set([
              Decoration.mark({ class: 'cm-highlight-range' }).range(e.value.from, e.value.to)
            ]);
          }
          return Decoration.none;
        }
      }
      if (tr.docChanged) return decos.map(tr.changes);
      return decos;
    },
    provide: (f) => EditorView.decorations.from(f)
  });

  /**
   * StateField that manages the error underline decoration layer.
   * Listens for `setErrors` effects to rebuild underline marks, and maps
   * existing decorations through document changes.
   */
  const errorField = StateField.define<DecorationSet>({
    create: () => Decoration.none,
    update(decos, tr) {
      for (const e of tr.effects) {
        if (e.is(setErrors)) {
          if (e.value.length === 0) return Decoration.none;
          const marks = e.value
            .filter((r) => r.from < r.to)
            .map((r) => Decoration.mark({ class: 'cm-error-underline' }).range(r.from, r.to));
          return Decoration.set(marks, true);
        }
      }
      if (tr.docChanged) return decos.map(tr.changes);
      return decos;
    },
    provide: (f) => EditorView.decorations.from(f)
  });

  /**
   * Convert a 1-based (row, col) source location into a 0-based document offset.
   *
   * @param doc  - The CodeMirror document text.
   * @param row  - 1-based line number.
   * @param col  - 1-based column number.
   * @returns The absolute character offset within the document. Returns 0 for
   *          out-of-range rows.
   */
  function locToPos(doc: import('@codemirror/state').Text, row: number, col: number): number {
    if (row < 1 || row > doc.lines) return 0;
    const line = doc.line(row);
    return line.from + Math.max(0, Math.min(col - 1, line.length));
  }

  onMount(() => {
    const state = EditorState.create({
      doc: source,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        drawSelection(),
        highlightSpecialChars(),
        history(),
        bracketMatching(),
        indentOnInput(),
        highlightSelectionMatches(),
        oneDark,
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        python(),
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
        highlightField,
        errorField,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            source = update.state.doc.toString();
          }
        }),
        EditorState.tabSize.of(4)
      ]
    });

    view = new EditorView({
      state,
      parent: containerEl
    });
  });

  onDestroy(() => {
    view?.destroy();
  });

  // Sync source changes from outside (e.g., example selection)
  $effect(() => {
    if (view && source !== view.state.doc.toString()) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: source }
      });
    }
  });

  // Sync highlight
  $effect(() => {
    if (!view) return;
    if (highlightLoc) {
      const doc = view.state.doc;
      let from = locToPos(doc, highlightLoc[0], highlightLoc[1]);
      let to = locToPos(doc, highlightLoc[2], highlightLoc[3]);
      // If the range is empty or reversed, expand to the full line
      if (from >= to) {
        const row = highlightLoc[0];
        if (row >= 1 && row <= doc.lines) {
          const line = doc.line(row);
          from = line.from;
          to = line.to;
        }
      }
      // Only dispatch if we have a valid range
      if (from < to) {
        const spec: Parameters<typeof view.dispatch>[0] = {
          effects: setHighlight.of({ from, to })
        };
        // Only scroll and move cursor for explicit clicks, not hover
        if (scrollToHighlight) {
          spec.selection = { anchor: from };
          spec.scrollIntoView = true;
        }
        view.dispatch(spec);
      } else {
        view.dispatch({ effects: setHighlight.of(null) });
      }
    } else {
      view.dispatch({ effects: setHighlight.of(null) });
    }
  });

  // Sync errors
  $effect(() => {
    if (!view) return;
    const doc = view.state.doc;
    const ranges = errors
      .filter((e) => e.location)
      .map((e) => ({
        from: locToPos(doc, e.location[0], e.location[1]),
        to: locToPos(doc, e.location[2], e.location[3])
      }));
    view.dispatch({ effects: setErrors.of(ranges) });
  });
</script>

<div class="editor-container" bind:this={containerEl}></div>

<style>
  .editor-container {
    flex: 1;
    overflow: hidden;
  }

  .editor-container :global(.cm-editor) {
    height: 100%;
  }

  .editor-container :global(.cm-scroller) {
    overflow: auto;
  }
</style>
