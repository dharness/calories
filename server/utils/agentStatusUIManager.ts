import { render } from "ink";
import React from "react";
import { AgentStatusUI } from "./agentStatusUI";

class AgentStatusUIManager {
  private static isRendered = false;
  private static renderInstance: ReturnType<typeof render> | null = null;

  static ensureInitialized(): void {
    if (AgentStatusUIManager.isRendered) {
      return;
    }

    AgentStatusUIManager.isRendered = true;
    AgentStatusUIManager.renderInstance = render(React.createElement(AgentStatusUI), {
      patchConsole: true,
    });
  }

  static unmount(): void {
    if (AgentStatusUIManager.renderInstance) {
      AgentStatusUIManager.renderInstance.unmount();
      AgentStatusUIManager.renderInstance = null;
      AgentStatusUIManager.isRendered = false;
    }
  }
}

AgentStatusUIManager.ensureInitialized();

export { AgentStatusUIManager };
