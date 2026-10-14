import { defaultCopy } from "@vultus/components";
import type { TurnEvent } from "@vultus/core";
import * as fx from "@vultus/core/fixtures";
import { describe, expect, it } from "vitest";
import { SlackError, slackClient, slackCode } from "./client";
import { type StreamTarget, streamTurn, TurnStream } from "./turn";

type Call = { method: string; args: Record<string, unknown> };

/** A Slack that records every call and answers each method as told. */
function fakeSlack(refuse: Record<string, string> = {}) {
  const calls: Call[] = [];
  let n = 0;
  return {
    calls,
    methods: () => calls.map((c) => c.method),
    async call<T>(method: string, args: Record<string, unknown> = {}): Promise<T> {
      calls.push({ method, args });
      const code = refuse[method];
      if (code) throw new SlackError(method, code);
      n += 1;
      return { ok: true, ts: `100.${n}`, channel: "C1" } as T;
    },
  };
}

const target: StreamTarget = {
  channel: "C1",
  threadTs: "1.0",
  triggerTs: "1.0",
  recipientUser: "U1",
  recipientTeam: "T1",
};

const answer: TurnEvent[] = [
  {
    type: "turn.started",
    turnId: "t1",
    agent: { name: "Assistant" },
    sessionUrl: "https://example.com/t/1",
  },
  ...["The ", "rate ", "is ", "back ", "under ", "0.1%."].map((text) => ({
    type: "text.delta" as const,
    text,
  })),
  { type: "turn.completed" },
];

describe("streamTurn", () => {
  it("streams natively: reaction, session, start, appends, then stop with the final blocks", async () => {
    const slack = fakeSlack();
    const { turn, ts, messages } = await streamTurn(slack, target, answer, { tickMs: 0 });
    expect(turn.status).toBe("done");
    expect(turn.text).toBe("The rate is back under 0.1%.");
    const methods = slack.methods();
    expect(methods.slice(0, 3)).toEqual([
      "reactions.add",
      "agents.sessions.setStatus",
      "chat.startStream",
    ]);
    expect(methods).toContain("chat.appendStream");
    const stop = slack.calls.find((c) => c.method === "chat.stopStream");
    expect(stop?.args.blocks).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "context_actions" })]),
    );
    expect(messages).toEqual([ts]);
    // The last thing told is the settled session.
    expect(slack.calls.at(-1)).toMatchObject({
      method: "agents.sessions.setStatus",
      args: { status: "active" },
    });
  });

  it("leaves out feedback when the host has nowhere to keep it", async () => {
    const slack = fakeSlack();
    await streamTurn(slack, target, answer, { tickMs: 0, capabilities: { feedback: false } });
    const stop = slack.calls.find((c) => c.method === "chat.stopStream");
    expect(JSON.stringify(stop?.args.blocks)).not.toContain("feedback_buttons");
  });

  it("posts and edits when the workspace refuses native streaming", async () => {
    const slack = fakeSlack({ "chat.startStream": "not_allowed_token_type" });
    const stream = new TurnStream(slack, target);
    await stream.update({ ...fx.doneTurn, status: "working" });
    expect(stream.streaming).toBe(false);
    await stream.finish(fx.doneTurn);
    expect(slack.methods()).toEqual(expect.arrayContaining(["chat.postMessage", "chat.update"]));
    expect(slack.methods()).not.toContain("chat.appendStream");
  });

  it("continues an overflowing turn with the shared continued copy", async () => {
    const slack = fakeSlack();
    const stream = new TurnStream(slack, target, { native: false });
    const huge = { ...fx.doneTurn, text: "word ".repeat(9000) };
    const { messages } = await stream.finish(huge);
    const posts = slack.calls.filter((c) => c.method === "chat.postMessage");
    expect(posts.length).toBeGreaterThan(1);
    expect(messages).toHaveLength(posts.length);
    const text = String(posts[1]?.args.text);
    expect(text.startsWith(defaultCopy.continued(2, posts.length, "").trim())).toBe(true);
  });

  it("stops a turn whose signal was aborted", async () => {
    const slack = fakeSlack();
    const abort = new AbortController();
    abort.abort();
    const { turn } = await streamTurn(slack, target, answer, { tickMs: 0, signal: abort.signal });
    expect(turn.status).toBe("stopped");
  });
});

describe("slackClient", () => {
  it("throws Slack's error code, readable from any client's error", async () => {
    const fetch = async () =>
      new Response(JSON.stringify({ ok: false, error: "channel_not_found" }), { status: 200 });
    const slack = slackClient("xoxb-test", { fetch });
    const e = await slack.call("chat.postMessage").catch((x: unknown) => x);
    expect(e).toBeInstanceOf(SlackError);
    expect(slackCode(e)).toBe("channel_not_found");
    expect(slackCode(new Error("plain"))).toBeUndefined();
  });

  it("answers only through Slack's own hooks", async () => {
    const seen: string[] = [];
    const fetch = async (url: string | URL | Request) => {
      seen.push(String(url));
      return new Response("ok");
    };
    const slack = slackClient("xoxb-test", { fetch: fetch as typeof globalThis.fetch });
    await slack.respond("https://evil.example.com/hook", { text: "x" });
    await slack.respond("https://hooks.slack.com/commands/T/1/abc", { text: "x" });
    expect(seen).toEqual(["https://hooks.slack.com/commands/T/1/abc"]);
  });
});
