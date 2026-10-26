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

import com.vodafone.vss.weaver.common.audit.AuditEvent;

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
}
