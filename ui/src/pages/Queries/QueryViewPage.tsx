import { QueryViewContent, type QueryViewContentProps } from "@/features/queries";
import "@/styles/definitionPages.css";

export default function QueryViewPage({
  isCreateMode,
  onBack,
}: QueryViewContentProps = {}) {
  return (
    <div className="definitions-page">
      <div className="definitions-content">
        <QueryViewContent isCreateMode={isCreateMode} onBack={onBack} />
      </div>
    </div>
  );
}
