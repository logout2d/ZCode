// Modified for the logout2d ZCode fork.
// Changes: context accounting or workspace Git branch refresh.

import { describe, expect, it } from "vitest";
import { EventReducer } from "../src/events/event-reducer.js";
import {
  createSessionEvent,
  SessionEventType,
} from "../src/events/session.events.js";
import type { SessionId } from "../src/interfaces/shared.js";

const sessionId = "sess_context_test" as SessionId;

function created() {
  return createSessionEvent(
    SessionEventType.SessionCreated,
    sessionId,
    { mode: "build", contextWindow: 200000 },
  );
}

function selected(contextWindow?: number) {
  return createSessionEvent(
    SessionEventType.ModelSelected,
    sessionId,
    {
      modelSelection: {
        providerId: "test",
        modelId: "test-model",
      },
      contextWindow,
    },
  );
}

function completed(
  querySource: string | undefined,
  contextWindow?: number,
  stopReason = "stop",
) {
  return createSessionEvent(
    SessionEventType.ModelComplete,
    sessionId,
    {
      content: "Test",
      querySource,
      stopReason,
      contextWindow,
      usage: {
        inputTokens: 469724,
        outputTokens: 1441,
        totalTokens: 471165,
        cacheReadTokens: 468992,
      },
    },
  );
}

describe("SessionProjection context window", () => {
  const reducer = new EventReducer();

  it("preserves the initial session window", () => {
    expect(
      reducer.reduce([created()]).contextWindow,
    ).toBe(200000);
  });

  it("updates window on model selection", () => {
    expect(
      reducer.reduce([
        created(),
        selected(1048576),
      ]).contextWindow,
    ).toBe(1048576);
  });

  it("updates window and usage on main completion", () => {
    const projection = reducer.reduce([
      created(),
      completed("main_turn", 1048576),
    ]);

    expect(projection.contextWindow).toBe(1048576);
    expect(projection.contextUsed).toBe(471165);
  });

  it("ignores auxiliary context windows", () => {
    for (const source of [
      "session_title",
      "compact",
      "subagent",
    ]) {
      expect(
        reducer.reduce([
          created(),
          selected(1048576),
          completed(source, 200000),
        ]).contextWindow,
      ).toBe(1048576);
    }
  });

  it("supports switching to a smaller window", () => {
    expect(
      reducer.reduce([
        created(),
        selected(1048576),
        selected(200000),
      ]).contextWindow,
    ).toBe(200000);
  });

  it("preserves window for legacy missing metadata", () => {
    expect(
      reducer.reduce([
        created(),
        selected(1048576),
        selected(),
        completed("main_turn"),
      ]).contextWindow,
    ).toBe(1048576);
  });

  it("ignores legacy internal tool windows", () => {
    expect(
      reducer.reduce([
        created(),
        selected(1048576),
        completed(undefined, 200000, "tool_internal"),
      ]).contextWindow,
    ).toBe(1048576);
  });
});
