import { useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Pilcrow,
  Redo2,
  RemoveFormatting,
  Underline,
  Undo2,
} from "lucide-react";
import { cn } from "../../lib/cn";
import { Button } from "./Button";
import { Input } from "./Input";

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
  /**
   * The editable area's accessible name. Required: tiptap's surface is a
   * contenteditable div, not a form control, so no <label> can point at it.
   */
  ariaLabel: string;
  className?: string;
  /** Called once after mount with whether tiptap's parse differs from `value`. */
  onNormalisedDiffers?: (differs: boolean) => void;
}

/*
 * Toolbar buttons: 34px squares holding a 16px icon (10 §4). Active formats
 * are yellow (an active state). A disabled button is drawn in --border-input
 * — no opacity (02a "After 3b").
 */
const btn =
  "inline-flex h-8.5 w-8.5 items-center justify-center " +
  "transition-colors duration-[120ms] disabled:cursor-not-allowed disabled:text-border-input";

const ICON = { size: 16, strokeWidth: 2, "aria-hidden": true } as const;

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
      className={cn(btn, active ? "bg-accent text-accent-ink" : "text-muted enabled:hover:bg-surface-2 enabled:hover:text-text")}
    >
      {children}
    </button>
  );
}

export function RichTextEditor({
  value,
  onChange,
  ariaLabel,
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
        // Announced as a named, multi-line text field rather than an unnamed group.
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": ariaLabel,
        class:
          "min-h-[10rem] max-h-[26rem] overflow-y-auto px-3 py-2.5 text-body leading-relaxed text-text focus:outline-none " +
          // ⚠ Paragraph spacing MUST mirror how the description actually
          // renders on the product page — which since 2026-09-09 is the
          // WIDGET's Overview tab, not Duda's native description element.
          // `.saeh-prose p + p` in widget.js is `margin-top:12px`, so this is
          // 12px. Change one, change all three (editor, RichHtml preview,
          // widget) in the same edit.
          //
          // This is a WYSIWYG contract: the editor is only trustworthy if a
          // paragraph break looks here exactly as it lands on the live page.
          //
          // It used to be `my-0` with no gap, mirroring Duda's own CSS
          // (`p.rteBlock{margin:0}`), which was accurate but meant a paragraph
          // break was indistinguishable from a line break while editing —
          // staff worked around it by typing blank lines, which would have
          // shipped real empty <p> elements to the live page. Now the widget
          // renders the description, we set the spacing ourselves and the
          // editor can show paragraph structure honestly.
          //
          // ⚠ `mt-[12px]`, NOT `mt-3` — see the note in RichHtml.tsx: rem-based
          // spacing depends on the root font size; the widget's 12px does not.
          "[&_p]:my-0 [&_p+p]:mt-[12px] [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 " +
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
    // The field box. The editing surface draws no outline of its own (tiptap
    // owns it), so the BOX shows the focus outline while the text is focused —
    // until 2026-10 there was no visible focus at all.
    <div
      className={cn(
        "border border-border-input bg-field",
        "has-[.ProseMirror:focus]:outline has-[.ProseMirror:focus]:outline-2 has-[.ProseMirror:focus]:outline-offset-2 has-[.ProseMirror:focus]:outline-focus",
        className,
      )}
    >
      {/*
        Icon buttons (10 §4), each 34px with its name as aria-label and a
        tooltip: the formats, then Paragraph and Clear formatting (kept from
        the word toolbar), with Undo and Redo on the right. Underline is in
        tiptap's StarterKit and the widget's prose allowlist (<u>).
      */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border px-1 py-1">
        <ToolbarButton
          editor={editor}
          title="Bold"
          active={editor?.isActive("bold")}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <Bold {...ICON} />
        </ToolbarButton>
        <ToolbarButton
          editor={editor}
          title="Italic"
          active={editor?.isActive("italic")}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <Italic {...ICON} />
        </ToolbarButton>
        <ToolbarButton
          editor={editor}
          title="Underline"
          active={editor?.isActive("underline")}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
        >
          <Underline {...ICON} />
        </ToolbarButton>

        <span className="mx-1 h-4 w-px bg-border" />

        {([2, 3] as const).map((level) => {
          const Icon = level === 2 ? Heading2 : Heading3;
          return (
            <ToolbarButton
              key={level}
              editor={editor}
              title={`Heading ${level}`}
              active={editor?.isActive("heading", { level })}
              onClick={() => editor?.chain().focus().toggleHeading({ level }).run()}
            >
              <Icon {...ICON} />
            </ToolbarButton>
          );
        })}
        <ToolbarButton
          editor={editor}
          title="Paragraph"
          active={editor?.isActive("paragraph")}
          onClick={() => editor?.chain().focus().setParagraph().run()}
        >
          <Pilcrow {...ICON} />
        </ToolbarButton>

        <span className="mx-1 h-4 w-px bg-border" />

        <ToolbarButton
          editor={editor}
          title="Bullet list"
          active={editor?.isActive("bulletList")}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          <List {...ICON} />
        </ToolbarButton>
        <ToolbarButton
          editor={editor}
          title="Numbered list"
          active={editor?.isActive("orderedList")}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered {...ICON} />
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
          <LinkIcon {...ICON} />
        </ToolbarButton>
        <ToolbarButton
          editor={editor}
          title="Clear formatting"
          onClick={() => editor?.chain().focus().unsetAllMarks().clearNodes().run()}
        >
          <RemoveFormatting {...ICON} />
        </ToolbarButton>

        <span className="flex-1" />

        <ToolbarButton
          editor={editor}
          title="Undo"
          disabled={!editor?.can().undo()}
          onClick={() => editor?.chain().focus().undo().run()}
        >
          <Undo2 {...ICON} />
        </ToolbarButton>
        <ToolbarButton
          editor={editor}
          title="Redo"
          disabled={!editor?.can().redo()}
          onClick={() => editor?.chain().focus().redo().run()}
        >
          <Redo2 {...ICON} />
        </ToolbarButton>
      </div>

      {linkOpen && (
        <div className="flex items-center gap-2 border-b border-border bg-surface-2 px-2 py-1.5">
          <Input
            size="sm"
            aria-label="Link URL"
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
            className="flex-1"
          />
          <Button type="button" size="sm" onClick={applyLink}>
            Apply
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setLinkOpen(false)}>
            Cancel
          </Button>
        </div>
      )}

      <EditorContent editor={editor} />
    </div>
  );
}
