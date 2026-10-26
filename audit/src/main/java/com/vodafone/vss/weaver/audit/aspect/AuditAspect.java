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
package com.vodafone.vss.weaver.audit.aspect;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Pointcut;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import com.vodafone.vss.weaver.audit.config.AuditProperties;
import com.vodafone.vss.weaver.audit.service.AuditSecurityHelper;
import com.vodafone.vss.weaver.audit.service.AuditSecurityHelper.ActorContext;
import com.vodafone.vss.weaver.common.audit.AuditEvent;
import com.vodafone.vss.weaver.common.metadata.Auditable;
import com.vodafone.vss.weaver.common.metadata.workflow.StartWorkflowRequest;
import com.vodafone.vss.weaver.dao.AuditDAO;

import lombok.extern.slf4j.Slf4j;

/**
 * Aspect intercepting services and methods annotated with @Audit to record audit events
 * and enrich caller context (createdBy, updatedBy).
 */
@Slf4j
@Aspect
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class AuditAspect {

    private final AuditProperties properties;
    private final AuditSecurityHelper securityHelper;
    private final AuditDAO auditDAO;

    @Autowired
    public AuditAspect(
            AuditProperties properties,
            AuditSecurityHelper securityHelper,
            @Autowired(required = false) AuditDAO auditDAO) {
        this.properties = properties;
        this.securityHelper = securityHelper;
        this.auditDAO = auditDAO;
    }

    @Pointcut(
            "@within(com.vodafone.vss.weaver.annotations.Audit) || "
                    + "@annotation(com.vodafone.vss.weaver.annotations.Audit)")
    public void auditPointcut() {}

    @Around("auditPointcut()")
    public Object interceptAudit(ProceedingJoinPoint joinPoint) throws Throwable {
        if (properties == null || !properties.isEnabled()) {
            return joinPoint.proceed();
        }

        ActorContext actor = securityHelper.resolveCurrentActor();
        enrichArguments(joinPoint.getArgs(), actor);

        String action = joinPoint.getSignature().getName();
        String resourceType = determineResourceType(joinPoint.getTarget().getClass().getSimpleName());
        String initialResourceId = extractResourceId(joinPoint.getArgs());

        long startTime = System.currentTimeMillis();
        Object result = null;
        try {
            result = joinPoint.proceed();
            long durationMs = System.currentTimeMillis() - startTime;

            String finalResourceId = initialResourceId;
            if ((finalResourceId == null || finalResourceId.isBlank()) && result instanceof String strRes) {
                finalResourceId = strRes;
            }

            recordAuditEvent(
                    actor,
                    action,
                    resourceType,
                    finalResourceId,
                    AuditEvent.STATUS_SUCCESS,
                    durationMs,
                    null,
                    joinPoint.getArgs());

            return result;
        } catch (Throwable th) {
            long durationMs = System.currentTimeMillis() - startTime;
            recordAuditEvent(
                    actor,
                    action,
                    resourceType,
                    initialResourceId,
                    AuditEvent.STATUS_FAILED,
                    durationMs,
                    th.getMessage(),
                    joinPoint.getArgs());
            throw th;
        }
    }

    /**
     * Enriches mutable request and auditable objects with current actor identity.
     */
    private void enrichArguments(Object[] args, ActorContext actor) {
        if (args == null || actor == null) {
            return;
        }
        String creator = actor.getActorUsername();
        if (creator == null || creator.isBlank()) {
            return;
        }

        for (Object arg : args) {
            if (arg instanceof StartWorkflowRequest swr) {
                if (swr.getCreatedBy() == null || swr.getCreatedBy().isBlank()) {
                    swr.setCreatedBy(creator);
                }
            } else if (arg instanceof Auditable auditable) {
                if (auditable.getCreatedBy() == null || auditable.getCreatedBy().isBlank()) {
                    auditable.setCreatedBy(creator);
                }
                auditable.setUpdatedBy(creator);
            }
        }
    }

    private void recordAuditEvent(
            ActorContext actor,
            String action,
            String resourceType,
            String resourceId,
            String status,
            long durationMs,
            String errorMessage,
            Object[] args) {
        if (auditDAO == null) {
            return;
        }
        try {
            Map<String, Object> details = null;
            if (properties.isCapturePayloads() && args != null && args.length > 0) {
                details = new HashMap<>();
                for (int i = 0; i < args.length; i++) {
                    Object arg = args[i];
                    if (arg != null) {
                        details.put("arg" + i, arg.toString());
                    }
                }
            }

            AuditEvent event =
                    AuditEvent.builder()
                            .id(UUID.randomUUID().toString())
                            .timestamp(System.currentTimeMillis())
                            .actorId(actor.getActorId())
                            .actorUsername(actor.getActorUsername())
                            .actorName(actor.getActorName())
                            .actorEmail(actor.getActorEmail())
                            .action(action)
                            .resourceType(resourceType)
                            .resourceId(resourceId != null ? resourceId : "unknown")
                            .status(status)
                            .durationMs(durationMs)
                            .errorMessage(errorMessage)
                            .details(details)
                            .clientIp(actor.getClientIp())
                            .build();

            auditDAO.log(event);
        } catch (Exception ex) {
            log.warn("Failed to record audit event for action '{}': {}", action, ex.getMessage());
        }
    }

    private String determineResourceType(String className) {
        if (className.contains("Workflow")) {
            return "WORKFLOW";
        } else if (className.contains("Task")) {
            return "TASK";
        } else if (className.contains("Admin")) {
            return "ADMIN";
        } else if (className.contains("Metadata")) {
            return "METADATA";
        } else if (className.contains("Schedule") || className.contains("Scheduler")) {
            return "SCHEDULE";
        }
        return className;
    }

    private String extractResourceId(Object[] args) {
        if (args == null || args.length == 0) {
            return null;
        }
        for (Object arg : args) {
            if (arg instanceof String str && !str.isBlank()) {
                return str;
            } else if (arg instanceof StartWorkflowRequest swr) {
                return swr.getName();
            }
        }
        return null;
    }
}
