// Modified for the logout2d ZCode fork.
// Changes: context accounting or workspace Git branch refresh.

import { useEffect, useState } from "react";

export const WORKSPACE_GIT_REFRESH_MS = 5000;

export function useWorkspaceGitBranch(
  initialBranch: string | undefined,
  readBranch?: () => Promise<string | undefined>,
): string | undefined {
  const [branch, setBranch] = useState(initialBranch);

  useEffect(() => {
    if (!readBranch) {
      setBranch(initialBranch);
      return;
    }

    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const refresh = async () => {
      if (disposed) return;

      try {
        const next = await readBranch();

        if (!disposed) {
          setBranch(next);
        }
      } catch {
        if (!disposed) {
          setBranch(undefined);
        }
      } finally {
        if (!disposed) {
          timer = setTimeout(() => {
            void refresh();
          }, WORKSPACE_GIT_REFRESH_MS);
        }
      }
    };

    void refresh();

    return () => {
      disposed = true;
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    };
  }, [initialBranch, readBranch]);

  return branch;
}
