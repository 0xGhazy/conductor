import { getUserName, getAvatarUrl } from "./user";

export interface AuditActor {
  name: string;
  avatarUrl?: string;
}

export interface AuditFields {
  createdAt: string;
  createdBy: AuditActor;
  updatedAt: string;
  updatedBy: AuditActor;
}

/**
 * Standardizes audit information (createdAt, createdBy, updatedAt, updatedBy)
 * from any entity or record for view pages.
 */
export const getAuditFields = (
  record: any,
  fallbackCreatedBy = "Unknown creator",
  fallbackUpdatedBy = "Not modified"
): AuditFields => ({
  createdAt: record?.createdAt || record?.createTime || "",
  createdBy: {
    name: getUserName(record?.createdBy || record?.ownerEmail, fallbackCreatedBy),
    avatarUrl: getAvatarUrl(record?.createdBy),
  },
  updatedAt: record?.updatedAt || record?.updateTime || "",
  updatedBy: {
    name: getUserName(record?.updatedBy, fallbackUpdatedBy),
    avatarUrl: getAvatarUrl(record?.updatedBy),
  },
});
