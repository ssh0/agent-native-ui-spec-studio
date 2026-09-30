import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChatPaneContext, ChatPaneToggle } from "./ChatPaneControl";

describe("shared project chat toggle", () => {
  for (const open of [false, true]) {
    it(`exposes the ${open ? "close" : "open"} action and pane state`, () => {
      const markup = renderToStaticMarkup(
        <ChatPaneContext.Provider value={{ open, enabled: true, toggle: () => {} }}>
          <ChatPaneToggle />
        </ChatPaneContext.Provider>,
      );
      expect(markup).toContain(`aria-expanded="${open}"`);
      expect(markup).toContain('aria-controls="project-chat-pane"');
      expect(markup).toContain(open ? "チャットを閉じる" : "エージェントチャットを開く");
      expect(markup).not.toContain('disabled=""');
    });
  }
  it("does not open an unscoped chat without a project", () => {
    expect(renderToStaticMarkup(<ChatPaneToggle />)).toContain('disabled=""');
  });
});
