import { WorkflowViewContent, type WorkflowViewContentProps } from "@/features/workflows";
import "@/styles/definitionPages.css";

export default function WorkflowViewPage({
  onBack,
}: WorkflowViewContentProps = {}) {
  return (
    <div className="definitions-page">
      <div className="definitions-content">
        <WorkflowViewContent onBack={onBack} />
      </div>
    </div>
  );
}
