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
package com.vodafone.vss.weaver.scheduler.redis.config;

import org.junit.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.vodafone.vss.weaver.common.config.ObjectMapperProvider;
import com.vodafone.vss.weaver.core.config.WeaverProperties;
import com.vodafone.vss.weaver.redis.config.RedisProperties;
import com.vodafone.vss.weaver.redis.jedis.JedisProxy;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vodafone.vss.weaver.scheduler.archive.SchedulerArchivalDAO;
import com.vodafone.vss.weaver.scheduler.dao.SchedulerDAO;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

public class RedisSchedulerAutoConfigurationTest {

    @Configuration
    static class MockRedisBeans {
        @Bean
        public JedisProxy jedisProxy() {
            return mock(JedisProxy.class);
        }

        @Bean
        public WeaverProperties WeaverProperties() {
            return new WeaverProperties();
        }

        @Bean
        public RedisProperties redisProperties(WeaverProperties WeaverProperties) {
            return new RedisProperties(WeaverProperties);
        }

        @Bean
        public ObjectMapper objectMapper() {
            return new ObjectMapperProvider().getObjectMapper();
        }
    }

    private ApplicationContextRunner baseRunner() {
        return new ApplicationContextRunner()
                .withConfiguration(AutoConfigurations.of(RedisSchedulerConfiguration.class))
                .withUserConfiguration(MockRedisBeans.class);
    }

    @Test
    public void testBeansRegistered_whenRedisStandaloneAndSchedulerEnabled() {
        baseRunner()
                .withPropertyValues(
                        "weaver.db.type=redis_standalone", "weaver.scheduler.enabled=true")
                .run(
                        ctx -> {
                            assertThat(ctx).hasSingleBean(SchedulerDAO.class);
                            assertThat(ctx).hasSingleBean(SchedulerArchivalDAO.class);
                        });
    }

    @Test
    public void testBeansRegistered_whenRedisCluster() {
        baseRunner()
                .withPropertyValues(
                        "weaver.db.type=redis_cluster", "weaver.scheduler.enabled=true")
                .run(
                        ctx -> {
                            assertThat(ctx).hasSingleBean(SchedulerDAO.class);
                            assertThat(ctx).hasSingleBean(SchedulerArchivalDAO.class);
                        });
    }

    @Test
    public void testBeansRegistered_whenRedisSentinel() {
        baseRunner()
                .withPropertyValues(
                        "weaver.db.type=redis_sentinel", "weaver.scheduler.enabled=true")
                .run(
                        ctx -> {
                            assertThat(ctx).hasSingleBean(SchedulerDAO.class);
                            assertThat(ctx).hasSingleBean(SchedulerArchivalDAO.class);
                        });
    }

    @Test
    public void testBeansRegistered_whenMemory() {
        baseRunner()
                .withPropertyValues("weaver.db.type=memory", "weaver.scheduler.enabled=true")
                .run(
                        ctx -> {
                            assertThat(ctx).hasSingleBean(SchedulerDAO.class);
                            assertThat(ctx).hasSingleBean(SchedulerArchivalDAO.class);
                        });
    }

    @Test
    public void testNoBeansRegistered_whenSchedulerEnabledMissing() {
        baseRunner()
                .withPropertyValues("weaver.db.type=redis_standalone")
                .run(
                        ctx -> {
                            assertThat(ctx).doesNotHaveBean(SchedulerDAO.class);
                            assertThat(ctx).doesNotHaveBean(SchedulerArchivalDAO.class);
                        });
    }

    @Test
    public void testNoBeansRegistered_whenSchedulerDisabled() {
        baseRunner()
                .withPropertyValues(
                        "weaver.db.type=redis_standalone", "weaver.scheduler.enabled=false")
                .run(
                        ctx -> {
                            assertThat(ctx).doesNotHaveBean(SchedulerDAO.class);
                            assertThat(ctx).doesNotHaveBean(SchedulerArchivalDAO.class);
                        });
    }

    @Test
    public void testNoBeansRegistered_whenDbTypeIsNotRedis() {
        baseRunner()
                .withPropertyValues(
                        "weaver.db.type=postgres", "weaver.scheduler.enabled=true")
                .run(
                        ctx -> {
                            assertThat(ctx).doesNotHaveBean(SchedulerDAO.class);
                            assertThat(ctx).doesNotHaveBean(SchedulerArchivalDAO.class);
                        });
    }

    @Test
    public void testNoBeansRegistered_whenDbTypeAbsent() {
        baseRunner()
                .withPropertyValues("weaver.scheduler.enabled=true")
                .run(
                        ctx -> {
                            assertThat(ctx).doesNotHaveBean(SchedulerDAO.class);
                            assertThat(ctx).doesNotHaveBean(SchedulerArchivalDAO.class);
                        });
    }
}
