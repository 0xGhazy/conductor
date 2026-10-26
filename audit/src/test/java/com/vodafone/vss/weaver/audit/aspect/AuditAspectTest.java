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

import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.Signature;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;

import com.vodafone.vss.weaver.audit.config.AuditProperties;
import com.vodafone.vss.weaver.audit.service.AuditSecurityHelper;
import com.vodafone.vss.weaver.audit.service.AuditSecurityHelper.ActorContext;
import com.vodafone.vss.weaver.common.audit.AuditEvent;
import com.vodafone.vss.weaver.common.metadata.workflow.StartWorkflowRequest;
import com.vodafone.vss.weaver.dao.AuditDAO;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

public class AuditAspectTest {

    private AuditProperties properties;
    private AuditSecurityHelper securityHelper;
    private AuditDAO auditDAO;
    private AuditAspect aspect;

    @BeforeEach
    public void setup() {
        properties = new AuditProperties();
        properties.setEnabled(true);
        properties.setCapturePayloads(true);

        securityHelper = Mockito.mock(AuditSecurityHelper.class);
        when(securityHelper.resolveCurrentActor())
                .thenReturn(
                        ActorContext.builder()
                                .actorId("user-123")
                                .actorUsername("test.operator")
                                .actorName("Test Operator")
                                .actorEmail("operator@example.com")
                                .clientIp("127.0.0.1")
                                .build());

        auditDAO = Mockito.mock(AuditDAO.class);
        aspect = new AuditAspect(properties, securityHelper, auditDAO);
    }

    private static class DummyWorkflowService {
        public String startWorkflow(StartWorkflowRequest request) {
            return "wf-inst-12345";
        }

        public void failingOperation() {
            throw new IllegalStateException("Database unreachable");
        }
    }

    @Test
    public void testAuditSuccessAndArgumentEnrichment() throws Throwable {
        StartWorkflowRequest request = new StartWorkflowRequest();
        request.setName("sample_workflow");
        assertNull(request.getCreatedBy());

        ProceedingJoinPoint pjp = Mockito.mock(ProceedingJoinPoint.class);
        Signature sig = Mockito.mock(Signature.class);
        when(sig.getName()).thenReturn("startWorkflow");
        when(pjp.getSignature()).thenReturn(sig);
        when(pjp.getTarget()).thenReturn(new DummyWorkflowService());
        when(pjp.getArgs()).thenReturn(new Object[] {request});
        when(pjp.proceed()).thenReturn("wf-inst-12345");

        Object result = aspect.interceptAudit(pjp);
        assertEquals("wf-inst-12345", result);

        // Verify request was enriched
        assertEquals("test.operator", request.getCreatedBy());

        // Verify audit event was logged
        ArgumentCaptor<AuditEvent> captor = ArgumentCaptor.forClass(AuditEvent.class);
        verify(auditDAO, times(1)).log(captor.capture());

        AuditEvent event = captor.getValue();
        assertNotNull(event);
        assertEquals("startWorkflow", event.getAction());
        assertEquals("WORKFLOW", event.getResourceType());
        assertEquals("sample_workflow", event.getResourceId());
        assertEquals(AuditEvent.STATUS_SUCCESS, event.getStatus());
        assertEquals("user-123", event.getActorId());
        assertEquals("test.operator", event.getActorUsername());
        assertEquals("Test Operator", event.getActorName());
        assertEquals("operator@example.com", event.getActorEmail());
        assertEquals("127.0.0.1", event.getClientIp());
        assertNotNull(event.getDurationMs());
        assertNull(event.getErrorMessage());
    }

    @Test
    public void testAuditFailureCapturedOnException() throws Throwable {
        ProceedingJoinPoint pjp = Mockito.mock(ProceedingJoinPoint.class);
        Signature sig = Mockito.mock(Signature.class);
        when(sig.getName()).thenReturn("failingOperation");
        when(pjp.getSignature()).thenReturn(sig);
        when(pjp.getTarget()).thenReturn(new DummyWorkflowService());
        when(pjp.getArgs()).thenReturn(new Object[] {"resource-99"});
        when(pjp.proceed()).thenThrow(new IllegalStateException("Database unreachable"));

        assertThrows(IllegalStateException.class, () -> aspect.interceptAudit(pjp));

        ArgumentCaptor<AuditEvent> captor = ArgumentCaptor.forClass(AuditEvent.class);
        verify(auditDAO, times(1)).log(captor.capture());

        AuditEvent event = captor.getValue();
        assertEquals("failingOperation", event.getAction());
        assertEquals(AuditEvent.STATUS_FAILED, event.getStatus());
        assertEquals("Database unreachable", event.getErrorMessage());
        assertEquals("resource-99", event.getResourceId());
    }

    @Test
    public void testAuditDisabledSkipsLogging() throws Throwable {
        properties.setEnabled(false);

        ProceedingJoinPoint pjp = Mockito.mock(ProceedingJoinPoint.class);
        when(pjp.proceed()).thenReturn("skipped");

        Object result = aspect.interceptAudit(pjp);
        assertEquals("skipped", result);
        verify(auditDAO, never()).log(any());
    }
}
