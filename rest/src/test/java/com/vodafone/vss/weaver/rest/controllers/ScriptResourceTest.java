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
package com.vodafone.vss.weaver.rest.controllers;

import java.util.UUID;

import org.junit.Before;
import org.junit.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import com.vodafone.vss.weaver.common.response.ApiResponse;
import com.vodafone.vss.weaver.common.scripting.Languages;
import com.vodafone.vss.weaver.common.scripting.ScriptDefinitionRequest;
import com.vodafone.vss.weaver.common.scripting.ScriptDefinitionResponse;
import com.vodafone.vss.weaver.common.scripting.ScriptEngineTaskDto;
import com.vodafone.vss.weaver.common.scripting.ScriptEngineTaskResult;
import com.vodafone.vss.weaver.tasks.scripting.service.ScriptExecutorService;
import com.vodafone.vss.weaver.tasks.scripting.service.ScriptService;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

public class ScriptResourceTest {

    private ScriptExecutorService executorService;
    private ScriptService scriptService;
    private ScriptResource resource;

    @Before
    public void setUp() {
        executorService = mock(ScriptExecutorService.class);
        scriptService = mock(ScriptService.class);
        resource = new ScriptResource(executorService, scriptService, null);
    }

    @Test
    public void testExecuteScript() {
        ScriptEngineTaskDto dto = ScriptEngineTaskDto.builder()
                .language(Languages.JEXL)
                .script("1 + 1")
                .build();
        ScriptEngineTaskResult expected = ScriptEngineTaskResult.builder()
                .status("COMPLETED")
                .output(2)
                .build();

        when(executorService.executeScript(dto)).thenReturn(expected);

        ResponseEntity<ScriptEngineTaskResult> response = resource.executeScript(dto);

        assertNotNull(response);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(expected, response.getBody());
        verify(executorService).executeScript(dto);
    }

    @Test
    public void testFetchScriptById() {
        UUID id = UUID.randomUUID();
        ScriptDefinitionResponse scriptDef = ScriptDefinitionResponse.builder()
                .id(id)
                .name("testScript")
                .description("description")
                .language(Languages.JEXL)
                .script("1+1")
                .timeout(3000)
                .build();

        when(scriptService.findById(id)).thenReturn(scriptDef);

        ResponseEntity<ApiResponse> response = resource.fetchScriptById(id);

        assertNotNull(response);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(scriptService).findById(id);
    }
}
