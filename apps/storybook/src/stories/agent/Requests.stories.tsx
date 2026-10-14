import type { Meta, StoryObj } from "@storybook/react-vite";
import { AgentList, RequestView } from "@vultus/components";
import * as fx from "@vultus/core/fixtures";
import { expect, fn, within } from "storybook/test";
import { type ActionArgs, Canvas, slack } from "../../support";

const meta = {
  title: "Agent/Requests",
  tags: ["slack"],
  parameters: {
    docs: {
      description: {
        component:
          "Where a conversation starts. `RequestView` is what the person asked: the web draws it as their bubble (`UserMessage` is the same bubble), and a Slack host posts it as the message the answer threads under. `AgentList` is who can be asked, as the web's agent menu shows it and Slack answers `/agent help`.",
      },
    },
  },
  args: { onAction: fn() },
} satisfies Meta<ActionArgs>;

export default meta;
type Story = StoryObj<ActionArgs>;

export const Request: Story = {
  render: ({ onAction }) => (
    <Canvas onAction={onAction}>
      <RequestView {...fx.request} />
    </Canvas>
  ),
  parameters: slack("request", "On Slack, `by` is usually a mention: `request.mention`"),
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("article", { name: "Dana message" }),
    ).toBeVisible();
  },
};

export const Agents: Story = {
  name: "Agents you can ask",
  render: ({ onAction }) => (
    <Canvas onAction={onAction}>
      <AgentList agents={fx.agentList} />
    </Canvas>
  ),
  parameters: slack("agentList"),
};

export const NoAgents: Story = {
  name: "No agents",
  render: ({ onAction }) => (
    <Canvas onAction={onAction}>
      <AgentList agents={[]} />
    </Canvas>
  ),
  parameters: slack("agentList.empty"),
};
