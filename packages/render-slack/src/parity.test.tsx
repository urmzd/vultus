import {
  AgentList,
  defaultCopy,
  FailureAlert,
  MessageView,
  RequestView,
  TurnView,
} from "@vultus/components";
import { ActionId, decodeAction, type InboxMessage } from "@vultus/core";
import * as fx from "@vultus/core/fixtures";
import { Actions, Button, Checkboxes } from "@vultus/primitives";
import { describe, expect, it } from "vitest";
import {
  AMOUNT_MODAL,
  amountModal,
  askForm,
  decodeAmountModal,
  decodeAskForm,
  ENTRY,
  renderToSlack,
} from "./index";

const types = (blocks: { type: string }[]) => blocks.map((b) => b.type);
const mail = (id: string) => fx.mailMessages.find((m) => m.id === id) as InboxMessage;

describe("empty containers", () => {
  it("leaves out an actions block with nothing in it", () => {
    const out = renderToSlack(
      <>
        <Actions blockId="none">{false}</Actions>
        <Actions blockId="one">
          <Button
            label="Go"
            action={{ id: ActionId.retry, payload: { turnId: "t", target: "t" } }}
          />
        </Actions>
      </>,
    );
    expect(out.blocks).toEqual([expect.objectContaining({ type: "actions", block_id: "one" })]);
  });

  it("leaves out checkboxes with nothing to tick", () => {
    const out = renderToSlack(
      <Checkboxes name="g" options={[{ id: "a", label: "A", disabled: true }]} selected={[]} />,
    );
    expect(out.blocks).toEqual([]);
  });

  it("never emits an empty actions block for a limit with nothing offered as a button", () => {
    const base = mail("m-limit");
    const onlyRaise: InboxMessage = {
      ...base,
      parts: base.parts.map((p) => ({ ...p, allowed: [ActionId.raiseBudget] })),
    };
    for (const message of [base, onlyRaise, ...fx.mailMessages]) {
      for (const block of renderToSlack(<MessageView message={message} />).blocks) {
        if (block.type === "actions")
          expect((block.elements as unknown[]).length).toBeGreaterThan(0);
      }
    }
  });
});

describe("a limit", () => {
  it("offers Acknowledge and a raise to a typed amount when the host lists them", () => {
    const { blocks } = renderToSlack(<MessageView message={mail("m-limit")} />);
    const json = JSON.stringify(blocks);
    expect(json).toContain(`"${defaultCopy.acknowledge}"`);
    expect(json).not.toContain(defaultCopy.allowOnce);
    const raise = blocks.find((b) =>
      (b.accessory as { action_id?: string } | undefined)?.action_id?.startsWith(
        ActionId.raiseBudget,
      ),
    ) as unknown as {
      text: { text: string };
      accessory: { value: string; text: { text: string } };
    };
    expect(raise.text.text).toContain(defaultCopy.newLimit);
    expect(raise.text.text).toContain("More than $250.00");
    expect(raise.accessory.text.text).toBe(defaultCopy.raiseLimit);
    // The click carries no amount: the host collects it in amountModal.
    expect(decodeAction(raise.accessory.value)).toEqual({ turnId: "m-limit", target: "spend" });
  });

  it("collects the amount in a modal and sends the same action with it", () => {
    const action = { id: ActionId.raiseBudget, payload: { turnId: "m-limit", target: "spend" } };
    const view = amountModal({ action, unit: "usd", above: 250 });
    expect(view.callback_id).toBe(AMOUNT_MODAL);
    expect(view.blocks[0]?.element).toMatchObject({
      type: "number_input",
      is_decimal_allowed: true,
      min_value: "250.01",
    });
    const submit = (value: string) =>
      decodeAmountModal({ ...view, state: { values: { amount: { value: { value } } } } });
    expect(submit("400")).toEqual({ ...action, payload: { ...action.payload, option: "400" } });
    expect(submit("250")).toBeNull();
    expect(submit("")).toBeNull();
    expect(decodeAmountModal({ callback_id: "other" })).toBeNull();
    const runs = amountModal({ action, unit: "runs", above: 200 });
    expect(runs.blocks[0]?.element).toMatchObject({ is_decimal_allowed: false, min_value: "201" });
  });
});

