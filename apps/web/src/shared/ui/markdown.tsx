import type { ReactNode } from "react";

import { cn } from "@/shared/lib/cn";

type Tone = "user" | "assistant";

const inlinePattern = new RegExp(
  [
    "(`[^`\\n]+`)",
    "(\\*\\*[^*\\n]+\\*\\*)",
    "(\\*[^*\\n]+\\*)",
    "(\\[[^\\]\\n]+\\]\\(https?:\\/\\/[^\\s)]+\\))",
    "(https?:\\/\\/[^\\s<]+)",
  ].join("|"),
  "g",
);

function linkClass(tone: Tone) {
  return tone === "user"
    ? "underline decoration-primary-foreground/60 underline-offset-4 hover:decoration-primary-foreground"
    : "text-primary underline decoration-primary/50 underline-offset-4 hover:decoration-primary";
}

function splitTrailing(value: string) {
  let href = value;
  let tail = "";
  const punctuation = href.match(/[.,;:!?]+$/);
  if (punctuation) {
    tail = punctuation[0] + tail;
    href = href.slice(0, -punctuation[0].length);
  }
  if (href.endsWith(")") && !href.includes("(")) {
    tail = ")" + tail;
    href = href.slice(0, -1);
  }
  return { href, tail };
}

function renderInline(text: string, tone: Tone, prefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let index = 0;

  for (const match of text.matchAll(inlinePattern)) {
    const start = match.index ?? 0;
    if (start > last) nodes.push(text.slice(last, start));
    const raw = match[0];
    const key = `${prefix}-${index}`;

    if (match[1]) {
      nodes.push(
        <code
          key={key}
          className={cn(
            "px-1 py-0.5 font-mono text-[0.9em]",
            tone === "user"
              ? "bg-primary-foreground/15 text-primary-foreground"
              : "bg-white/10 text-foreground",
          )}
        >
          {raw.slice(1, -1)}
        </code>,
      );
    } else if (match[2]) {
      nodes.push(<strong key={key} className="font-bold">{raw.slice(2, -2)}</strong>);
    } else if (match[3]) {
      nodes.push(<em key={key}>{raw.slice(1, -1)}</em>);
    } else if (match[4]) {
      const link = raw.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
      if (link) {
        nodes.push(
          <a key={key} href={link[2]} target="_blank" rel="noopener noreferrer" className={linkClass(tone)}>
            {link[1]}
          </a>,
        );
      } else {
        nodes.push(raw);
      }
    } else if (match[5]) {
      const { href, tail } = splitTrailing(raw);
      nodes.push(
        <a key={key} href={href} target="_blank" rel="noopener noreferrer" className={linkClass(tone)}>
          {href}
        </a>,
      );
      if (tail) nodes.push(tail);
    } else {
      nodes.push(raw);
    }

    last = start + raw.length;
    index += 1;
  }

  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

type Block =
  | { type: "paragraph"; lines: string[] }
  | { type: "quote"; lines: string[] }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "code"; lines: string[] };

function parseBlocks(text: string): Block[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push({ type: "paragraph", lines: paragraph });
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    blocks.push({ type: "list", ordered: list.ordered, items: list.items });
    list = null;
  };

  let index = 0;
  while (index < lines.length) {
    const line = lines[index];

    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      flushParagraph();
      flushList();
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !/^```\s*$/.test(lines[index])) {
        code.push(lines[index]);
        index += 1;
      }
      index += 1;
      blocks.push({ type: "code", lines: code });
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      index += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      flushParagraph();
      flushList();
      const quote: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quote.push(lines[index].replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push({ type: "quote", lines: quote });
      continue;
    }

    const bullet = line.match(/^\s*[-*+]\s+(.*)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (bullet || ordered) {
      flushParagraph();
      const isOrdered = Boolean(ordered);
      if (list && list.ordered !== isOrdered) flushList();
      if (!list) list = { ordered: isOrdered, items: [] };
      list.items.push((bullet ?? ordered)?.[1] ?? "");
      index += 1;
      continue;
    }

    flushList();
    paragraph.push(line);
    index += 1;
  }

  flushParagraph();
  flushList();
  return blocks;
}

export function Markdown({ text, tone = "assistant", className }: {
  text: string;
  tone?: Tone;
  className?: string;
}) {
  const blocks = parseBlocks(text);

  return (
    <div className={cn("space-y-2 text-sm leading-relaxed [overflow-wrap:anywhere]", className)}>
      {blocks.map((block, index) => {
        if (block.type === "paragraph") {
          return (
            <p key={index} className="whitespace-pre-wrap">
              {renderInline(block.lines.join("\n"), tone, `p${index}`)}
            </p>
          );
        }
        if (block.type === "quote") {
          return (
            <blockquote
              key={index}
              className={cn(
                "border-l-2 pl-2",
                tone === "user" ? "border-primary-foreground/50" : "border-primary",
              )}
            >
              <p className="whitespace-pre-wrap">
                {renderInline(block.lines.join("\n"), tone, `q${index}`)}
              </p>
            </blockquote>
          );
        }
        if (block.type === "list") {
          const items = block.items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInline(item, tone, `l${index}-${itemIndex}`)}</li>
          ));
          return block.ordered ? (
            <ol key={index} className="list-decimal space-y-1 pl-5">{items}</ol>
          ) : (
            <ul key={index} className="list-disc space-y-1 pl-5">{items}</ul>
          );
        }
        return (
          <pre
            key={index}
            className={cn(
              "overflow-x-auto p-2 font-mono text-xs leading-relaxed",
              tone === "user"
                ? "bg-primary-foreground/15 text-primary-foreground"
                : "bg-black/40 text-foreground",
            )}
          >
            <code>{block.lines.join("\n")}</code>
          </pre>
        );
      })}
    </div>
  );
}
