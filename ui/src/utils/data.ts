/**
 * Safely extracts an array list from various backend API response formats.
 * Handles patterns like:
 * - body.data.items
 * - body.data.content
 * - body.data.records
 * - body.items
 * - body.content
 * - body.records
 * - body.data (when array)
 * - body (when raw array)
 */
export const extractList = <T = any>(body: any): T[] => {
  const candidates = [
    body?.data?.items,
    body?.data?.content,
    body?.data?.records,
    body?.items,
    body?.content,
    body?.records,
    body?.data,
    body,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate as T[];
  }
  return [];
};

/**
 * Safely extracts total item count from various backend API response formats.
 */
export const extractTotal = (body: any, fallback: number = 0): number => {
  const total =
    body?.totalElements ??
    body?.totalItems ??
    body?.data?.totalElements ??
    body?.data?.totalItems ??
    body?.details?.totalElements ??
    body?.data?.details?.totalElements ??
    body?.details?.totalItems ??
    fallback;
  return Number(total) || 0;
};

/**
 * Standard page size options for tables and data explorers across modules.
 */
export const PAGE_SIZE_OPTIONS = [10, 20, 25, 50, 100];

/**
 * Client-side file download helper.
 */
export const downloadFile = (
  filename: string,
  content: string,
  type: string = "application/json"
) => {
  const blob = new Blob([content], { type });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(href), 1000);
};
