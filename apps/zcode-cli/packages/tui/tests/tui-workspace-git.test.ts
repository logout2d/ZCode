import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { testRender } from "@mbears/opentui-react/test-utils";
import {
  useWorkspaceGitBranch,
  WORKSPACE_GIT_REFRESH_MS,
} from "../src/app-workspace-git.js";

const sleep = (ms: number) =>
  new Promise<void>(resolve => setTimeout(resolve, ms));

type View = Awaited<ReturnType<typeof testRender>>;

async function waitForFrame(
  view: View,
  expected: RegExp,
  timeoutMs = 8000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  do {
    await act(async () => {
      await sleep(50);
    });

    await act(async () => {
      await view.renderOnce();
    });

    if (expected.test(view.captureCharFrame())) {
      return;
    }
  } while (Date.now() < deadline);

  assert.match(view.captureCharFrame(), expected);
}

test("refreshes workspace branch and stops polling on unmount", async () => {
  let view: View | undefined;
  let current: string | undefined = "feature/first";
  let calls = 0;

  const readBranch = async () => {
    calls++;
    return current;
  };

  function Probe() {
    const branch = useWorkspaceGitBranch("main", readBranch);
    return React.createElement("text", null, branch ?? "NO_BRANCH");
  }

  try {
    await act(async () => {
      view = await testRender(React.createElement(Probe), {
        height: 5,
        width: 80,
      });
    });

    assert.ok(view);

    await waitForFrame(view, /feature\/first/);
    console.log("PASS: initial branch, calls =", calls);

    current = "feature/second";

    await waitForFrame(view, /feature\/second/);
    console.log("PASS: branch changed, calls =", calls);

    current = undefined;

    await waitForFrame(view, /NO_BRANCH/);
    console.log("PASS: detached HEAD, calls =", calls);

    current = "feature/recovered";

    await waitForFrame(view, /feature\/recovered/);
    console.log("PASS: branch recovered, calls =", calls);

    assert.ok(calls >= 4);
  } finally {
    await act(async () => {
      view?.renderer.destroy();
    });
  }

  const callsAfterDestroy = calls;

  await sleep(WORKSPACE_GIT_REFRESH_MS + 500);

  assert.equal(calls, callsAfterDestroy);
  console.log("PASS: polling stopped after unmount");
});
