import type { PrimitiveProps } from "@vultus/primitives";
import { useContext, useId, useState } from "react";
import { ActionContext, buttonClass } from "./buttons";

/** A number this unit takes: dollars and cents for money, a whole number for the rest. */
function parseAmount(text: string, unit: string): number | undefined {
  const t = text.trim().replace(/^\$/, "").replaceAll(",", "");
  if (!(unit === "usd" ? /^\d+(\.\d{1,2})?$/ : /^\d+$/).test(t)) return undefined;
  return Number(t);
}

/**
 * A number field and its button. The button sends the number as the action's
 * `option`, and stays off until the number is valid and more than `above`.
 */
export function Amount({ label, unit, above, hint, submit }: PrimitiveProps["Amount"]) {
  const onAction = useContext(ActionContext);
  const [text, setText] = useState("");
  const id = useId();
  const hintId = useId();
  const money = unit === "usd";
  const value = parseAmount(text, unit);
  const ok = value !== undefined && (above === undefined || value > above);
  const bad = text.trim() !== "" && !ok;
  return (
    <form
      data-aui="amount"
      onSubmit={(e) => {
        e.preventDefault();
        if (ok)
          onAction({
            id: submit.action.id,
            payload: { ...submit.action.payload, option: String(value) },
          });
      }}
      className="flex min-w-0 flex-col gap-1"
    >
      <label htmlFor={id} className="font-medium text-aui-muted text-aui-xs">
        {label}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`flex h-8 w-40 min-w-0 items-center gap-1 rounded-aui border bg-aui-bg px-2.5 focus-within:border-aui-accent focus-within:ring-2 focus-within:ring-aui-ring ${bad ? "border-aui-bad" : "border-aui-border"}`}
        >
          {money && (
            <span aria-hidden className="text-aui-muted text-aui-sm">
              $
            </span>
          )}
          <input
            id={id}
            inputMode={money ? "decimal" : "numeric"}
            value={text}
            aria-invalid={bad || undefined}
            aria-describedby={hint ? hintId : undefined}
            onChange={(e) => setText(e.target.value)}
            className="h-full min-w-0 flex-1 bg-transparent text-aui-sm tabular-nums outline-none"
          />
          {!money && <span className="text-aui-muted text-aui-xs">{unit}</span>}
        </span>
        <button
          type="submit"
          disabled={!ok}
          className={buttonClass(submit.style === "danger" ? "danger" : "primary")}
        >
          {submit.label}
        </button>
      </div>
      {hint && (
        <p id={hintId} className="text-aui-muted text-aui-xs">
          {hint}
        </p>
      )}
    </form>
  );
}
