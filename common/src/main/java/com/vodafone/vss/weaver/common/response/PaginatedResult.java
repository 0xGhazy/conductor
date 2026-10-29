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
package com.vodafone.vss.weaver.common.response;

import lombok.*;

/**
 * Pagination metadata envelope for list results.
 */
@Setter
@Getter
@Builder
@ToString
@AllArgsConstructor
@NoArgsConstructor
public class PaginatedResult {

    private int totalPages;
    private long totalElements;
    private boolean isFirstPage;
    private boolean isLastPage;
    private int size;
    private int pageNumber;

    public PaginatedResult(int pageNumber, int pageSize, long totalElements, int totalPages, int size) {
        this.pageNumber = pageNumber;
        this.totalPages = totalPages;
        this.totalElements = totalElements;
        this.size = size;
        this.isFirstPage = pageNumber <= 0;
        this.isLastPage = pageNumber >= totalPages - 1;
    }

    public static PaginatedResult of(long totalElements, int pageNumber, int pageSize, int currentSize) {
        int effectivePageSize = pageSize > 0 ? pageSize : 20;
        int totalPages = (int) Math.ceil((double) totalElements / effectivePageSize);
        if (totalPages == 0 && totalElements == 0) {
            totalPages = 1;
        }
        return PaginatedResult.builder()
                .totalElements(totalElements)
                .totalPages(totalPages)
                .pageNumber(pageNumber)
                .size(currentSize)
                .isFirstPage(pageNumber <= 0)
                .isLastPage(pageNumber >= totalPages - 1)
                .build();
    }
}
