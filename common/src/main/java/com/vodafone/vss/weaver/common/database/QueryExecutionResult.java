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
package com.vodafone.vss.weaver.common.database;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.annotation.JsonInclude;

import lombok.*;

/**
 * Result of executing an ad-hoc or saved database query.
 */
@Getter
@Setter
@Builder
@ToString
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class QueryExecutionResult implements Serializable {

    @Builder.Default private Object resultSet = new ArrayList<>();
    private String status;
    private String errorCode;
    private Integer affectedRows;
    private Integer size;
    private Integer duration;
    private Object reason;
    private Long executionTimeMs;
    private List<Map<String, Object>> rows;
    private Integer rowCount;

    /** True when the result set had more rows than the row limit and was cut. */
    private Boolean truncated;

    public Integer getSize() {
        if (size != null) {
            return size;
        }
        if (rowCount != null) {
            return rowCount;
        }
        if (rows != null) {
            return rows.size();
        }
        return 0;
    }

    public void setSize(int size) {
        this.size = size;
        this.rowCount = size;
    }

    public Object getResultSet() {
        return resultSet != null ? resultSet : rows;
    }

    public void setResultSet(Object resultSet) {
        this.resultSet = resultSet;
    }

    public static QueryExecutionResult success(List<Map<String, Object>> rows, long elapsedMs) {
        return QueryExecutionResult.builder()
                .status("SUCCESS")
                .rows(rows)
                .resultSet(rows)
                .rowCount(rows != null ? rows.size() : 0)
                .size(rows != null ? rows.size() : 0)
                .executionTimeMs(elapsedMs)
                .duration((int) elapsedMs)
                .build();
    }

    public static QueryExecutionResult successUpdate(int affectedRows, long elapsedMs) {
        return QueryExecutionResult.builder()
                .status("SUCCESS")
                .affectedRows(affectedRows)
                .executionTimeMs(elapsedMs)
                .duration((int) elapsedMs)
                .build();
    }

    public static QueryExecutionResult failed(String errorCode, String reason, long elapsedMs) {
        return QueryExecutionResult.builder()
                .status("FAILED")
                .errorCode(errorCode)
                .reason(reason)
                .executionTimeMs(elapsedMs)
                .duration((int) elapsedMs)
                .build();
    }
}
