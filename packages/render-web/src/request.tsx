import type { PrimitiveProps } from "@vultus/primitives";

/**
 * What a person asked: a right-aligned bubble. It needs no surface around it,
 * so a chat can draw it directly; the `Request` primitive draws the same.
 */
export function RequestBubble({ by, text }: PrimitiveProps["Request"]) {
  return (
    <article aria-label={`${by} message`} className="aui-fade-up flex justify-end">
      <p className="max-w-[min(80%,36rem)] whitespace-pre-wrap break-words rounded-aui-lg rounded-br-aui-sm bg-aui-subtle px-3.5 py-2 text-aui-base text-aui-fg">
        {text}
      </p>
    </article>
  );
}
