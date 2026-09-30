import { IconLayoutSidebarRight } from "@tabler/icons-react";
import { createContext, useContext } from "react";

import { Button } from "@/components/ui/button";

export const ChatPaneContext = createContext({
  open: false,
  enabled: false,
  toggle: () => {},
});

/** One control and one owner for contextual project chat on every route. */
export function ChatPaneToggle() {
  const { open, enabled, toggle } = useContext(ChatPaneContext);
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      disabled={!enabled}
      aria-label={open ? "チャットを閉じる" : "エージェントチャットを開く"}
      data-chat-pane-toggle
      aria-expanded={open}
      aria-controls="project-chat-pane"
      onClick={toggle}
    >
      <IconLayoutSidebarRight />
    </Button>
  );
}