describe("askForm", () => {
  it("is the shared form, in copy's words, and its submission decodes", () => {
    const view = askForm();
    expect(view.callback_id).toBe(ENTRY.form);
    expect(view.title.text).toBe(defaultCopy.askForm.title);
    expect(view.blocks[0]?.label.text).toBe(defaultCopy.askForm.label);
    expect(view.submit.text).toBe(defaultCopy.askForm.send);
    expect(view.close.text).toBe(defaultCopy.askForm.cancel);
    const sent = decodeAskForm({
      ...view,
      state: { values: { text: { value: { value: "  why 5xx?  " } } } },
    });
    expect(sent).toEqual({ text: "why 5xx?", meta: { kind: "ask" } });
    expect(
      decodeAskForm({ ...view, state: { values: { text: { value: { value: " " } } } } }),
    ).toBeNull();
    const edit = askForm({ title: "Edit", meta: { kind: "edit", turnId: "t" }, initial: "draft" });
    expect(edit.blocks[0]?.element).toMatchObject({ initial_value: "draft" });
    expect(JSON.parse(edit.private_metadata)).toEqual({ kind: "edit", turnId: "t" });
  });
});

describe("RequestView", () => {
  it("names the person, keeps mentions, and escapes everything else they typed", () => {
    const named = renderToSlack(<RequestView by="Dana" text="is <b> & 5 > 4?" />);
    expect(named.blocks).toEqual([
      { type: "section", text: { type: "mrkdwn", text: "*Dana*: is &lt;b&gt; &amp; 5 &gt; 4?" } },
    ]);
    expect(named.text).toBe("Dana: is <b> & 5 > 4?");
    const mention = renderToSlack(<RequestView by="<@U0SANDBOX>" text="ask <@U0OTHER>" />);
    expect(mention.blocks[0]?.text).toEqual({
      type: "mrkdwn",
      text: "<@U0SANDBOX>: ask <@U0OTHER>",
    });
  });
});

describe("AgentList", () => {
  it("lists each agent by handle with what it is for", () => {
    const { blocks, warnings } = renderToSlack(<AgentList agents={fx.agentList} />);
    expect(warnings).toEqual([]);
    const text = JSON.stringify(blocks);
    expect(text).toContain("`@oncall`");
    expect(text).toContain(defaultCopy.agentList.noDescription);
    expect(text).toContain(defaultCopy.agentList.hint);
    expect(renderToSlack(<AgentList agents={[]} />).text).toBe(defaultCopy.agentList.empty);
  });
});

describe("feedback and report", () => {
  it("says a rating already given, since the buttons can't show it", () => {
    const { blocks } = renderToSlack(<TurnView turn={fx.ratedTurn} />);
    const i = types(blocks).indexOf("context_actions");
    expect(blocks[i + 1]).toEqual({
      type: "context",
      elements: [{ type: "mrkdwn", text: defaultCopy.rated.up }],
    });
    const unrated = renderToSlack(<TurnView turn={fx.doneTurn} />).blocks;
    expect(JSON.stringify(unrated)).not.toContain(defaultCopy.rated.up);
  });

  it("leaves out feedback and Report Issue when the host can't act on them", () => {
    const done = renderToSlack(<TurnView turn={fx.doneTurn} capabilities={{ feedback: false }} />);
    expect(types(done.blocks)).not.toContain("context_actions");
    const internal = { ...fx.failures.internal, retryable: true };
    const failed = { ...fx.failedTurn, failure: internal };
    const withReport = JSON.stringify(renderToSlack(<TurnView turn={failed} />).blocks);
    expect(withReport).toContain(defaultCopy.report);
    const without = JSON.stringify(
      renderToSlack(<TurnView turn={failed} capabilities={{ report: false }} />).blocks,
    );
    expect(without).not.toContain(defaultCopy.report);
    expect(without).toContain(defaultCopy.retry);
    // Not retryable and no report: nothing to offer, and no empty row.
    const bare = renderToSlack(
      <FailureAlert turnId="t" failure={{ ...internal, retryable: false }} report={false} />,
    );
    expect(types(bare.blocks)).not.toContain("actions");
  });
});
