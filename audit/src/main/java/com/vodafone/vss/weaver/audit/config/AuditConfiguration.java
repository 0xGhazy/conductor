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

import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.ComponentScan;

import com.vodafone.vss.weaver.audit.dao.LoggingAuditDAO;
import com.vodafone.vss.weaver.audit.dao.NoopUserLookupDAO;
import com.vodafone.vss.weaver.dao.AuditDAO;
import com.vodafone.vss.weaver.dao.UserLookupDAO;

/**
 * Spring AutoConfiguration for Conductor audit module.
 */
@AutoConfiguration
@EnableConfigurationProperties(AuditProperties.class)
@ConditionalOnProperty(name = "conductor.audit.enabled", havingValue = "true", matchIfMissing = true)
@ComponentScan(basePackages = "com.vodafone.vss.weaver.audit")
public class AuditConfiguration {

    @Bean
    @ConditionalOnMissingBean(AuditDAO.class)
    public AuditDAO loggingAuditDAO() {
        return new LoggingAuditDAO();
    }

    @Bean
    @ConditionalOnMissingBean(UserLookupDAO.class)
    public UserLookupDAO noopUserLookupDAO() {
        return new NoopUserLookupDAO();
    }
}
