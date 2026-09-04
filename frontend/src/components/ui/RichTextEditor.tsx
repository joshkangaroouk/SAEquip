import { useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { cn } from "../../lib/cn";

/**
 * WYSIWYG editor for trusted product HTML.
 *
 * IMPORTANT — why onChange only fires on real edits:
 *
 * Tiptap parses HTML into its own document model, so `getHTML()` is a
 * *normalised* rendering of the input, not the input itself. Legacy WordPress
 * markup in particular round-trips differently. If we pushed that normalised
 * output upward on mount, simply opening a product would mark the description
 * dirty and any later save would silently rewrite Duda's HTML.
 *
 * So the value flows in, and only genuine user edits flow back out. Open a
 * product, change nothing, and the stored HTML is untouched byte for byte.
 *
 * `normalisedDiffers` lets the caller warn that editing WILL reformat the
 * markup, and offer a raw-HTML escape hatch for fixing legacy content.
 */
export interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  className?: string;
  /** Called once after mount with whether tiptap's parse differs from `value`. */
  onNormalisedDiffers?: (differs: boolean) => void;
}

const btn =
  "rounded px-2 py-1 text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

function ToolbarButton({
  editor,
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  editor: Editor | null;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={!editor || disabled}
      // Keep focus in the document so commands apply to the current selection.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(btn, active ? "bg-accent text-accent-foreground" : "text-muted hover:bg-surface-2 hover:text-text")}
    >
      {children}
    </button>
  );
}

