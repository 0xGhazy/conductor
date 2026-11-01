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
package com.vodafone.vss.weaver.common.scripting;

import java.util.List;
import java.util.UUID;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScriptBulkDeleteResponse {

    private int requestedCount;
    private int deletedCount;
    private List<UUID> deletedIds;
    private List<UUID> notFoundIds;

    public ScriptBulkDeleteResponse(int deletedCount, List<UUID> deletedIds) {
        this.requestedCount = deletedIds != null ? deletedIds.size() : 0;
        this.deletedCount = deletedCount;
        this.deletedIds = deletedIds;
        this.notFoundIds = List.of();
    }

    public int deletedCount() {
        return deletedCount;
    }

    public List<UUID> deletedIds() {
        return deletedIds;
    }
}
