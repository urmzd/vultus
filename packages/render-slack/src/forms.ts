import { decodeAction, encodeAction, formatAmount, type UiAction } from "@vultus/core";

/**
 * The ways into an agent besides a direct message or a mention, and the forms
 * a host opens with `views.open` to collect what a button can't carry. The ids
 * are shared, so a host's manifest and the handlers that answer it can't drift.
 */
export const ENTRY = {
  /** Global shortcut: ask from anywhere, answered in the app's messages with that person. */
  ask: "aui_ask",
  /** Message shortcut: ask about one message, answered in its thread. */
  askAbout: "aui_ask_about",
  command: "/agent",
  /** Workflow Builder step: a workflow asks, and waits for the turn (and any approval) to end. */
  step: "aui_ask_step",
  /** The one text form: `askForm`, and any other words a host collects (Edit, Ask, Something Else). */
  form: "aui_form",
} as const;

/** `callback_id` of `amountModal`; match it on view_submission. */
export const AMOUNT_MODAL = "aui.amount.modal";

const plain = (text: string, max: number) => ({
  type: "plain_text",
  text: text.length <= max ? text : `${text.slice(0, max - 1)}…`,
});

/** Mirrors `copy.askForm` in @vultus/components; pass the host's copy to change it. */
export interface AskFormLabels {
  title: string;
  label: string;
  send: string;
  cancel: string;
}

const ASK_LABELS: AskFormLabels = {
  title: "Ask the agent",
  label: "What do you need?",
  send: "Send",
  cancel: "Cancel",
};

/**
 * The one-field form a shortcut opens (`ENTRY.form`). `meta` comes back on
 * submit, so the handler knows what the words are for; it defaults to
 * `{ kind: "ask" }`. Read the submission with `decodeAskForm`.
 */
export function askForm(
  options: Partial<AskFormLabels> & { initial?: string; meta?: Record<string, unknown> } = {},
) {
  const { initial, meta = { kind: "ask" }, ...labels } = options;
  const l = { ...ASK_LABELS, ...labels };
  const metadata = JSON.stringify(meta);
  if (metadata.length > 3000)
    throw new RangeError("private_metadata is limited to 3000 characters");
  return {
    type: "modal",
    callback_id: ENTRY.form,
    private_metadata: metadata,
    title: plain(l.title, 24),
    submit: plain(l.send, 24),
    close: plain(l.cancel, 24),
    blocks: [
      {
        type: "input",
        block_id: "text",
        label: plain(l.label, 2000),
        element: {
          type: "plain_text_input",
          action_id: "value",
          multiline: true,
          ...(initial ? { initial_value: initial.slice(0, 3000) } : {}),
        },
      },
    ],
  };
}

/** The words and `meta` of a submitted `askForm`, or null when it isn't one or was sent empty. */
export function decodeAskForm<M = { kind: string }>(view: {
  callback_id?: string;
  private_metadata?: string;
  state?: { values?: Record<string, Record<string, { value?: string | null }>> };
}): { text: string; meta: M } | null {
  if (view.callback_id !== ENTRY.form) return null;
  const text = view.state?.values?.text?.value?.value?.trim() ?? "";
  if (!text) return null;
  const meta = (view.private_metadata ? JSON.parse(view.private_metadata) : {}) as M;
  return { text, meta };
}

/** Mirrors `copy.raiseLimitTitle`, `copy.newLimit`, `copy.raiseLimit` and `copy.cancel`. */
export interface AmountModalLabels {
  title: string;
  label: string;
  submit: string;
  cancel: string;
  /** Said under the field when there is a lower bound: "More than $50.00". */
  moreThan: (amount: string) => string;
}

const AMOUNT_LABELS: AmountModalLabels = {
  title: "Raise the limit",
  label: "New limit",
  submit: "Raise Limit",
  cancel: "Cancel",
  moreThan: (amount) => `More than ${amount}`,
};

/** The smallest step a unit takes: a cent for money, one for counts. */
function step(unit: string) {
  return unit === "usd" ? 0.01 : 1;
}

/**
 * The form an `Amount` button opens on Slack, where a message has no number
 * field: one `number_input`, bounded like the web's field. `action` is the
 * clicked action as `decodeSlackAction` returned it; `decodeAmountModal`
 * gives it back with the number in `option`. Open it straight away: the
 * trigger_id lasts about three seconds.
 */
export function amountModal(
  {
    action,
    unit,
    above,
    initial,
  }: { action: UiAction; unit: string; above?: number; initial?: number },
  labels: Partial<AmountModalLabels> = {},
) {
  const l = { ...AMOUNT_LABELS, ...labels };
  const decimal = unit === "usd";
  const min = above === undefined ? undefined : above + step(unit);
  const fixed = (n: number) => (decimal ? n.toFixed(2) : String(Math.round(n)));
  return {
    type: "modal",
    callback_id: AMOUNT_MODAL,
    // The action to send, ids only, never content.
    private_metadata: JSON.stringify({
      id: action.id,
      p: encodeAction(action.payload),
      unit,
      above,
    }),
    title: plain(l.title, 24),
    submit: plain(l.submit, 24),
    close: plain(l.cancel, 24),
    blocks: [
      {
        type: "input",
        block_id: "amount",
        label: plain(decimal ? `${l.label} ($)` : `${l.label} (${unit})`, 2000),
        ...(above !== undefined
          ? { hint: plain(l.moreThan(formatAmount(above, unit)), 2000) }
          : {}),
        element: {
          type: "number_input",
          action_id: "value",
          is_decimal_allowed: decimal,
          ...(min !== undefined ? { min_value: fixed(min) } : {}),
          ...(initial !== undefined ? { initial_value: fixed(initial) } : {}),
        },
      },
    ],
  };
}

/**
 * The action a submitted `amountModal` means, with the number in `option`, or
 * null when it isn't one, is empty, or isn't more than the lower bound.
 */
export function decodeAmountModal(view: {
  callback_id?: string;
  private_metadata?: string;
  state?: { values?: Record<string, Record<string, { value?: string | null }>> };
}): UiAction | null {
  if (view.callback_id !== AMOUNT_MODAL || !view.private_metadata) return null;
  const { id, p, above } = JSON.parse(view.private_metadata) as {
    id: UiAction["id"];
    p: string;
    above?: number;
  };
  const value = view.state?.values?.amount?.value?.value?.trim();
  const n = value ? Number(value) : Number.NaN;
  if (!Number.isFinite(n) || (above !== undefined && n <= above)) return null;
  return { id, payload: { ...decodeAction(p), option: String(n) } };
}
