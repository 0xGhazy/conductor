package com.vodafone.vss.weaver.common.secrets;

import java.util.Collection;
import java.util.Map;

import com.vodafone.vss.weaver.common.exceptions.BusinessException;

/**
 * Business exception for secrets.
 */
public class SecretException extends BusinessException {

    private SecretException(
            SecretErrorCode code,
            String message,
            String reason,
            boolean retryable,
            Map<String, Object> details) {
        super(message, reason, code.name(), code.getStatus(), retryable, false, null, null, details);
    }

    public SecretErrorCode getErrorCode() {
        return SecretErrorCode.valueOf(getCode());
    }

    public static SecretException notFound(Object idOrName) {
        return new SecretException(
                SecretErrorCode.SECRET_NOT_FOUND,
                "Secret not found",
                "Secret " + idOrName + " does not exist",
                false,
                Map.of());
    }

    public static SecretException alreadyExists(String name) {
        return new SecretException(
                SecretErrorCode.SECRET_ALREADY_EXISTS,
                "Secret creation failed",
                "A secret named '" + name + "' already exists",
                false,
                Map.of("field", "name"));
    }

    public static SecretException inUse(String name, Collection<SecretUsage> usages) {
        return new SecretException(
                SecretErrorCode.SECRET_IN_USE,
                "Secret deletion failed",
                "Secret '"
                        + name
                        + "' is referenced by "
                        + usages.size()
                        + " connection(s). Remove the references first",
                false,
                Map.of("usages", usages));
    }

    public static SecretException unknownReferences(Collection<String> names) {
        return new SecretException(
                SecretErrorCode.UNKNOWN_SECRET_REFERENCE,
                "Unknown secret reference",
                "The following secrets do not exist: " + String.join(", ", names),
                false,
                Map.of("missing", names));
    }

    public static SecretException invalidReference(String field, String reason) {
        return new SecretException(
                SecretErrorCode.INVALID_SECRET_REFERENCE,
                "Invalid secret reference",
                reason,
                false,
                Map.of("field", field));
    }

    public static SecretException optimisticLock() {
        return new SecretException(
                SecretErrorCode.OPTIMISTIC_LOCK_CONFLICT,
                "Secret update failed",
                "The secret was modified by another request. Please refresh and try again.",
                true,
                Map.of());
    }
}

