/** Mirrors the backend secrets DTOs (/api/secrets). The plaintext value is never part of a response. */

export interface SecretUser {
  id?: string;
  name?: string | null;
  email?: string | null;
}

export interface Secret {
  id: string;
  name: string;
  /** Masked preview, e.g. "ha**********dh"; fully starred when the value is shorter than 10 chars. */
  displayedText: string;
  description?: string | null;
  /** Reference to paste into connections, e.g. "${weaver.secrets.db_pwd}". */
  placeholder: string;
  /** Number of connections referencing the secret; only returned by GET /{id}. */
  usageCount?: number | null;
  version: number;
  createdAt?: string | null;
  updatedAt?: string | null;
  createdBy?: SecretUser | null;
  updatedBy?: SecretUser | null;
}

export type SecretMinimal = Pick<Secret, "id" | "name" | "displayedText" | "placeholder">;

export type SecretUsageType = "DATASOURCE" | "HTTP_CONNECTION";

export interface SecretUsage {
  type: SecretUsageType;
  id: string;
  name: string;
}

export interface SecretCreatePayload {
  name: string;
  value: string;
  description?: string;
}

export interface SecretUpdatePayload {
  /** Omit to keep the current value. */
  value?: string;
  /** Omit to keep, empty string to clear. */
  description?: string;
  version?: number;
}

export interface SecretFormState {
  name: string;
  value: string;
  description: string;
}
