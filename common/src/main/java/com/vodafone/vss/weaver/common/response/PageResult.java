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

import java.util.List;

/**
 * Generic page wrapper holding item list and pagination metadata.
 */
public record PageResult<T>(
        List<T> content,
        PaginatedResult pagination
) {
    public List<T> getContent() {
        return content;
    }

    public PaginatedResult getPagination() {
        return pagination;
    }

    public static <T> PageResult<T> of(List<T> content, long totalElements, int page, int size) {
        PaginatedResult pag = PaginatedResult.of(totalElements, page, size, content != null ? content.size() : 0);
        return new PageResult<>(content != null ? content : List.of(), pag);
    }
}

