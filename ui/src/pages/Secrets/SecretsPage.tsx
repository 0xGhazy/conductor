import { SecretsPageContent } from "@/features/secrets";
import "@/styles/definitionPages.css";

export default function SecretsPage() {
  return (
    <div className="definitions-page">
      <div className="definitions-content">
        <SecretsPageContent />
      </div>
    </div>
  );
}
