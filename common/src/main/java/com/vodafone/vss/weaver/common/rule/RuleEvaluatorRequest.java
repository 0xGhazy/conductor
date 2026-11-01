package com.vodafone.vss.weaver.common.rule;

import java.util.Map;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RuleEvaluatorRequest {

    @NotNull(message = "Rules is required")
    private Object rules;

    @NotNull(message = "Variables is required")
    private Map<String, Object> variables;
}

