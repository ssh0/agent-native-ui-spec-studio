import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { suppressWorkspaceConnectionPrompt } from "./settings-tabs";

describe("workspace settings tabs", () => {
  it("keeps the workspace panel while suppressing its inline connection prompt", () => {
    function WorkspacePanel({
      builderConnectionOwnedExternally = false,
    }: {
      builderConnectionOwnedExternally?: boolean;
    }) {
      return createElement(
        "section",
        null,
        createElement("h2", null, "Hosting"),
        !builderConnectionOwnedExternally &&
          createElement("button", null, "Connect"),
      );
    }

    const tab = {
      id: "workspace",
      label: "Workspace",
      content: createElement(WorkspacePanel),
    };
    const updated = suppressWorkspaceConnectionPrompt(tab);
    const markup = renderToStaticMarkup(updated.content);

    expect(updated.label).toBe("Workspace");
    expect(markup).toContain("Hosting");
    expect(markup).not.toContain("Connect");
  });

  it("leaves unrelated tabs unchanged", () => {
    const tab = {
      id: "agent",
      label: "Agent",
      content: createElement("section", null, "AI settings"),
    };

    expect(suppressWorkspaceConnectionPrompt(tab)).toBe(tab);
  });
});
