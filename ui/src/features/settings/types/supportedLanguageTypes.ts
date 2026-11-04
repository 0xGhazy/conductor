export interface SupportedLanguage {
  id: string;
  code: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SupportedLanguagePayload {
  code: string;
  name: string;
}
