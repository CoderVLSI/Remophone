// Function declarations shared by the REST chat agent and the Live voice session.
export const functionDeclarations = [
  {
    name: "send_to_channel",
    description:
      "Post a message into one of the user's channels (for example #content or #finances). Use it to route work or updates to the channel where they belong.",
    parameters: {
      type: "OBJECT",
      properties: {
        channel: { type: "STRING", description: "Channel name without the leading #." },
        message: { type: "STRING", description: "The message to post in that channel." },
      },
      required: ["channel", "message"],
    },
  },
  {
    name: "create_task",
    description:
      "Create a background task that shows up in the Tasks tab. Set requires_approval for anything that sends a message, spends money, signs a document or deletes something.",
    parameters: {
      type: "OBJECT",
      properties: {
        title: { type: "STRING" },
        details: { type: "STRING" },
        channel: { type: "STRING", description: "Channel name without the leading #." },
        requires_approval: { type: "BOOLEAN" },
      },
      required: ["title"],
    },
  },
  {
    name: "update_task",
    description: "Update the status or progress of an existing task.",
    parameters: {
      type: "OBJECT",
      properties: {
        task_id: { type: "STRING" },
        status: { type: "STRING", enum: ["queued", "running", "done"] },
        progress: { type: "NUMBER", description: "0 to 1." },
      },
      required: ["task_id"],
    },
  },
  {
    name: "create_artifact",
    description:
      "Create a new file in the Make tab: a slide deck, a written document, or a design with several screens. Generation takes a few seconds.",
    parameters: {
      type: "OBJECT",
      properties: {
        kind: { type: "STRING", enum: ["deck", "document", "design"] },
        title: { type: "STRING" },
        brief: { type: "STRING", description: "What the file should contain." },
        channel: { type: "STRING", description: "Channel name without the leading #." },
      },
      required: ["kind", "title", "brief"],
    },
  },
  {
    name: "edit_artifact",
    description:
      "Change an existing file in the Make tab, for example add a slide or rewrite a section. Use the artifact id from the workspace summary.",
    parameters: {
      type: "OBJECT",
      properties: {
        artifact_id: { type: "STRING" },
        instruction: { type: "STRING" },
      },
      required: ["artifact_id", "instruction"],
    },
  },
];

export const toolsConfig = [{ functionDeclarations }];

// Responds to a model tool call using the app's actions.
// `ctx` supplies: getState, addMessage, addTask, updateTask, createArtifact, editArtifact.
export async function executeTool(name, args, ctx) {
  const state = ctx.getState();
  const findChannel = (raw) => {
    if (!raw) return null;
    const wanted = String(raw).replace(/^#/, "").trim().toLowerCase();
    return state.channels.find((c) => c.name.toLowerCase() === wanted) || null;
  };

  switch (name) {
    case "send_to_channel": {
      const channel = findChannel(args.channel);
      if (!channel) {
        return { error: `No channel named "${args.channel}". Channels: ${state.channels.map((c) => c.name).join(", ")}` };
      }
      ctx.addMessage({ role: "assistant", channel: channel.id, text: String(args.message || "") });
      ctx.noteRoutedChannel(channel.id);
      return { ok: true, channel: channel.name };
    }
    case "create_task": {
      const channel = findChannel(args.channel);
      const id = ctx.addTask({
        title: String(args.title || "Untitled task"),
        details: args.details ? String(args.details) : "",
        channel: channel ? channel.id : null,
        status: args.requires_approval ? "needs_approval" : "queued",
      });
      return { ok: true, task_id: id, status: args.requires_approval ? "needs_approval" : "queued" };
    }
    case "update_task": {
      const task = state.tasks.find((t) => t.id === args.task_id);
      if (!task) return { error: `No task with id ${args.task_id}` };
      ctx.updateTask(args.task_id, {
        ...(args.status ? { status: args.status } : null),
        ...(typeof args.progress === "number" ? { progress: Math.max(0, Math.min(1, args.progress)) } : null),
      });
      return { ok: true };
    }
    case "create_artifact": {
      const channel = findChannel(args.channel);
      const result = await ctx.createArtifact({
        kind: args.kind,
        title: String(args.title || "Untitled"),
        brief: String(args.brief || ""),
        channel: channel ? channel.id : null,
      });
      return result;
    }
    case "edit_artifact": {
      return ctx.editArtifact(args.artifact_id, String(args.instruction || ""));
    }
    default:
      return { error: `Unknown tool ${name}` };
  }
}
