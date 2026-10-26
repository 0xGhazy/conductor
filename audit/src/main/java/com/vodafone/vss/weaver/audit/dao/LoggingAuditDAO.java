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
package com.vodafone.vss.weaver.audit.dao;

import java.util.Collections;
import java.util.List;

import com.vodafone.vss.weaver.common.audit.AuditEvent;
import com.vodafone.vss.weaver.dao.AuditDAO;

import lombok.extern.slf4j.Slf4j;

/**
 * Fallback AuditDAO implementation that outputs structured logs via SLF4J.
 */
@Slf4j
public class LoggingAuditDAO implements AuditDAO {

    @Override
    public void log(AuditEvent event) {
        if (event == null) {
            return;
        }
        log.info(
                "AUDIT | action={} | resourceType={} | resourceId={} | status={} | actor={} ({}) | duration={}ms | error={}",
                event.getAction(),
                event.getResourceType(),
                event.getResourceId(),
                event.getStatus(),
                event.getActorUsername(),
                event.getActorId(),
                event.getDurationMs(),
                event.getErrorMessage());
    }

    @Override
    public List<AuditEvent> getAuditEvents(String resourceId, String resourceType, int limit) {
        log.debug("Querying audit events from logging DAO is not supported.");
        return Collections.emptyList();
    }
}
