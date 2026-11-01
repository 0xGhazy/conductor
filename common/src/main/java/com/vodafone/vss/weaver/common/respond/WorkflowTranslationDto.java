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
package com.vodafone.vss.weaver.common.respond;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkflowTranslationDto {

    private UUID id;

    @NotBlank(message = "Workflow name is required")
    private String workflowName;

    @NotNull(message = "Workflow version is required")
    @Min(value = 1, message = "Workflow version must be >= 1")
    private Integer workflowVersion;

    @NotBlank(message = "Message code is required")
    private String messageCode;

    @NotEmpty(message = "Translations map cannot be empty")
    private Map<String, String> translations;

    private Instant createdAt;
    private Instant updatedAt;

    public static WorkflowTranslationDto fromModel(WorkflowTranslationModel model) {
        if (model == null) {
            return null;
        }
        return WorkflowTranslationDto.builder()
                .id(model.getId())
                .workflowName(model.getWorkflowName())
                .workflowVersion(model.getWorkflowVersion())
                .messageCode(model.getMessageCode())
                .translations(model.getTranslations())
                .createdAt(model.getCreatedAt())
                .updatedAt(model.getUpdatedAt())
                .build();
    }

    public WorkflowTranslationModel toModel() {
        return WorkflowTranslationModel.builder()
                .id(this.id)
                .workflowName(this.workflowName)
                .workflowVersion(this.workflowVersion)
                .messageCode(this.messageCode)
                .translations(this.translations)
                .createdAt(this.createdAt)
                .updatedAt(this.updatedAt)
                .build();
    }
}