export function RichTextEditor({
  value,
  onChange,
  className,
  onNormalisedDiffers,
}: RichTextEditorProps) {
  // The value we last emitted, so an external reset (Reset all) is detected
  // while our own edits don't cause a content round-trip that eats the cursor.
  const lastEmitted = useRef<string | null>(null);
  const reportedDiff = useRef(false);

  const extensions = useMemo(
    // StarterKit already bundles Link in v3 — registering @tiptap/extension-link
    // alongside it warns about a duplicate extension, so configure it here.
    () => [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        link: { openOnClick: false, autolink: false },
      }),
    ],
    [],
  );

  const editor = useEditor({
    extensions,
    content: value,
    editorProps: {
      attributes: {
        class:
          "min-h-[10rem] max-h-[26rem] overflow-y-auto px-3 py-2.5 text-small leading-relaxed text-text focus:outline-none " +
          // ⚠ Paragraph spacing MUST mirror the CSS injected in Duda's Head
          // HTML, scoped to the description element's wrapper class:
          //     .productDescription p:not(:last-child) { margin-bottom: 16px }
          // This is a WYSIWYG contract: the editor is only trustworthy if a
          // paragraph break looks here exactly as it lands on the live product
          // page. Absolute 16px (not 1em) on purpose — em would resolve to
          // 18px on Duda and 16px here, i.e. guaranteed drift. If the Duda
          // value changes, change it here and in RichHtml.tsx too.
          "[&_p:not(:last-child)]:mb-[16px] [&_p]:mt-0 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 " +
          "[&_h2]:mb-2 [&_h2]:mt-3 [&_h2]:text-base [&_h2]:font-semibold " +
          "[&_h3]:mb-1.5 [&_h3]:mt-3 [&_h3]:text-sm [&_h3]:font-semibold " +
          "[&_h4]:mb-1.5 [&_h4]:mt-2 [&_h4]:text-sm [&_h4]:font-semibold " +
          "[&_a]:text-text [&_a]:underline [&_a]:underline-offset-2 " +
          "[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted " +
          "[&_img]:inline [&_img]:align-middle [&_img]:mr-1",
      },
    },
    // Fires on document changes from user input, NOT from the initial content.
    onUpdate({ editor: ed }) {
      const html = ed.getHTML();
      lastEmitted.current = html;
      onChange(html);
    },
  });

  // Report (once) whether opening this content in a rich editor would reformat
  // it, so the caller can say so before the user commits to editing.
  useEffect(() => {
    if (!editor || reportedDiff.current || !onNormalisedDiffers) return;
    reportedDiff.current = true;
    const normalised = editor.getHTML();
    const strip = (s: string) => s.replace(/\s+/g, " ").trim();
    onNormalisedDiffers(strip(normalised) !== strip(value || ""));
    // Only ever runs on first mount for a given editor instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  // Pull an externally-changed value back in (e.g. "Reset all", or a reload),
  // but never echo our own last emission — that would reset the caret mid-type.
  useEffect(() => {
    if (!editor) return;
    if (value === lastEmitted.current) return;
    if (value === editor.getHTML()) return;
    // `false` = don't emit an update, so this isn't mistaken for a user edit.
    editor.commands.setContent(value || "", { emitUpdate: false });
    lastEmitted.current = null;
  }, [value, editor]);

  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  function applyLink() {
    if (!editor) return;
    const url = linkUrl.trim();
    if (!url) {
      editor.chain().focus().unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
    setLinkOpen(false);
    setLinkUrl("");
  }

  return (
    <div className={cn("rounded-md border border-border bg-surface", className)}>
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border px-1.5 py-1">
        <ToolbarButton
          editor={editor}
          title="Bold"
          active={editor?.isActive("bold")}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <span className="font-bold">B</span>
        </ToolbarButton>
        <ToolbarButton
          editor={editor}
          title="Italic"
          active={editor?.isActive("italic")}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <span className="italic">I</span>
        </ToolbarButton>

        <span className="mx-1 h-4 w-px bg-border" />

        {([2, 3] as const).map((level) => (
          <ToolbarButton
            key={level}
            editor={editor}
            title={`Heading ${level}`}
            active={editor?.isActive("heading", { level })}
            onClick={() => editor?.chain().focus().toggleHeading({ level }).run()}
          >
            H{level}
          </ToolbarButton>
        ))}
        <ToolbarButton
          editor={editor}
          title="Paragraph"
          active={editor?.isActive("paragraph")}
          onClick={() => editor?.chain().focus().setParagraph().run()}
        >
          ¶
        </ToolbarButton>

        <span className="mx-1 h-4 w-px bg-border" />

        <ToolbarButton
          editor={editor}
          title="Bullet list"
          active={editor?.isActive("bulletList")}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          • List
        </ToolbarButton>
        <ToolbarButton
          editor={editor}
          title="Numbered list"
          active={editor?.isActive("orderedList")}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          1. List
        </ToolbarButton>

        <span className="mx-1 h-4 w-px bg-border" />

        <ToolbarButton
          editor={editor}
          title="Link"
          active={editor?.isActive("link")}
          onClick={() => {
            setLinkUrl(editor?.getAttributes("link").href ?? "");
            setLinkOpen((o) => !o);
          }}
        >
          Link
        </ToolbarButton>
        <ToolbarButton
          editor={editor}
          title="Clear formatting"
          onClick={() => editor?.chain().focus().unsetAllMarks().clearNodes().run()}
        >
          Clear
        </ToolbarButton>

        <span className="flex-1" />

        <ToolbarButton
          editor={editor}
          title="Undo"
          disabled={!editor?.can().undo()}
          onClick={() => editor?.chain().focus().undo().run()}
        >
          ↶
        </ToolbarButton>
        <ToolbarButton
          editor={editor}
          title="Redo"
          disabled={!editor?.can().redo()}
          onClick={() => editor?.chain().focus().redo().run()}
        >
          ↷
        </ToolbarButton>
      </div>

      {linkOpen && (
        <div className="flex items-center gap-2 border-b border-border bg-surface-2 px-2 py-1.5">
          <input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyLink();
              }
              if (e.key === "Escape") setLinkOpen(false);
            }}
            placeholder="https://…"
            autoFocus
            className="flex-1 rounded border border-border bg-surface px-2 py-1 text-xs focus:border-accent focus:outline-none"
          />
          <button type="button" onClick={applyLink} className={cn(btn, "bg-accent text-accent-foreground")}>
            Apply
          </button>
          <button
            type="button"
            onClick={() => setLinkOpen(false)}
            className={cn(btn, "text-muted hover:text-text")}
          >
            Cancel
          </button>
        </div>
      )}

      <EditorContent editor={editor} />
    </div>
  );
}
