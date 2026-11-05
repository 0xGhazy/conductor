/*
 * Copyright 2026 Conductor Authors.
 * <p>
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * <p>
 * http://www.apache.org/licenses/LICENSE-2.0
 * <p>
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
 * an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 */
package com.vodafone.vss.weaver.dao;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import com.vodafone.vss.weaver.common.audit.AuditEvent;
import com.vodafone.vss.weaver.common.audit.AuditEventQuery;
import com.vodafone.vss.weaver.common.audit.AuditHistogramBucket;

/**
 * Data Access Object for persisting and querying audit events.
 */
public interface AuditDAO {

    /**
     * Persists an audit event record.
     *
     * @param event The audit event to log
     */
    void log(AuditEvent event);

    /**
     * Retrieves audit events for a specific resource, ordered by timestamp descending.
     *
     * @param resourceId Target resource identifier (e.g. workflowId, taskDefName)
     * @param resourceType Target resource type (e.g. WORKFLOW, TASK, METADATA)
     * @param limit Maximum number of records to return
     * @return List of matching audit events
     */
    List<AuditEvent> getAuditEvents(String resourceId, String resourceType, int limit);

    /** Whether events can be read back (false for log-only storage). */
    default boolean supportsQueries() {
        return false;
    }

    /** One page of events matching the query, newest first, without their details. */
    default List<AuditEvent> searchAuditEvents(AuditEventQuery query, int offset, int limit) {
        return List.of();
    }

    /** Number of events matching the query. */
    default long countAuditEvents(AuditEventQuery query) {
        return 0;
    }

    /** One event, with its details. */
    default Optional<AuditEvent> getAuditEvent(String id) {
        return Optional.empty();
    }

    /**
     * Matching events per time bucket, oldest first; only buckets holding events are returned.
     *
     * @param query filters; its from/to bound the buckets
     * @param origin start of the first bucket, epoch milliseconds
     * @param bucketMs bucket width in milliseconds
     */
    default List<AuditHistogramBucket> getAuditHistogram(AuditEventQuery query, long origin, long bucketMs) {
        return List.of();
    }

    /** Values seen in the log, for filters: resource types, statuses and actions. */
    default Map<String, List<String>> getAuditFacets() {
        return Map.of("resourceTypes", List.of(), "statuses", List.of(), "actions", List.of());
    }
}
