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

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * All languages of one message code for one workflow version, grouped from the rows of the
 * {@code translations} table (see {@link TranslationModel}).
 *
 * <p>{@code id} is the id of the message's earliest row and identifies the group in the API.
 * {@code createdAt}/{@code createdBy} come from that earliest row; {@code updatedAt}/{@code
 * updatedBy} from the most recently updated row.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkflowTranslationModel {

    private UUID id;
    private String workflowName;
    private Integer workflowVersion;
    private String messageCode;
    private Map<String, String> translations;
    private Instant createdAt;
    private Instant updatedAt;
    private UUID createdBy;
    private UUID updatedBy;
}

