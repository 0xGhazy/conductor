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
import java.util.Map;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import lombok.*;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class PoolSettings implements Serializable {

    public static final int DEFAULT_MAXIMUM_POOL_SIZE = 5;
    public static final int DEFAULT_MINIMUM_IDLE = 0;
    public static final long DEFAULT_CONNECTION_TIMEOUT_MS = 10_000L;
    public static final long DEFAULT_VALIDATION_TIMEOUT_MS = 5_000L;
    public static final long DEFAULT_IDLE_TIMEOUT_MS = 60_000L;
    public static final long DEFAULT_MAX_LIFETIME_MS = 1_800_000L;
    public static final long DEFAULT_KEEPALIVE_TIME_MS = 30_000L;
    public static final long DEFAULT_INITIALIZATION_FAIL_TIMEOUT_MS = 1L;
    public static final long DEFAULT_LEAK_DETECTION_THRESHOLD_MS = 0L;

    @Builder.Default private Integer minimumIdle = DEFAULT_MINIMUM_IDLE;
    @Builder.Default private Integer maximumPoolSize = DEFAULT_MAXIMUM_POOL_SIZE;
    @Builder.Default private Long idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS;
    @Builder.Default private Long maxLifetimeMs = DEFAULT_MAX_LIFETIME_MS;
    @Builder.Default private Long connectionTimeoutMs = DEFAULT_CONNECTION_TIMEOUT_MS;
    @Builder.Default private Long validationTimeoutMs = DEFAULT_VALIDATION_TIMEOUT_MS;
    @Builder.Default private Long keepaliveTimeMs = DEFAULT_KEEPALIVE_TIME_MS;
    @Builder.Default private Long leakDetectionThresholdMs = DEFAULT_LEAK_DETECTION_THRESHOLD_MS;
    @Builder.Default private Long initializationFailTimeoutMs = DEFAULT_INITIALIZATION_FAIL_TIMEOUT_MS;
    private Map<String, String> dataSourceProperties;

    public static PoolSettings defaultSettings() {
        return PoolSettings.builder().build();
    }

    // Record-style and compatibility accessors
    public Integer maximumPoolSize() { return maximumPoolSize; }
    public Integer minimumIdle() { return minimumIdle; }
    public Long connectionTimeoutMs() { return connectionTimeoutMs; }
    public Long validationTimeoutMs() { return validationTimeoutMs; }
    public Long idleTimeoutMs() { return idleTimeoutMs; }
    public Long maxLifetimeMs() { return maxLifetimeMs; }
    public Long keepaliveTimeMs() { return keepaliveTimeMs; }
    public Long leakDetectionThresholdMs() { return leakDetectionThresholdMs; }
    public Long initializationFailTimeoutMs() { return initializationFailTimeoutMs; }
    public Map<String, String> dataSourceProperties() { return dataSourceProperties; }

    public Integer getMaxPoolSize() { return maximumPoolSize; }
    public void setMaxPoolSize(Integer maxPoolSize) { this.maximumPoolSize = maxPoolSize; }
    public Integer getIdleTimeout() { return idleTimeoutMs != null ? idleTimeoutMs.intValue() : null; }
    public Integer getConnectionTimeout() { return connectionTimeoutMs != null ? connectionTimeoutMs.intValue() : null; }
    public Integer getValidationTimeout() { return validationTimeoutMs != null ? validationTimeoutMs.intValue() : null; }
}
