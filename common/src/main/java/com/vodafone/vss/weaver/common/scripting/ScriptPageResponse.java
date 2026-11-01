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

import com.vodafone.vss.weaver.common.response.PageResult;
import com.vodafone.vss.weaver.common.response.PaginatedResult;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScriptPageResponse {

    private List<ScriptDefinitionResponse> content;
    private int pageNumber;
    private int pageSize;
    private int numberOfElements;
    private long totalElements;
    private int totalPages;
    private boolean first;
    private boolean last;

    public List<ScriptDefinitionResponse> content() {
        return content;
    }

    public int numberOfElements() {
        return numberOfElements;
    }

    public long totalElements() {
        return totalElements;
    }

    public static ScriptPageResponse from(PageResult<ScriptModel> pageResult) {
        if (pageResult == null) {
            return null;
        }
        List<ScriptDefinitionResponse> dtoList = pageResult.content() != null
                ? pageResult.content().stream().map(ScriptDefinitionResponse::fromModel).toList()
                : List.of();
        PaginatedResult p = pageResult.pagination();
        int pageNumber = p != null ? p.getPageNumber() : 0;
        int pageSize = p != null ? p.getSize() : 20;
        long totalElements = p != null ? p.getTotalElements() : dtoList.size();
        int totalPages = p != null ? p.getTotalPages() : 1;
        boolean first = p != null ? p.isFirstPage() : true;
        boolean last = p != null ? p.isLastPage() : true;
        return ScriptPageResponse.builder()
                .content(dtoList)
                .pageNumber(pageNumber)
                .pageSize(pageSize)
                .numberOfElements(dtoList.size())
                .totalElements(totalElements)
                .totalPages(totalPages)
                .first(first)
                .last(last)
                .build();
    }
}
