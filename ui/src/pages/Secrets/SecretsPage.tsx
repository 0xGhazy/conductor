import { SecretsPageContent } from "@/features/secrets";
import { useEffect } from "react";
import "@/styles/definitionPages.css";

export default function SecretsPage() {
  useEffect(() => {
    document.title = "Secrets";
  }, []);

  return (
    <div className="definitions-page">
      <div className="definitions-content">
        <SecretsPageContent />
      </div>
    </div>
  );
}
