/*
 * Copyright 2026 Weaver Contributors.
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
package com.vodafone.vss.weaver.core.placeholders;

import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.conductoross.conductor.dao.SecretsDAO;
import org.junit.Before;
import org.junit.Test;

import com.vodafone.vss.weaver.dao.EnvironmentDAO;
import com.vodafone.vss.weaver.model.TaskModel;
import com.vodafone.vss.weaver.model.WorkflowModel;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertSame;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

public class WeaverPlaceholderResolverTest {

    private EnvironmentDAO env;
    private SecretsDAO secrets;
    private WeaverPlaceholderResolver resolver;

    @Before
    public void setUp() {
        env = mock(EnvironmentDAO.class);
        secrets = mock(SecretsDAO.class);
        resolver = new WeaverPlaceholderResolver(env, secrets, Duration.ofMinutes(30));
    }

    @Test
    public void secretsAreCachedUntilInvalidated() {
        when(secrets.getSecret("TOKEN")).thenReturn("v1", "v2");

        assertEquals("v1", resolver.getSecret("TOKEN"));
        assertEquals("v1", resolver.getSecret("TOKEN"));
        verify(secrets, times(1)).getSecret("TOKEN");

        resolver.invalidateSecret("TOKEN");
        assertEquals("v2", resolver.getSecret("TOKEN"));
        verify(secrets, times(2)).getSecret("TOKEN");
    }

    @Test
    public void missingSecretsAreNotCached() {
        when(secrets.getSecret("NEW")).thenReturn(null, "created");

        assertNull(resolver.getSecret("NEW"));
        assertEquals("created", resolver.getSecret("NEW"));
    }

    @Test
    public void zeroTtlDisablesTheCache() {
        WeaverPlaceholderResolver uncached = new WeaverPlaceholderResolver(env, secrets, Duration.ZERO);
        when(secrets.getSecret("TOKEN")).thenReturn("v1");

        uncached.getSecret("TOKEN");
        uncached.getSecret("TOKEN");
        verify(secrets, times(2)).getSecret("TOKEN");
    }

    @Test
    public void resolveEnvRejectsInvalidNames() {
        assertEquals("d", resolver.resolveEnv("not-valid:d"));
        assertNull(resolver.resolveEnv("not-valid"));
    }

    @Test
    public void resolveConfigResolvesEnvAndSecrets() {
        when(env.getEnvVariable("DB_HOST")).thenReturn("db.internal");
        when(secrets.getSecret("DB_PASS")).thenReturn("p@ss");

        assertEquals(
                "jdbc:postgresql://db.internal:5432/app?password=p@ss",
                resolver.resolveConfig(
                        "jdbc:postgresql://${weaver.env.DB_HOST}:5432/app?password=${weaver.secrets.DB_PASS}"));
        assertEquals("localhost", resolver.resolveConfig("${weaver.env.MISSING:localhost}"));
        assertEquals("", resolver.resolveConfig("${weaver.env.MISSING}"));
        assertEquals("keep ${weaver.env.DB_HOST}", resolver.resolveConfig("keep $${weaver.env.DB_HOST}"));
    }

    @Test
    public void resolveConfigDeepResolvesNestedValues() {
        when(secrets.getSecret("TOKEN")).thenReturn("tkn");
        Map<String, Object> config = Map.of("auth", Map.of("token", "${weaver.secrets.TOKEN}"), "list", List.of("a"));

        assertEquals(
                Map.of("auth", Map.of("token", "tkn"), "list", List.of("a")),
                resolver.resolveConfigDeep(config));
    }

    @Test
    public void resolveEnvOnlyNeverExpandsSecrets() {
        when(env.getEnvVariable("SUPPORT")).thenReturn("+20 100");
        when(secrets.getSecret("TOKEN")).thenReturn("tkn");

        assertEquals(
                "Call +20 100 ${weaver.secrets.TOKEN}",
                resolver.resolveEnvOnly("Call ${weaver.env.SUPPORT} ${weaver.secrets.TOKEN}"));
    }

    @Test
    public void escapeSecretReferencesKeepsSameInstanceWhenNothingToEscape() {
        Map<String, Object> data = Map.of("a", "plain", "b", List.of("x"));
        assertSame(data, WeaverPlaceholderResolver.escapeSecretReferences(data));
        assertEquals(
                "$${weaver.secrets.X} and $${weaver.secrets.Y}",
                WeaverPlaceholderResolver.escapeSecretReferences("${weaver.secrets.X} and $${weaver.secrets.Y}"));
    }

    @Test
    public void referencedSecretValuesIgnoresEscapedReferences() {
        when(secrets.getSecret("A")).thenReturn("value-a");
        when(secrets.getSecret("B")).thenReturn("value-b");

        Map<String, Object> literal =
                Map.of("x", "${weaver.secrets.A}", "y", List.of("$${weaver.secrets.B}"));

        assertEquals(Set.of("value-a"), resolver.referencedSecretValues(literal));
    }

    @Test
    public void maskTaskMasksOutputAndReasonLongestValueFirst() {
        TaskModel task = new TaskModel();
        Map<String, Object> output = new HashMap<>();
        output.put("body", "token=abcd1234 and prefix abcd");
        output.put("nested", Map.of("list", List.of("abcd1234")));
        output.put("number", 42);
        task.setOutputData(output);
        task.setReasonForIncompletion("call failed for abcd1234");

        resolver.maskTask(task, Set.of("abcd", "abcd1234"));

        assertEquals("token=****** and prefix ******", task.getOutputData().get("body"));
        assertEquals(Map.of("list", List.of("******")), task.getOutputData().get("nested"));
        assertEquals(42, task.getOutputData().get("number"));
        assertEquals("call failed for ******", task.getReasonForIncompletion());
    }

    @Test
    public void valuesShorterThanMinimumAreNotMasked() {
        TaskModel task = new TaskModel();
        Map<String, Object> output = new HashMap<>();
        output.put("v", "version 1.2.3");
        task.setOutputData(output);

        resolver.maskTask(task, Set.of("1"));

        assertEquals("version 1.2.3", task.getOutputData().get("v"));
    }

    @Test
    public void maskVariablesMasksWorkflowVariables() {
        WorkflowModel workflow = new WorkflowModel();
        Map<String, Object> variables = new HashMap<>();
        variables.put("auth", "Bearer s3cr3t-token");
        workflow.setVariables(variables);

        resolver.maskVariables(workflow, Set.of("s3cr3t-token"));

        assertEquals("Bearer ******", workflow.getVariables().get("auth"));
    }
}
