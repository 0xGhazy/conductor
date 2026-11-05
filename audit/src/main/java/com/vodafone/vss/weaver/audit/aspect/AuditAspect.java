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

import java.lang.reflect.Method;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Pointcut;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.AnnotationUtils;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import com.vodafone.vss.weaver.annotations.Audit;
import com.vodafone.vss.weaver.annotations.AuditContext;
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

        Audit audit = findAnnotation(joinPoint);
        String action = audit != null && !audit.action().isBlank()
                ? audit.action()
                : joinPoint.getSignature().getName();
        String resourceType = audit != null && !audit.resourceType().isBlank()
                ? audit.resourceType()
                : determineResourceType(joinPoint.getTarget().getClass().getSimpleName());
        String initialResourceId = extractResourceId(joinPoint.getArgs());

        boolean captureArguments = audit == null || audit.captureArguments();

        long startTime = System.currentTimeMillis();
        Object result = null;
        AuditContext.open();
        boolean contextOpen = true;
        try {
            result = joinPoint.proceed();
            Map<String, Object> ownDetails = AuditContext.close();
            contextOpen = false;
            long durationMs = System.currentTimeMillis() - startTime;

            String finalResourceId = initialResourceId;
            if (finalResourceId == null || finalResourceId.isBlank()) {
                // e.g. a create: the id exists only once the record is saved.
                finalResourceId = resourceIdOf(result);
            }

            recordAuditEvent(
                    actor,
                    action,
                    resourceType,
                    finalResourceId,
                    AuditEvent.STATUS_SUCCESS,
                    durationMs,
                    null,
                    detailsFor(ownDetails, captureArguments, joinPoint.getArgs()));

            return result;
        } catch (Throwable th) {
            long durationMs = System.currentTimeMillis() - startTime;
            // What the method recorded before failing (e.g. the name it was given).
            Map<String, Object> ownDetails = contextOpen ? AuditContext.close() : Map.of();
            contextOpen = false;
            recordAuditEvent(
                    actor,
                    action,
                    resourceType,
                    initialResourceId,
                    AuditEvent.STATUS_FAILED,
                    durationMs,
                    th.getMessage(),
                    detailsFor(ownDetails, captureArguments, joinPoint.getArgs()));
            throw th;
        } finally {
            if (contextOpen) {
                AuditContext.close();
            }
        }
    }

    /**
     * Event details: what the method recorded itself (AuditContext), else its arguments when
     * payload capture is on and the method allows it.
     */
    Map<String, Object> detailsFor(Map<String, Object> ownDetails, boolean captureArguments, Object[] args) {
        if (ownDetails != null && !ownDetails.isEmpty()) {
            return ownDetails;
        }
        if (!captureArguments || !properties.isCapturePayloads() || args == null || args.length == 0) {
            return null;
        }
        Map<String, Object> details = new HashMap<>();
        for (int i = 0; i < args.length; i++) {
            if (args[i] != null) {
                details.put("arg" + i, args[i].toString());
            }
        }
        return details;
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
            Map<String, Object> details) {
        if (auditDAO == null) {
            return;
        }
        try {

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
            } else if (arg instanceof UUID uuid) {
                return uuid.toString();
            } else if (arg instanceof StartWorkflowRequest swr) {
                return swr.getName();
            }
        }
        return null;
    }

    /** The id of what a call returned: a String, or a public no-argument getId(). */
    static String resourceIdOf(Object result) {
        if (result == null) {
            return null;
        }
        if (result instanceof String str) {
            return str.isBlank() ? null : str;
        }
        try {
            Method getId = result.getClass().getMethod("getId");
            if (getId.getParameterCount() == 0) {
                Object id = getId.invoke(result);
                return id != null ? String.valueOf(id) : null;
            }
        } catch (ReflectiveOperationException | RuntimeException e) {
            // no usable id
        }
        return null;
    }

    /** @Audit on the called method, else on its class; null when the signature hides the method. */
    private static Audit findAnnotation(ProceedingJoinPoint joinPoint) {
        if (joinPoint.getSignature() instanceof MethodSignature signature && signature.getMethod() != null) {
            Method method = signature.getMethod();
            Object target = joinPoint.getTarget();
            if (target != null) {
                try {
                    // The method on the actual class carries the annotation (not an interface method).
                    method = target.getClass().getMethod(method.getName(), method.getParameterTypes());
                } catch (NoSuchMethodException e) {
                    // keep the signature's method
                }
            }
            Audit onMethod = AnnotationUtils.findAnnotation(method, Audit.class);
            if (onMethod != null) {
                return onMethod;
            }
        }
        Object target = joinPoint.getTarget();
        return target != null ? AnnotationUtils.findAnnotation(target.getClass(), Audit.class) : null;
    }
}
