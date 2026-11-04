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

import java.time.Instant;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.vodafone.vss.weaver.common.response.ApiResponse;
import com.vodafone.vss.weaver.common.rule.RuleEvaluatorRequest;
import com.vodafone.vss.weaver.tasks.rule.service.RuleEvaluatorService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

@RestController
@RequestMapping(value = "/api/actions/rule-evaluator", produces = MediaType.APPLICATION_JSON_VALUE)
@Tag(name = "Rule Evaluator API", description = "Evaluate logical rule JSON conditions")
public class RuleEvaluatorResource {

    private static final Logger log = LoggerFactory.getLogger(RuleEvaluatorResource.class);

    private final RuleEvaluatorService ruleEvaluatorService;

    public RuleEvaluatorResource(RuleEvaluatorService ruleEvaluatorService) {
        this.ruleEvaluatorService = ruleEvaluatorService;
    }

    @PostMapping("/eval")
    @Operation(summary = "Evaluate logical rules", description = "Evaluate flat or nested logical rule criteria against inputs")
    public ResponseEntity<ApiResponse> eval(@Valid @RequestBody RuleEvaluatorRequest payload) {
        log.info("Rule evaluation REST request received");
        try {
            Object result =
                    ruleEvaluatorService.evaluateRules(payload.getRules(), payload.getVariables());
            log.info("Rule evaluation request finished successfully: result={}", result);

            ApiResponse response =
                    ApiResponse.builder()
                            .message("Rule evaluation completed successfully")
                            .status(HttpStatus.OK)
                            .data(result)
                            .timestamp(Instant.now())
                            .build();

            return new ResponseEntity<>(response, HttpStatus.OK);
        } catch (Exception ex) {
            log.error("Rule evaluation REST request failed", ex);

            ApiResponse response =
                    ApiResponse.builder()
                            .message("Rule evaluation failed: " + ex.getMessage())
                            .status(HttpStatus.BAD_REQUEST)
                            .timestamp(Instant.now())
                            .build();

            return new ResponseEntity<>(response, HttpStatus.BAD_REQUEST);
        }
    }
}

