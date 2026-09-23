import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Render del informe. Los estilos van por componente y no con un plugin de
 * tipografia para que el documento respete los tokens del tema.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="max-w-none text-[15px] leading-relaxed text-[var(--foreground)]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mt-0 mb-4 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-10 mb-3 border-b border-[var(--border)] pb-2 text-lg font-semibold tracking-tight">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-6 mb-2 text-base font-semibold tracking-tight">{children}</h3>
          ),
          p: ({ children }) => <p className="my-3.5">{children}</p>,
          ul: ({ children }) => <ul className="my-3.5 space-y-2 pl-1">{children}</ul>,
          ol: ({ children }) => (
            <ol className="my-3.5 list-decimal space-y-2 pl-5 marker:text-[var(--muted)]">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="relative pl-5 before:absolute before:top-[0.65em] before:left-0 before:size-1.5 before:rounded-full before:bg-[var(--primary)] [ol_&]:pl-0 [ol_&]:before:hidden">
              {children}
            </li>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-[var(--foreground)]">{children}</strong>
          ),
          em: ({ children }) => <em className="text-[var(--muted)] not-italic">{children}</em>,
          blockquote: ({ children }) => (
            <blockquote className="my-4 border-l-2 border-[var(--primary)] bg-[var(--surface-2)] py-2 pl-4 text-[var(--muted)]">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-8 border-[var(--border)]" />,
          a: ({ children, href }) => (
            <a href={href} className="text-[var(--primary)] underline underline-offset-2">
              {children}
            </a>
          ),
          code: ({ children }) => (
            <code className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 font-mono text-[13px]">
              {children}
            </code>
          ),
          table: ({ children }) => (
            <div className="my-5 overflow-x-auto">
              <table className="w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-[var(--border)] px-3 py-2 text-left text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-[var(--border)] px-3 py-2">{children}</td>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
