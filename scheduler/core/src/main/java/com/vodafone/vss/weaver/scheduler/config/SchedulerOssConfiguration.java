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
package com.vodafone.vss.weaver.scheduler.config;

import java.util.Optional;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Conditional;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import com.vodafone.vss.weaver.core.sync.Lock;
import com.vodafone.vss.weaver.dao.QueueDAO;
import com.vodafone.vss.weaver.service.WorkflowService;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vodafone.vss.weaver.scheduler.archive.SchedulerArchivalDAO;
import com.vodafone.vss.weaver.scheduler.dao.CachingSchedulerDAO;
import com.vodafone.vss.weaver.scheduler.dao.NoOpSchedulerCacheDAO;
import com.vodafone.vss.weaver.scheduler.dao.SchedulerCacheDAO;
import com.vodafone.vss.weaver.scheduler.dao.SchedulerDAO;
import com.vodafone.vss.weaver.scheduler.health.RedisMonitor;
import com.vodafone.vss.weaver.scheduler.listener.ScheduleChangeListener;
import com.vodafone.vss.weaver.scheduler.listener.ScheduleChangeListenerStub;
import com.vodafone.vss.weaver.scheduler.service.SchedulerService;
import com.vodafone.vss.weaver.scheduler.service.SchedulerServiceExecutor;
import com.vodafone.vss.weaver.scheduler.service.SchedulerTimeProvider;

@Configuration
@Conditional(SchedulerConditions.class)
public class SchedulerOssConfiguration {

    @Bean
    @ConditionalOnMissingBean(SchedulerCacheDAO.class)
    public SchedulerCacheDAO noOpSchedulerCacheDAO() {
        return new NoOpSchedulerCacheDAO();
    }

    @Bean
    @Primary
    @ConditionalOnProperty(
            name = "weaver.scheduler.cache.enabled",
            havingValue = "true",
            matchIfMissing = false)
    public SchedulerDAO cachingSchedulerDAO(
            SchedulerDAO schedulerDAO, SchedulerCacheDAO schedulerCacheDAO) {
        return new CachingSchedulerDAO(schedulerDAO, schedulerCacheDAO);
    }

    @Bean
    @ConditionalOnMissingBean(SchedulerService.class)
    public SchedulerService schedulerService(
            SchedulerArchivalDAO schedulerArchivalDAO,
            SchedulerDAO schedulerDAO,
            WorkflowService workflowService,
            QueueDAO queueDAO,
            SchedulerServiceExecutor schedulerServiceExecutor,
            Optional<RedisMonitor> redisMaintenanceDAO,
            SchedulerProperties properties,
            SchedulerTimeProvider schedulerTimeProvider,
            Lock lock,
            ObjectMapper objectMapper,
            ScheduleChangeListener scheduleChangeListener) {
        return new SchedulerService(
                schedulerArchivalDAO,
                schedulerDAO,
                workflowService,
                queueDAO,
                schedulerServiceExecutor,
                redisMaintenanceDAO,
                properties,
                schedulerTimeProvider,
                lock,
                objectMapper,
                scheduleChangeListener);
    }

    @Bean
    @ConditionalOnProperty(
            name = "weaver.schedule-change-listener.type",
            havingValue = "stub",
            matchIfMissing = true)
    public ScheduleChangeListener scheduleChangeListener() {
        return new ScheduleChangeListenerStub();
    }
}
