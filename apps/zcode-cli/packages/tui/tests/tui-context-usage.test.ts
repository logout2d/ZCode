// Modified for the logout2d ZCode fork.
// Changes: context accounting or workspace Git branch refresh.

import assert from "node:assert/strict";
import test from "node:test";
import {
  SessionEventType,
  type SessionEvent,
} from "@zcode/contracts";
import { applySessionEventToState } from "../src/app-events.js";

type Handlers = Parameters<typeof applySessionEventToState>[1];

function fixture() {
  let context = {
    contextUsed: 0,
    contextWindow: 1048576,
  };

  const noop = () => undefined;

  const handlers: Handlers = {
    setActiveTurnId: noop,
    setCacheStats: noop,
    setContextUsage: (update) => {
      const next = typeof update === "function"
        ? update(context)
        : update;
      context = { ...context, ...next };
    },
    setLastError: noop,
    setLiveModelText: noop,
    setMessages: noop,
    setModel: noop,
    setNetworkRequests: noop,
    setStatus: noop,
    setTodos: noop,
    setUsage: noop,
    assistantMessageIdsByToolCallId: new Map(),
    toolNamesById: new Map(),
  };

  function emit(type: SessionEvent["type"], payload: object) {
    applySessionEventToState(
      { type, payload } as SessionEvent,
      handlers,
    );
  }

  return {
    emit,
    context: () => context,
  };
}

test("main request includes input and output without double counting cache", () => {
  const f = fixture();

  f.emit(SessionEventType.ModelComplete, {
    querySource: "main_turn",
    usage: {
      inputTokens: 54808,
      outputTokens: 3716,
      cacheReadTokens: 54272,
      totalTokens: 58524,
    },
  });

  assert.equal(f.context().contextUsed, 58524);
});

test("sidecar and subagent requests preserve main context", () => {
  const f = fixture();

  f.emit(SessionEventType.ModelComplete, {
    querySource: "main_turn",
    usage: {
      inputTokens: 54808,
      outputTokens: 3716,
    },
  });

  for (const querySource of ["title", "subagent", "compact"]) {
    f.emit(SessionEventType.ModelComplete, {
      querySource,
      usage: {
        inputTokens: 308,
        outputTokens: 10,
      },
    });

    assert.equal(f.context().contextUsed, 58524);
  }
});

test("legacy tool internal event preserves context", () => {
  const f = fixture();

  f.emit(SessionEventType.ModelComplete, {
    querySource: "main_turn",
    usage: {
      inputTokens: 10000,
      outputTokens: 500,
    },
  });

  f.emit(SessionEventType.ModelComplete, {
    stopReason: "tool_internal",
    usage: {
      inputTokens: 100,
      outputTokens: 20,
    },
  });

  assert.equal(f.context().contextUsed, 10500);
});

test("model selection updates context window", () => {
  const f = fixture();

  for (const contextWindow of [200000, 1048576]) {
    f.emit(SessionEventType.ModelSelected, {
      modelSelection: {
        providerId: "test",
        modelId: "test-model",
      },
      contextWindow,
    });

    assert.equal(f.context().contextWindow, contextWindow);
  }
});

test("main request after compact can reduce context usage", () => {
  const f = fixture();

  for (const inputTokens of [900000, 25000]) {
    f.emit(SessionEventType.ModelComplete, {
      querySource: "main_turn",
      usage: {
        inputTokens,
        outputTokens: 1000,
      },
    });

    assert.equal(f.context().contextUsed, inputTokens + 1000);
  }
});
