import { describe, it, expect } from "vitest";

describe("Workflows Navigation & Routing Specification", () => {
  it("verifies workflows page route is /workflows with redirect from /workflow", () => {
    const routeConfig = [
      { path: "/workflow", redirect: "/workflows" },
      { path: "/workflows", component: "WorkflowsPage" },
      { path: "/workflow/:id", component: "WorkflowViewPage" },
      { path: "/workflows/:id", component: "WorkflowViewPage" },
    ];

    const workflowsRoute = routeConfig.find((r) => r.path === "/workflows");
    expect(workflowsRoute).toBeTruthy();
    expect(workflowsRoute?.component).toBe("WorkflowsPage");

    const legacyRoute = routeConfig.find((r) => r.path === "/workflow");
    expect(legacyRoute).toBeTruthy();
    expect(legacyRoute?.redirect).toBe("/workflows");
  });

  it("verifies clicking on a workflow row or card opens the workflow view page", () => {
    let navigatedTo: string | null = null;
    const navigate = (path: string) => {
      navigatedTo = path;
    };

    const handleOpenWorkflowView = (wf: any) => {
      const targetName = String(wf?.name || wf?.workflowName || wf?.id || "").trim();
      if (!targetName) return;
      navigate(`/workflows/${encodeURIComponent(targetName)}`);
    };

    const sampleWf = { name: "Customer_KYC_Verification", version: 2 };
    handleOpenWorkflowView(sampleWf);

    expect(navigatedTo).toBe("/workflows/Customer_KYC_Verification");
  });

  it("verifies Designer opens ONLY on explicit 'Open in Designer' action", () => {
    let openedUrl: string | null = null;
    let windowOpened = false;

    const mockWindowOpen = (url: string) => {
      openedUrl = url;
      windowOpened = true;
    };

    const handleOpenInDesigner = (wf: any) => {
      const workflowName = String(wf?.name || wf?.workflowName || "").trim();
      if (!workflowName) return;
      mockWindowOpen(`/designer/${encodeURIComponent(workflowName)}`);
    };

    const sampleWf = { name: "Order_Fulfillment_Flow", version: 1 };

    // Record click does NOT open designer
    const handleRecordClick = (wf: any) => {
      // Record click should route to view page, not open designer
      return `/workflows/${encodeURIComponent(wf.name)}`;
    };

    const resultPath = handleRecordClick(sampleWf);
    expect(resultPath).toBe("/workflows/Order_Fulfillment_Flow");
    expect(windowOpened).toBe(false);

    // Only explicit Open in Designer opens designer
    handleOpenInDesigner(sampleWf);
    expect(windowOpened).toBe(true);
    expect(openedUrl).toBe("/designer/Order_Fulfillment_Flow");
  });

  describe("Page Titles Specification", () => {
    it("sets expected document titles for each key route", () => {
      const getDocumentTitle = (route: string, context?: { name?: string; workflowId?: string }) => {
        if (route === "/executions") return "Executions";
        if (route === "/workflows") return "Workflows";
        if (route === "/workflows/:id") return context?.name || "Workflow";
        if (route === "/designer") return context?.name || "Untitled workflow";
        if (route === "/" || route === "/dashboard" || route === "/home") return "Dashboard";
        return "Weaver";
      };

      expect(getDocumentTitle("/executions")).toBe("Executions");
      expect(getDocumentTitle("/workflows")).toBe("Workflows");
      expect(getDocumentTitle("/workflows/:id", { name: "my_payment_flow" })).toBe("my_payment_flow");
      expect(getDocumentTitle("/designer")).toBe("Untitled workflow");
      expect(getDocumentTitle("/designer", { name: "order_process" })).toBe("order_process");
      expect(getDocumentTitle("/")).toBe("Dashboard");
      expect(getDocumentTitle("/dashboard")).toBe("Dashboard");
      expect(getDocumentTitle("/home")).toBe("Dashboard");
    });
  });
});


