import { useParams } from "react-router-dom";
import { SecretViewContent } from "@/features/secrets";
import "@/styles/definitionPages.css";

export default function SecretViewPage({ isCreateMode = false }: { isCreateMode?: boolean }) {
  const { id } = useParams();
  // Keyed by id so switching between secrets starts from a fresh form.
  return <SecretViewContent key={isCreateMode ? "new" : id} id={id} isCreateMode={isCreateMode} />;
}
