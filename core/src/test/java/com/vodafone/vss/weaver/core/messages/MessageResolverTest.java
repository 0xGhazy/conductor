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
package com.vodafone.vss.weaver.core.messages;

import java.util.HashMap;
import java.util.Map;

import org.junit.Before;
import org.junit.Test;

import com.vodafone.vss.weaver.common.metadata.workflow.WorkflowDef;
import com.vodafone.vss.weaver.model.WorkflowModel;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

public class MessageResolverTest {

    private static final Map<String, String> ORDER_CONFIRMED =
            Map.of(
                    "en-US", "Hello ${input.customerName}, order ${variables.orderId} confirmed.",
                    "ar-EG", "مرحبا ${input.customerName}، الطلب ${orderId} مؤكد.");

    private MessageResolver resolver;

    @Before
    public void setUp() {
        MessageCatalog catalog =
                (name, version, code) ->
                        "shop".equals(name) && version == 1 && "ORDER_CONFIRMED".equals(code)
                                ? ORDER_CONFIRMED
                                : Map.of();
        resolver = new MessageResolver(catalog, null, "en-US");
    }

    @Test
    public void explicitLanguageWinsAndTemplateIsFilled() {
        var result = resolver.resolve(workflow("fr", null), "ORDER_CONFIRMED", "ar-EG", Map.of("orderId", "1001"));

        assertEquals("ar-EG", result.languageCode());
        assertEquals("مرحبا Ahmed، الطلب 1001 مؤكد.", result.message());
        assertTrue(result.translated());
    }

    @Test
    public void workflowInputLanguageIsUsedWhenNoneGiven() {
        var result = resolver.resolve(workflow("en-US", null), "ORDER_CONFIRMED", null, Map.of("orderId", "7"));

        assertEquals("en-US", result.languageCode());
        assertEquals("Hello Ahmed, order 7 confirmed.", result.message());
    }

    @Test
    public void unresolvedPlaceholderLanguageIsIgnored() {
        var result = resolver.resolve(workflow("ar-EG", null), "ORDER_CONFIRMED", "${workflow.input.lang}", null);

        assertEquals("ar-EG", result.languageCode());
    }

    @Test
    public void matchingIgnoresCaseAndFallsBackToPrimaryLanguage() {
        assertEquals("ar-EG", resolver.resolve(workflow(null, null), "ORDER_CONFIRMED", "AR-eg", null).languageCode());
        assertEquals("ar-EG", resolver.resolve(workflow(null, null), "ORDER_CONFIRMED", "ar", null).languageCode());
        assertEquals("ar-EG", resolver.resolve(workflow(null, null), "ORDER_CONFIRMED", "ar-SA", null).languageCode());
    }

    @Test
    public void workflowDefaultLanguageIsUsedBeforeSystemDefault() {
        // Requested language has no translation; the workflow's metadata.defaultLanguage decides.
        var result = resolver.resolve(workflow("fr", "ar-EG"), "ORDER_CONFIRMED", null, null);

        assertEquals("ar-EG", result.languageCode());
    }

    @Test
    public void systemDefaultIsUsedWhenNothingElseMatches() {
        var result = resolver.resolve(workflow(null, null), "ORDER_CONFIRMED", null, Map.of("orderId", "1"));

        assertEquals("en-US", result.languageCode());
    }

    @Test
    public void unknownMessageResolvesToItsCode() {
        var result = resolver.resolve(workflow("en-US", null), "NO_SUCH_CODE", null, null);

        assertEquals("NO_SUCH_CODE", result.message());
        assertFalse(result.translated());
    }

    @Test
    public void placeholderTextInValuesIsNotExpandedAgain() {
        var result =
                resolver.resolve(
                        workflow("en-US", null), "ORDER_CONFIRMED", null, Map.of("orderId", "${input.customerName}"));

        assertEquals("Hello Ahmed, order ${input.customerName} confirmed.", result.message());
    }

    private static WorkflowModel workflow(String language, String defaultLanguage) {
        WorkflowDef def = new WorkflowDef();
        def.setName("shop");
        def.setVersion(1);
        if (defaultLanguage != null) {
            def.setMetadata(new HashMap<>(Map.of("defaultLanguage", defaultLanguage)));
        }
        WorkflowModel workflow = new WorkflowModel();
        workflow.setWorkflowDefinition(def);
        Map<String, Object> input = new HashMap<>();
        input.put("customerName", "Ahmed");
        if (language != null) {
            input.put("_language", language);
        }
        workflow.setInput(input);
        return workflow;
    }
}
