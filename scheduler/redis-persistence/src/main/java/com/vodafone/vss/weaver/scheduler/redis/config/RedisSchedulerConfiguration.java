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

import com.vodafone.vss.weaver.scheduler.redis.dao.RedisSchedulerArchivalDAO;
import com.vodafone.vss.weaver.scheduler.redis.dao.RedisSchedulerCacheDAO;
import com.vodafone.vss.weaver.scheduler.redis.dao.RedisSchedulerDAO;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Conditional;
import org.springframework.context.annotation.Configuration;

import com.vodafone.vss.weaver.core.config.WeaverProperties;
import com.vodafone.vss.weaver.redis.config.AnyRedisCondition;
import com.vodafone.vss.weaver.redis.config.RedisProperties;
import com.vodafone.vss.weaver.redis.jedis.JedisProxy;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vodafone.vss.weaver.scheduler.archive.SchedulerArchivalDAO;
import com.vodafone.vss.weaver.scheduler.dao.SchedulerCacheDAO;
import com.vodafone.vss.weaver.scheduler.dao.SchedulerDAO;

@Configuration(proxyBeanMethods = false)
@Conditional(AnyRedisCondition.class)
public class RedisSchedulerConfiguration {

    @Bean
    @ConditionalOnProperty(
            name = "weaver.scheduler.cache.enabled",
            havingValue = "true",
            matchIfMissing = false)
    public SchedulerCacheDAO redisSchedulerCacheDAO(
            JedisProxy jedisProxy,
            ObjectMapper objectMapper,
            WeaverProperties WeaverProperties,
            RedisProperties redisProperties) {
        return new RedisSchedulerCacheDAO(
                jedisProxy, objectMapper, WeaverProperties, redisProperties);
    }

    @Bean
    @ConditionalOnProperty(
            name = "weaver.scheduler.enabled",
            havingValue = "true",
            matchIfMissing = false)
    public SchedulerDAO redisSchedulerDAO(
            JedisProxy jedisProxy,
            ObjectMapper objectMapper,
            WeaverProperties WeaverProperties,
            RedisProperties redisProperties) {
        return new RedisSchedulerDAO(
                jedisProxy, objectMapper, WeaverProperties, redisProperties);
    }

    @Bean
    @ConditionalOnProperty(
            name = "weaver.scheduler.enabled",
            havingValue = "true",
            matchIfMissing = false)
    public SchedulerArchivalDAO redisSchedulerArchivalDAO(
            JedisProxy jedisProxy,
            ObjectMapper objectMapper,
            WeaverProperties WeaverProperties,
            RedisProperties redisProperties,
            @Value("${weaver.scheduler.redis.archival-ttl-days:7}") int archivalTtlDays) {
        long ttlSeconds = archivalTtlDays * 24L * 60 * 60;
        return new RedisSchedulerArchivalDAO(
                jedisProxy, objectMapper, WeaverProperties, redisProperties, ttlSeconds);
    }
}
