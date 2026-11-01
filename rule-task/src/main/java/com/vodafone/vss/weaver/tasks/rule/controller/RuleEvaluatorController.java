package com.vodafone.vss.weaver.tasks.rule.controller;

import java.time.Instant;

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
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;

@Log4j2
@RestController
@RequestMapping(value = "/api/actions/rule-evaluator", produces = MediaType.APPLICATION_JSON_VALUE)
@Tag(name = "Rule Evaluator API", description = "Evaluate logical rule JSON conditions")
@RequiredArgsConstructor
public class RuleEvaluatorController {

    private final RuleEvaluatorService ruleEvaluatorService;

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

