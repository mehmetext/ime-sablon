import Bold from "@tiptap/extension-bold";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { generateHTML } from "@tiptap/html";
import { DOMParser as ProseMirrorDOMParser } from "@tiptap/pm/model";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const PAGE_BREAK_MARKER = "__IME_PAGE_BREAK__";
const STORAGE_KEY = "ime-sablon-state-v1";

const emptyDoc = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

const StrictBold = Bold.extend({
  parseHTML() {
    return [
      {
        tag: "strong",
      },
      {
        tag: "b",
        getAttrs: (node) => node.style.fontWeight !== "normal" && null,
      },
    ];
  },
});

const extensions = [
  StarterKit.configure({
    bold: false,
    underline: false,
    heading: {
      levels: [1, 2, 3],
    },
  }),
  StrictBold,
  Underline,
  TextAlign.configure({
    types: ["paragraph", "heading"],
  }),
];

const sampleDoc = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "Buraya Word, Google Docs veya başka bir kaynaktan metin yapıştırabilirsiniz.",
        },
      ],
    },
  ],
};

function createItem(date = "") {
  return {
    id: `item-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    date,
    contentJson: emptyDoc,
    previewText: "",
  };
}

function createDefaultItems() {
  return [
    {
      ...createItem(""),
      contentJson: sampleDoc,
      previewText:
        "Buraya Word, Google Docs veya başka bir kaynaktan metin yapıştırabilirsiniz.",
    },
  ];
}

const DAYS_PER_WEEK = 7;
const WORK_WEEK_FRIDAY_OFFSET = 4;

function toIsoDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateTRDots(isoDate) {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return "";
  const [year, month, day] = isoDate.split("-");
  return `${day}.${month}.${year}`;
}

function addDays(isoDate, days) {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return "";
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return toIsoDateString(date);
}

function addWeeks(isoDate, weeks) {
  return addDays(isoDate, weeks * DAYS_PER_WEEK);
}

function formatWorkWeekRangeTR(isoDate) {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return "";
  const friday = addDays(isoDate, WORK_WEEK_FRIDAY_OFFSET);
  return `${formatDateTRDots(isoDate)} - ${formatDateTRDots(friday)}`;
}

function getItemDate(item, index, dateMode, startDate) {
  if (dateMode === "auto") {
    if (!startDate) return "";
    return formatWorkWeekRangeTR(addWeeks(startDate, index));
  }
  return item.date;
}

function loadInitialState() {
  const fallbackItems = createDefaultItems();
  const fallback = {
    businessName: "",
    approverName: "",
    dateMode: "manual",
    startDate: "",
    items: fallbackItems,
    selectedItemId: fallbackItems[0].id,
  };

  if (typeof window === "undefined") return fallback;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;

    const parsed = JSON.parse(raw);
    const parsedItems = Array.isArray(parsed.items)
      ? parsed.items.filter(
          (item) =>
            item &&
            typeof item.id === "string" &&
            typeof item.date === "string" &&
            item.contentJson &&
            typeof item.previewText === "string",
        )
      : [];

    const items = parsedItems.length ? parsedItems : fallbackItems;
    const selectedItemId = items.some(
      (item) => item.id === parsed.selectedItemId,
    )
      ? parsed.selectedItemId
      : items[0].id;

    return {
      businessName:
        typeof parsed.businessName === "string" ? parsed.businessName : "",
      approverName:
        typeof parsed.approverName === "string" ? parsed.approverName : "",
      dateMode: parsed.dateMode === "auto" ? "auto" : "manual",
      startDate: typeof parsed.startDate === "string" ? parsed.startDate : "",
      items,
      selectedItemId,
    };
  } catch {
    return fallback;
  }
}

export default function App() {
  const initialState = useMemo(() => loadInitialState(), []);
  const [businessName, setBusinessName] = useState(initialState.businessName);
  const [approverName, setApproverName] = useState(initialState.approverName);
  const [dateMode, setDateMode] = useState(initialState.dateMode);
  const [startDate, setStartDate] = useState(initialState.startDate);
  const [items, setItems] = useState(initialState.items);
  const [selectedItemId, setSelectedItemId] = useState(
    initialState.selectedItemId,
  );
  const [pages, setPages] = useState([]);
  const measureRef = useRef(null);

  const selectedItem =
    items.find((item) => item.id === selectedItemId) || items[0];
  const selectedItemIndex = items.findIndex(
    (item) => item.id === selectedItemId,
  );
  const selectedItemDate = selectedItem
    ? getItemDate(
        selectedItem,
        selectedItemIndex >= 0 ? selectedItemIndex : 0,
        dateMode,
        startDate,
      )
    : "";
  const pageCounts = useMemo(() => countPagesByItem(pages), [pages]);

  const handleDateModeChange = (nextMode) => {
    if (nextMode === "manual" && dateMode === "auto") {
      setItems((current) =>
        current.map((item, index) => ({
          ...item,
          date: addWeeks(startDate, index) || item.date,
        })),
      );
    }
    setDateMode(nextMode);
  };

  const updateSelectedItem = (updater) => {
    setItems((current) =>
      current.map((item) =>
        item.id === selectedItemId ? { ...item, ...updater(item) } : item,
      ),
    );
  };

  const addItem = () => {
    const nextDate = dateMode === "manual" ? selectedItem?.date || "" : "";
    const item = createItem(nextDate);
    setItems((current) => [...current, item]);
    setSelectedItemId(item.id);
  };

  const deleteSelectedItem = () => {
    if (items.length === 1) {
      const nextDate =
        dateMode === "manual"
          ? selectedItem?.date || ""
          : addWeeks(startDate, 0) || "";
      const replacement = createItem(nextDate);
      setItems([replacement]);
      setSelectedItemId(replacement.id);
      return;
    }

    const index = items.findIndex((item) => item.id === selectedItemId);
    const nextItems = items.filter((item) => item.id !== selectedItemId);
    setItems(nextItems);
    setSelectedItemId(nextItems[Math.max(0, index - 1)].id);
  };

  const moveSelectedItem = (direction) => {
    const index = items.findIndex((item) => item.id === selectedItemId);
    const target = index + direction;
    if (target < 0 || target >= items.length) return;

    const nextItems = [...items];
    const [moved] = nextItems.splice(index, 1);
    nextItems.splice(target, 0, moved);
    setItems(nextItems);
  };

  useLayoutEffect(() => {
    if (!measureRef.current) return;
    setPages(paginateItems(items, measureRef.current, dateMode, startDate));
  }, [items, businessName, approverName, dateMode, startDate]);

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        businessName,
        approverName,
        dateMode,
        startDate,
        items,
        selectedItemId,
      }),
    );
  }, [approverName, businessName, dateMode, items, selectedItemId, startDate]);

  useEffect(() => {
    const onBeforePrint = () => {
      if (!measureRef.current) return;
      setPages(paginateItems(items, measureRef.current, dateMode, startDate));
    };
    window.addEventListener("beforeprint", onBeforePrint);
    return () => window.removeEventListener("beforeprint", onBeforePrint);
  }, [dateMode, items, startDate]);

  return (
    <div className="app-shell">
      <aside className="workspace-panel">
        <section className="global-fields">
          <label>
            <span>İşletmenin Adı</span>
            <input
              value={businessName}
              onChange={(event) => setBusinessName(event.target.value)}
              placeholder="İşletme adını girin"
            />
          </label>
          <label>
            <span>Onaylayanın Adı-Soyadı</span>
            <input
              value={approverName}
              onChange={(event) => setApproverName(event.target.value)}
              placeholder="Ad Soyad"
            />
          </label>
          <fieldset className="date-mode-field">
            <legend>Tarih Modu</legend>
            <div className="date-mode-toggle">
              <label>
                <input
                  checked={dateMode === "manual"}
                  name="dateMode"
                  onChange={() => handleDateModeChange("manual")}
                  type="radio"
                  value="manual"
                />
                Manuel
              </label>
              <label>
                <input
                  checked={dateMode === "auto"}
                  name="dateMode"
                  onChange={() => handleDateModeChange("auto")}
                  type="radio"
                  value="auto"
                />
                Otomatik (haftalık)
              </label>
            </div>
          </fieldset>
          {dateMode === "auto" && (
            <label>
              <span>Başlangıç Tarihi</span>
              <input
                onChange={(event) => setStartDate(event.target.value)}
                type="date"
                value={startDate}
              />
            </label>
          )}
          <button
            className="print-button"
            type="button"
            onClick={() => window.print()}
          >
            Yazdır / PDF
          </button>
        </section>

        <section className="item-list-section">
          <div className="section-row">
            <h2>Çalışmalar</h2>
            <button type="button" onClick={addItem}>
              Yeni
            </button>
          </div>

          <div className="item-list">
            {items.map((item, index) => (
              <button
                className={`item-card ${item.id === selectedItemId ? "active" : ""}`}
                key={item.id}
                type="button"
                onClick={() => setSelectedItemId(item.id)}
              >
                <span className="item-index">Madde {index + 1}</span>
                <span className="item-summary">
                  {item.previewText || `Madde ${index + 1}`}
                </span>
                <span className="item-meta">
                  {getItemDate(item, index, dateMode, startDate) || "Tarih yok"}{" "}
                  · {pageCounts[item.id] || 0} sayfa
                </span>
              </button>
            ))}
          </div>
        </section>

        {selectedItem && (
          <section className="editor-section">
            <div className="section-row">
              <h2>İçerik</h2>
              <div className="icon-actions">
                <button
                  type="button"
                  aria-label="Yukarı taşı"
                  title="Yukarı taşı"
                  onClick={() => moveSelectedItem(-1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label="Aşağı taşı"
                  title="Aşağı taşı"
                  onClick={() => moveSelectedItem(1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  aria-label="Sil"
                  title="Sil"
                  onClick={deleteSelectedItem}
                >
                  ×
                </button>
              </div>
            </div>

            <label
              className={`date-field ${dateMode === "auto" ? "date-field--readonly" : ""}`}
            >
              <span>Çalışma Tarihi</span>
              {dateMode === "auto" ? (
                <>
                  <input
                    disabled
                    readOnly
                    value={selectedItemDate}
                    placeholder="Başlangıç tarihi seçin"
                  />
                  <span className="date-field-hint">
                    Pazartesi–Cuma aralığı olarak gösterilir
                  </span>
                </>
              ) : (
                <input
                  value={selectedItem.date}
                  onChange={(event) =>
                    updateSelectedItem(() => ({ date: event.target.value }))
                  }
                  placeholder="gg/aa/20yy"
                />
              )}
            </label>

            <RichEditor
              key={selectedItem.id}
              content={selectedItem.contentJson}
              onChange={(contentJson, previewText) =>
                updateSelectedItem(() => ({ contentJson, previewText }))
              }
            />
          </section>
        )}
      </aside>

      <main className="preview-panel">
        <div className="preview-scroll">
          {pages.length ? (
            pages.map((page, index) => (
              <A4Page
                approverName={approverName}
                businessName={businessName}
                key={`${page.itemId}-${index}`}
                page={page}
                pageNumber={index + 1}
              />
            ))
          ) : (
            <A4Page
              approverName={approverName}
              businessName={businessName}
              page={{ date: "", html: "", itemId: "empty" }}
              pageNumber={1}
            />
          )}
        </div>
      </main>

      <div className="measure-page" aria-hidden="true">
        <div className="page-inner measure-inner">
          <div className="page-header measure-header" />
          <div className="measure-content preview-content" ref={measureRef} />
          <div className="page-footer measure-footer" />
        </div>
      </div>
    </div>
  );
}

function RichEditor({ content, onChange }) {
  const [toolbarState, setToolbarState] = useState({});
  const editor = useEditor({
    extensions,
    content,
    immediatelyRender: false,
    editorProps: {
      transformPastedHTML: (html) => sanitizePastedHtml(html),
      transformPastedText: (text) =>
        text.replace(/\r\n/g, "\n").replace(/\r/g, "\n"),
      handlePaste: (view, event) => {
        const clipboard = event.clipboardData;
        if (!clipboard) return false;

        if (isInCodeBlock(view)) {
          const text = extractPlainTextFromClipboard(clipboard);
          if (!text) return false;

          event.preventDefault();
          view.dispatch(view.state.tr.insertText(text));
          return true;
        }

        const html = clipboard.getData("text/html");
        const text = clipboard.getData("text/plain");
        const cleanHtml = html
          ? sanitizePastedHtml(html)
          : plainTextToHtml(text);

        if (!cleanHtml) return false;

        event.preventDefault();
        insertCleanHtml(view, cleanHtml);
        return true;
      },
    },
    onUpdate: ({ editor: activeEditor }) => {
      onChange(
        activeEditor.getJSON(),
        extractPreviewText(activeEditor.getJSON()),
      );
      setToolbarState(getToolbarState(activeEditor));
    },
    onSelectionUpdate: ({ editor: activeEditor }) => {
      setToolbarState(getToolbarState(activeEditor));
    },
    onTransaction: ({ editor: activeEditor }) => {
      setToolbarState(getToolbarState(activeEditor));
    },
  });

  useEffect(() => {
    if (!editor) return;
    setToolbarState(getToolbarState(editor));
  }, [editor]);

  if (!editor)
    return <div className="editor-loading">Editör hazırlanıyor...</div>;

  return (
    <div className="rich-editor">
      <div className="toolbar" aria-label="Biçimlendirme araçları">
        <select
          aria-label="Metin stili"
          className="toolbar-heading"
          onChange={(event) => {
            const level = Number(event.target.value);
            if (level === 0) {
              editor.chain().focus().setParagraph().run();
              return;
            }
            editor.chain().focus().setHeading({ level }).run();
          }}
          title="Metin stili"
          value={toolbarState.headingLevel ?? 0}
        >
          <option value={0}>Paragraf</option>
          <option value={1}>Başlık 1</option>
          <option value={2}>Başlık 2</option>
          <option value={3}>Başlık 3</option>
        </select>
        <button
          type="button"
          className={toolbarState.bold ? "active" : ""}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Kalın"
        >
          B
        </button>
        <button
          type="button"
          className={toolbarState.italic ? "active" : ""}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="İtalik"
        >
          I
        </button>
        <button
          type="button"
          className={toolbarState.underline ? "active" : ""}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Altı çizili"
        >
          U
        </button>
        <button
          type="button"
          className={toolbarState.bulletList ? "active" : ""}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Madde listesi"
        >
          •
        </button>
        <button
          type="button"
          className={toolbarState.orderedList ? "active" : ""}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Numaralı liste"
        >
          1.
        </button>
        <button
          type="button"
          className={toolbarState.codeBlock ? "active" : ""}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          title="Kod bloğu (⌘⌥C)"
        >
          {"</>"}
        </button>
        <button
          type="button"
          className={toolbarState.alignLeft ? "active" : ""}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          title="Sola hizala"
        >
          ⇤
        </button>
        <button
          type="button"
          className={toolbarState.alignCenter ? "active" : ""}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          title="Ortala"
        >
          ↔
        </button>
        <button
          type="button"
          className={toolbarState.alignRight ? "active" : ""}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          title="Sağa hizala"
        >
          ⇥
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

function getToolbarState(editor) {
  const headingLevel =
    [1, 2, 3].find((level) => editor.isActive("heading", { level })) ?? 0;

  return {
    headingLevel,
    bold: editor.isActive("bold"),
    italic: editor.isActive("italic"),
    underline: editor.isActive("underline"),
    bulletList: editor.isActive("bulletList"),
    orderedList: editor.isActive("orderedList"),
    codeBlock: editor.isActive("codeBlock"),
    alignLeft:
      editor.isActive({ textAlign: "left" }) ||
      (!editor.isActive({ textAlign: "center" }) &&
        !editor.isActive({ textAlign: "right" })),
    alignCenter: editor.isActive({ textAlign: "center" }),
    alignRight: editor.isActive({ textAlign: "right" }),
  };
}

function A4Page({ businessName, approverName, page, pageNumber }) {
  return (
    <article className="page">
      <div className="page-inner">
        <header className="page-header">
          <div className="header-business">
            <span>İşletmenin&nbsp;Adı&nbsp;:&nbsp;</span>
            <strong>{businessName}</strong>
          </div>
          <div className="header-page">Sayfa No: {pageNumber}</div>
        </header>
        <section
          className="preview-content"
          dangerouslySetInnerHTML={{ __html: page.html }}
        />
        <footer className="page-footer">
          <div className="footer-cell">
            <span>Çalışma Tarihi</span>
            <strong>{page.date || "..../..../20.. - ..../..../20.."}</strong>
          </div>
          <div className="footer-cell">
            <span>Onaylayanın Adı-Soyadı:</span>
            <strong>{approverName}</strong>
          </div>
          <div className="footer-cell">
            <span>İmza ve Mühür:</span>
            <strong>&nbsp;</strong>
          </div>
        </footer>
      </div>
    </article>
  );
}

function getAvailableContentHeight(measureEl) {
  // Content padding: 8px top + 8px bottom (see .preview-content / .measure-content).
  const contentPadding = 16;
  const measuredHeight =
    measureEl.clientHeight ||
    parseFloat(getComputedStyle(measureEl).height) ||
    0;
  return Math.max(measuredHeight - contentPadding, 0);
}

function paginateItems(items, measureEl, dateMode, startDate) {
  const availableHeight = getAvailableContentHeight(measureEl);
  const pages = [];

  items.forEach((item, index) => {
    const html = jsonToHtml(item.contentJson);
    if (!stripHtml(html).trim()) return;

    const itemDate = getItemDate(item, index, dateMode, startDate);
    const blocks = htmlToBlocks(html);
    let currentBlocks = [];

    blocks.forEach((block) => {
      const chunks =
        measureHtml(measureEl, block) > availableHeight
          ? splitOversizedBlock(block, measureEl, availableHeight)
          : [[block]];

      chunks.forEach((chunk) => {
        const candidate = currentBlocks.concat(chunk);
        if (
          measureHtml(measureEl, candidate.join("")) > availableHeight &&
          currentBlocks.length
        ) {
          pages.push({
            itemId: item.id,
            date: itemDate,
            html: currentBlocks.join(""),
          });
          currentBlocks = chunk;
        } else {
          currentBlocks = candidate;
        }
      });
    });

    if (currentBlocks.length) {
      pages.push({
        itemId: item.id,
        date: itemDate,
        html: currentBlocks.join(""),
      });
    }
  });

  return pages;
}

function splitOversizedBlock(blockHtml, measureEl, availableHeight) {
  const preParsed = parsePreBlock(blockHtml);
  if (preParsed) {
    if (preParsed.lines?.length > 1) {
      return groupPreLineParts(preParsed, measureEl, availableHeight);
    }
    return [[blockHtml]];
  }

  const parsed = parseSplittableBlock(blockHtml);
  if (parsed?.lines?.length > 1) {
    return groupLineParts(parsed, measureEl, availableHeight);
  }
  return splitOversizedBlockByWords(
    blockHtml,
    measureEl,
    availableHeight,
    parsed,
  );
}

function parseSplittableBlock(blockHtml) {
  const listMatch = blockHtml.match(
    /^<ul>\s*<li([^>]*)>([\s\S]*)<\/li>\s*<\/ul>$/i,
  );
  if (listMatch) {
    const [, attrs, inner] = listMatch;
    if (!/<br\b/i.test(inner)) {
      return { tag: "li", attrs, inner, lines: null };
    }
    return {
      tag: "li",
      attrs,
      inner,
      lines: inner.split(/<br\b[^>]*>/gi),
    };
  }

  const blockMatch = blockHtml.match(
    /^<(p|blockquote|h[1-6])([^>]*)>([\s\S]*)<\/\1>$/i,
  );
  if (!blockMatch) return null;

  const [, tag, attrs, inner] = blockMatch;
  if (!/<br\b/i.test(inner)) {
    return { tag, attrs, inner, lines: null };
  }

  return {
    tag,
    attrs,
    inner,
    lines: inner.split(/<br\b[^>]*>/gi),
  };
}

function buildBlockHtml({ tag, attrs, inner, escapeText = false }) {
  const content = escapeText ? escapeHtml(inner) : inner;
  const attrString = attrs?.trim() || "";

  if (tag === "li") {
    return `<ul><li${attrString}>${content}</li></ul>`;
  }

  if (["p", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6"].includes(tag)) {
    return `<${tag}${attrString}>${content}</${tag}>`;
  }

  return `<p>${content}</p>`;
}

function parsePreBlock(blockHtml) {
  const match = blockHtml.match(
    /^<pre([^>]*)>\s*<code([^>]*)>([\s\S]*)<\/code>\s*<\/pre>$/i,
  );
  if (!match) return null;

  const [, preAttrs = "", codeAttrs = "", rawInner] = match;
  const template = document.createElement("template");
  template.innerHTML = `<code>${rawInner}</code>`;
  const text = template.content.textContent ?? "";

  if (!text.includes("\n")) {
    return { preAttrs, codeAttrs, lines: null };
  }

  return {
    preAttrs,
    codeAttrs,
    lines: text.split("\n"),
  };
}

function buildPreBlockHtml({ preAttrs, codeAttrs, text }) {
  return `<pre${preAttrs}><code${codeAttrs}>${escapeHtml(text)}</code></pre>`;
}

function groupPreLineParts(parsed, measureEl, availableHeight) {
  const { preAttrs, codeAttrs, lines } = parsed;
  const chunks = [];
  let current = [];

  lines.forEach((line) => {
    const candidate = current.concat(line);
    const html = buildPreBlockHtml({
      preAttrs,
      codeAttrs,
      text: candidate.join("\n"),
    });

    if (measureHtml(measureEl, html) > availableHeight && current.length) {
      chunks.push([
        buildPreBlockHtml({
          preAttrs,
          codeAttrs,
          text: current.join("\n"),
        }),
      ]);
      current = [line];
    } else {
      current = candidate;
    }
  });

  if (current.length) {
    chunks.push([
      buildPreBlockHtml({
        preAttrs,
        codeAttrs,
        text: current.join("\n"),
      }),
    ]);
  }

  return chunks;
}

function groupLineParts(parsed, measureEl, availableHeight) {
  const { tag, attrs, lines } = parsed;
  const chunks = [];
  let current = [];

  lines.forEach((line) => {
    const candidate = current.concat(line);
    const html = buildBlockHtml({
      tag,
      attrs,
      inner: candidate.join("<br>"),
    });

    if (measureHtml(measureEl, html) > availableHeight && current.length) {
      chunks.push([
        buildBlockHtml({ tag, attrs, inner: current.join("<br>") }),
      ]);
      current = [line];
    } else {
      current = candidate;
    }
  });

  if (current.length) {
    chunks.push([buildBlockHtml({ tag, attrs, inner: current.join("<br>") })]);
  }

  const result = [];
  chunks.forEach((chunk) => {
    if (measureHtml(measureEl, chunk[0]) <= availableHeight) {
      result.push(chunk);
      return;
    }

    result.push(
      ...splitOversizedBlockByWords(
        chunk[0],
        measureEl,
        availableHeight,
        parsed,
      ),
    );
  });
  return result;
}

function splitOversizedBlockByWords(
  blockHtml,
  measureEl,
  availableHeight,
  parsed,
) {
  const text = stripHtml(blockHtml);
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 2) return [[blockHtml]];

  const tag = parsed?.tag || blockHtml.match(/^<([a-z0-9]+)/i)?.[1] || "p";
  const attrs =
    parsed?.attrs ?? blockHtml.match(/^<[a-z0-9]+([^>]*)>/i)?.[1] ?? "";
  const chunks = [];
  let current = [];

  words.forEach((word) => {
    const candidate = current.concat(word);
    const html = buildBlockHtml({
      tag,
      attrs,
      inner: candidate.join(" "),
      escapeText: true,
    });

    if (measureHtml(measureEl, html) > availableHeight && current.length) {
      chunks.push([
        buildBlockHtml({
          tag,
          attrs,
          inner: current.join(" "),
          escapeText: true,
        }),
      ]);
      current = [word];
    } else {
      current = candidate;
    }
  });

  if (current.length) {
    chunks.push([
      buildBlockHtml({
        tag,
        attrs,
        inner: current.join(" "),
        escapeText: true,
      }),
    ]);
  }

  return chunks;
}

function measureHtml(measureEl, html) {
  // measureEl has min-height set via CSS, so its scrollHeight always equals
  // clientHeight regardless of content size. We wrap content in an unconstrained
  // child div so scrollHeight reflects the actual rendered content height.
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html || "<p>&nbsp;</p>";
  measureEl.replaceChildren(wrapper);
  return wrapper.scrollHeight;
}

function htmlToBlocks(html) {
  const template = document.createElement("template");
  template.innerHTML = html;
  return [...template.content.childNodes]
    .map((node) =>
      node.nodeType === Node.TEXT_NODE
        ? `<p>${escapeHtml(node.textContent || "")}</p>`
        : node.outerHTML,
    )
    .filter(Boolean);
}

function jsonToHtml(contentJson) {
  try {
    return sanitizeGeneratedHtml(
      generateHTML(contentJson || emptyDoc, extensions),
    );
  } catch {
    return "";
  }
}

function sanitizePastedHtml(html) {
  const isOfficeHtml =
    /mso-|urn:schemas-microsoft-com|class="?Mso|w:WordDocument/i.test(html);
  const template = document.createElement("template");
  template.innerHTML = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<xml[\s\S]*?<\/xml>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "");

  if (isOfficeHtml) {
    return normalizeOfficeHtml(template.content);
  }

  cleanNode(template.content);
  normalizePreElements(template.content);
  return template.innerHTML;
}

function isInCodeBlock(view) {
  return view.state.selection.$from.parent.type.name === "codeBlock";
}

function extractPlainTextFromClipboard(clipboard) {
  const plainText = clipboard
    .getData("text/plain")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  if (plainText) return plainText;

  const html = clipboard.getData("text/html");
  if (!html) return "";

  const template = document.createElement("template");
  template.innerHTML = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");
  normalizePreElements(template.content);

  const pre = template.content.querySelector("pre");
  if (pre) return extractTextWithNewlines(pre).replace(/\n+$/, "");

  return (template.content.textContent || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function extractTextWithNewlines(node) {
  const parts = [];

  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      parts.push(child.textContent || "");
      return;
    }

    if (child.nodeType !== Node.ELEMENT_NODE) return;

    const tag = child.tagName.toLowerCase();
    if (tag === "br") {
      parts.push("\n");
      return;
    }

    if (["p", "div", "li", "tr"].includes(tag)) {
      const inner = extractTextWithNewlines(child);
      if (inner) parts.push(inner);
      parts.push("\n");
      return;
    }

    parts.push(extractTextWithNewlines(child));
  });

  return parts.join("");
}

function normalizePreElements(root) {
  root.querySelectorAll("pre").forEach((pre) => {
    const text = extractTextWithNewlines(pre).replace(/\n+$/, "");
    const code = document.createElement("code");
    code.textContent = text;
    pre.replaceChildren(code);
  });
}

function sanitizeGeneratedHtml(html) {
  const template = document.createElement("template");
  template.innerHTML = html;
  cleanNode(template.content);
  return template.innerHTML;
}

function cleanNode(root) {
  [...root.querySelectorAll("*")].forEach((element) => {
    const tag = element.tagName.toLowerCase();
    if (
      ![
        "p",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "br",
        "strong",
        "b",
        "em",
        "i",
        "u",
        "ul",
        "ol",
        "li",
        "span",
        "div",
        "blockquote",
        "pre",
        "code",
      ].includes(tag)
    ) {
      element.replaceWith(document.createTextNode(element.textContent || ""));
      return;
    }

    [...element.attributes].forEach((attribute) => {
      if (attribute.name === "style") {
        const style = cleanStyle(attribute.value);
        if (style) element.setAttribute("style", style);
        else element.removeAttribute("style");
      } else if (attribute.name !== "data-text-align") {
        element.removeAttribute(attribute.name);
      }
    });

    if (tag === "span" && !element.getAttribute("style")) {
      element.replaceWith(...element.childNodes);
    }
  });
}

function insertCleanHtml(view, html) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  const parser = ProseMirrorDOMParser.fromSchema(view.state.schema);
  const slice = parser.parseSlice(wrapper);
  const boldMark = view.state.schema.marks.bold;
  let tr = view.state.tr.removeStoredMark(boldMark).replaceSelection(slice);

  tr = tr.removeStoredMark(boldMark).scrollIntoView();

  view.dispatch(tr);
}

function normalizeOfficeHtml(root) {
  return [...root.childNodes]
    .map((node) => serializeOfficeNode(node, defaultInlineState()))
    .join("")
    .trim();
}

function serializeOfficeNode(node, inheritedState) {
  if (node.nodeType === Node.TEXT_NODE) {
    return wrapInlineText(escapeHtml(node.textContent || ""), inheritedState);
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const tag = node.tagName.toLowerCase();
  const styleState = readInlineState(node.getAttribute("style") || "");
  const nextState = {
    bold: styleState.bold ?? inheritedState.bold,
    italic: styleState.italic ?? inheritedState.italic,
    underline: styleState.underline ?? inheritedState.underline,
  };

  if (tag === "b" || tag === "strong") nextState.bold = true;
  if (tag === "i" || tag === "em") nextState.italic = true;
  if (tag === "u") nextState.underline = true;

  const children = [...node.childNodes]
    .map((child) => serializeOfficeNode(child, nextState))
    .join("");

  if (!children && tag !== "br") return "";

  if (tag === "br") return "<br>";
  if (tag === "ul" || tag === "ol") return `<${tag}>${children}</${tag}>`;
  if (tag === "li") return `<li>${children}</li>`;
  if (tag === "pre") return `<pre>${children}</pre>`;
  if (tag === "code") return `<code>${children}</code>`;

  if (["p", "div", "blockquote"].includes(tag) || /^h[1-6]$/.test(tag)) {
    const align = readBlockAlign(node.getAttribute("style") || "");
    const styleAttr = align ? ` style="text-align: ${align}"` : "";
    const blockTag = tag === "div" ? "p" : tag;
    return `<${blockTag}${styleAttr}>${children}</${blockTag}>`;
  }

  return children;
}

function defaultInlineState() {
  return {
    bold: false,
    italic: false,
    underline: false,
  };
}

function readInlineState(styleText) {
  const state = {
    bold: null,
    italic: null,
    underline: null,
  };

  styleText.split(";").forEach((rule) => {
    const [nameRaw, valueRaw] = rule.split(":");
    if (!nameRaw || !valueRaw) return;
    const name = nameRaw.trim().toLowerCase();
    const value = valueRaw.trim().toLowerCase();

    if (name === "font-weight") {
      if (value === "normal" || value === "400") state.bold = false;
      if (value === "bold" || /^[6-9]00$/.test(value)) state.bold = true;
    }

    if (name === "mso-bidi-font-weight" && value === "normal") {
      state.bold = false;
    }

    if (name === "font-style") {
      if (value === "normal") state.italic = false;
      if (value === "italic") state.italic = true;
    }

    if (name === "text-decoration") {
      if (value.includes("underline")) state.underline = true;
      if (value === "none") state.underline = false;
    }
  });

  return state;
}

function readBlockAlign(styleText) {
  const match = styleText.match(
    /text-align\s*:\s*(left|right|center|justify)/i,
  );
  return match ? match[1].toLowerCase() : "";
}

function wrapInlineText(text, state) {
  if (!text) return "";

  let html = text;
  if (state.bold) html = `<strong>${html}</strong>`;
  if (state.italic) html = `<em>${html}</em>`;
  if (state.underline) html = `<u>${html}</u>`;
  return html;
}

function plainTextToHtml(text) {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!normalized) return "";

  return normalized
    .split(/\n{2,}/)
    .map(
      (paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`,
    )
    .join("");
}

function cleanStyle(styleText) {
  const allowed = [];
  styleText.split(";").forEach((rule) => {
    const [nameRaw, valueRaw] = rule.split(":");
    if (!nameRaw || !valueRaw) return;
    const name = nameRaw.trim().toLowerCase();
    const value = valueRaw.trim();
    if (name.startsWith("mso-")) return;
    if (
      name === "text-align" &&
      ["left", "right", "center", "justify"].includes(value)
    ) {
      allowed.push(`text-align: ${value}`);
    }
    if (name === "font-style" && value === "italic") {
      allowed.push("font-style: italic");
    }
    if (name === "text-decoration" && value.includes("underline")) {
      allowed.push("text-decoration: underline");
    }
  });
  return allowed.join("; ");
}

function stripHtml(html) {
  const template = document.createElement("template");
  template.innerHTML = html || "";
  return template.content.textContent || "";
}

function extractPreviewText(contentJson) {
  const html = jsonToHtml(contentJson);
  return stripHtml(html).replace(/\s+/g, " ").trim().slice(0, 80);
}

function countPagesByItem(pages) {
  return pages.reduce((acc, page) => {
    acc[page.itemId] = (acc[page.itemId] || 0) + 1;
    return acc;
  }, {});
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
