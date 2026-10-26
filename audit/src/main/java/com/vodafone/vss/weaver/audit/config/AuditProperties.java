/*
 * Copyright 2026 Conductor Authors.
 * <p>
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * <p>
 * http://www.apache.org/licenses/LICENSE-2.0
 * <p>
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
 * an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 */
package com.vodafone.vss.weaver.audit.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import lombok.Data;

/**
 * Configuration properties for Conductor audit module.
 */
@Data
@ConfigurationProperties(prefix = "conductor.audit")
public class AuditProperties {

    /**
     * Master switch for the audit module and AOP interception.
     */
    private boolean enabled = true;

    /**
     * Storage type for audit logs: "postgres", "logging", etc.
     */
    private String storageType = "postgres";

    /**
     * Whether to capture method arguments/details in audit event payloads.
     */
    private boolean capturePayloads = true;

    /**
     * Maximum entries in Caffeine user cache.
     */
    private int maxCacheSize = 1000;

    /**
     * Cache expiration TTL in hours.
     */
    private int cacheTtlHours = 24;
}
