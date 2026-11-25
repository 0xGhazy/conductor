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
package com.vodafone.vss.weaver.tasks.http.service;

import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import com.vodafone.vss.weaver.common.http.HttpRequest;
import com.vodafone.vss.weaver.common.http.HttpResponse;
import com.vodafone.vss.weaver.tasks.http.security.AuthStrategy;

import com.fasterxml.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

@ExtendWith(MockitoExtension.class)
class HttpExecutorServiceTest {

    @Mock
    private HttpConnectionService httpConnectionService;

    @Mock
    private AuthStrategy authStrategy;

    private ObjectMapper objectMapper;
    private MockRestServiceServer mockServer;
    private HttpExecutorService executorService;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        RestClient.Builder restClientBuilder = RestClient.builder();
        mockServer = MockRestServiceServer.bindTo(restClientBuilder).build();
        RestClient restClient = restClientBuilder.build();
        executorService = new HttpExecutorService(objectMapper, httpConnectionService, restClient);
    }

    @Test
    void execute_successful_get_request_parses_json_response() {
        mockServer.expect(requestTo("https://api.example.com/items"))
                .andExpect(method(HttpMethod.GET))
                .andExpect(header(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE))
                .andRespond(withSuccess("{\"id\": 10, \"name\": \"Item1\"}", MediaType.APPLICATION_JSON));

        HttpRequest request = HttpRequest.builder()
                .url("https://api.example.com/items")
                .method("GET")
                .build();

        HttpResponse response = executorService.execute(request);

        mockServer.verify();
        assertEquals(HttpStatus.OK, response.status());
        assertEquals(200, response.statusCode());
        assertNotNull(response.response());
        assertTrue(response.response().toString().contains("Item1"));
    }

    @Test
    void execute_applies_auth_connection() {
        when(httpConnectionService.getConnection("my-conn")).thenReturn(authStrategy);
        doAnswer(inv -> {
            HttpHeaders headers = inv.getArgument(0);
            headers.setBearerAuth("test-token");
            return null;
        }).when(authStrategy).apply(any());

        mockServer.expect(requestTo("https://api.example.com/secure"))
                .andExpect(method(HttpMethod.GET))
                .andExpect(header(HttpHeaders.AUTHORIZATION, "Bearer test-token"))
                .andRespond(withSuccess("{\"authenticated\": true}", MediaType.APPLICATION_JSON));

        HttpRequest request = HttpRequest.builder()
                .url("https://api.example.com/secure")
                .method("GET")
                .connection("my-conn")
                .build();

        HttpResponse response = executorService.execute(request);

        mockServer.verify();
        assertEquals(200, response.statusCode());
        verify(authStrategy).apply(any());
    }

    @Test
    void execute_handles_404_not_found_without_throwing() {
        mockServer.expect(requestTo("https://api.example.com/missing"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withResourceNotFound().body("{\"error\": \"not found\"}").contentType(MediaType.APPLICATION_JSON));

        HttpRequest request = HttpRequest.builder()
                .url("https://api.example.com/missing")
                .method("GET")
                .build();

        HttpResponse response = executorService.execute(request);

        mockServer.verify();
        assertEquals(HttpStatus.NOT_FOUND, response.status());
        assertEquals(404, response.statusCode());
        assertNotNull(response.response());
    }

    @Test
    void execute_handles_500_server_error_without_throwing() {
        mockServer.expect(requestTo("https://api.example.com/fail"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withServerError().body("Internal crash").contentType(MediaType.TEXT_PLAIN));

        HttpRequest request = HttpRequest.builder()
                .url("https://api.example.com/fail")
                .method("POST")
                .body(Map.of("data", 123))
                .build();

        HttpResponse response = executorService.execute(request);

        mockServer.verify();
        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.status());
        assertEquals(500, response.statusCode());
        assertEquals("Internal crash", response.response());
    }

    @Test
    void parseBody_handles_empty_and_plain_text() {
        Object empty = executorService.parseBody(new byte[0], new HttpHeaders());
        assertEquals(Map.of(), empty);

        HttpHeaders plainTextHeaders = new HttpHeaders();
        plainTextHeaders.setContentType(MediaType.TEXT_PLAIN);
        Object text = executorService.parseBody("Hello World".getBytes(), plainTextHeaders);
        assertEquals("Hello World", text);
    }
}
