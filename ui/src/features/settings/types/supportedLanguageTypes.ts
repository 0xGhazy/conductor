export interface SupportedLanguage {
  id: string;
  code: string;
  name: string;
  nativeName?: string;
  rtl: boolean;
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SupportedLanguagePayload {
  code: string;
  name: string;
  nativeName?: string;
  rtl: boolean;
  isDefault: boolean;
}
