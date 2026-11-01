package com.vodafone.vss.weaver.common.secrets;

import org.springframework.http.HttpStatus;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum SecretErrorCode {
    SECRET_NOT_FOUND(HttpStatus.NOT_FOUND),
    SECRET_ALREADY_EXISTS(HttpStatus.CONFLICT),
    SECRET_IN_USE(HttpStatus.CONFLICT),
    UNKNOWN_SECRET_REFERENCE(HttpStatus.BAD_REQUEST),
    INVALID_SECRET_REFERENCE(HttpStatus.BAD_REQUEST),
    OPTIMISTIC_LOCK_CONFLICT(HttpStatus.CONFLICT);

    private final HttpStatus status;
}

