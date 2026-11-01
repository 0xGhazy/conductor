import { useRef } from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SelectionTrace } from "@/features/designer/nodes/SelectionTrace";

function Harness({ active }: { active: boolean }) {
  const targetRef = useRef<HTMLDivElement>(null);
  return (
    <div style={{ position: "relative" }}>
      <div ref={targetRef} style={{ borderRadius: "16px", border: "2px solid black" }} />
      <SelectionTrace active={active} targetRef={targetRef} duration={2000} />
    </div>
  );
}

describe("SelectionTrace", () => {
  it("renders nothing while inactive", () => {
    render(<Harness active={false} />);
    expect(screen.queryByTestId("selection-trace")).toBeNull();
  });

  it("follows the target's radius and border, and aligns every streak layer's leading edge", () => {
    render(<Harness active />);
    const svg = screen.getByTestId("selection-trace");
    expect(svg).toHaveAttribute("aria-hidden", "true");

    const rects = Array.from(svg.querySelectorAll("rect"));
    // Track + trail + body + head
    expect(rects).toHaveLength(4);
    rects.forEach((rect) => {
      expect(rect).toHaveAttribute("pathLength", "100");
      expect(rect).toHaveAttribute("x", "1");
      expect(rect).toHaveAttribute("rx", "15");
    });

    // Leading edge = dash length + (delay shift as % of the loop); equal for all layers.
    const leadingEdges = rects.slice(1).map((rect) => {
      const length = parseFloat(rect.style.strokeDasharray);
      const shift = (-parseFloat(rect.style.animationDelay) / 2000) * 100;
      return length + shift;
    });
    expect(new Set(leadingEdges).size).toBe(1);
  });

  it("is removed as soon as it becomes inactive", () => {
    const { rerender } = render(<Harness active />);
    expect(screen.getByTestId("selection-trace")).toBeInTheDocument();
    rerender(<Harness active={false} />);
    expect(screen.queryByTestId("selection-trace")).toBeNull();
  });
});
