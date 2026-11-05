/*
 * Copyright 2026 Weaver Contributors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package com.vodafone.vss.weaver.common.audit;

import java.time.Instant;
import java.util.List;

import lombok.Builder;
import lombok.Getter;
import lombok.Singular;
import lombok.ToString;

/**
 * Filters for reading the audit log. Null, blank or empty means "any". Categories combine with
 * AND; the values inside one multi-value filter combine with OR.
 */
@Getter
@Builder
@ToString
public class AuditEventQuery {

    /** What the list can be ordered by; every order ends with the event time and id. */
    public enum SortField {
        TIMESTAMP,
        DURATION,
        STATUS,
        ACTOR,
        ACTION,
        RESOURCE_TYPE
    }

    /**
     * Free text: part of the action, actor (username, name, email), resource name or error;
     * the start of a resource id; or an exact event id or client IP. Case-insensitive.
     */
    private final String search;

    /** Any of these resource types, e.g. WORKFLOW. */
    @Singular
    private final List<String> resourceTypes;

    /** Any of these statuses: SUCCESS, FAILED. */
    @Singular
    private final List<String> statuses;

    /** Any of these actions, e.g. updateQuery. */
    @Singular
    private final List<String> actions;

    /** Exact actor (Keycloak user id). */
    private final String actorId;

    /** Part of the actor's username, name or email. */
    private final String actor;

    /** Exact resource id; usually combined with a resource type. */
    private final String resourceId;

    /** Exact event id. */
    private final String eventId;

    /** Exact client IP. */
    private final String clientIp;

    /** Only events that took at least this long. */
    private final Long minDurationMs;

    /** Only events that took at most this long. */
    private final Long maxDurationMs;

    /** Only events at or after this time. */
    private final Instant from;

    /** Only events before this time. */
    private final Instant to;

    /** Defaults to the event time. */
    @Builder.Default
    private final SortField sort = SortField.TIMESTAMP;

    /** Defaults to newest (largest) first. */
    @Builder.Default
    private final boolean ascending = false;
}
