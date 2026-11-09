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
package com.vodafone.vss.weaver.common.metrics;

import java.util.concurrent.TimeUnit;
import java.util.function.ToDoubleFunction;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import io.micrometer.core.instrument.DistributionSummary;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class MetricService {

    private final MeterRegistry mr;

    @Value("${metrics.prefix:weaver}")
    private String prefix = "conductor";

    public void increment(Metrics name, String... tags) {
        if (mr != null) {
            mr.counter(namespaced(name), normalizeTags(tags)).increment();
        }
    }

    public void recordTimer(Metrics name, long durationMs, String... tags) {
        if (mr != null) {
            Timer.builder(namespaced(name))
                    .tags(normalizeTags(tags))
                    .register(mr)
                    .record(durationMs, TimeUnit.MILLISECONDS);
        }
    }

    public void recordDistributionSummary(Metrics name, double amount, String... tags) {
        if (mr != null) {
            DistributionSummary.builder(namespaced(name))
                    .tags(normalizeTags(tags))
                    .register(mr)
                    .record(amount);
        }
    }

    public <T> void registerGauge(
            Metrics name, T stateObject, ToDoubleFunction<T> valueFunction, String... tags) {
        if (mr != null) {
            Gauge.builder(namespaced(name), stateObject, valueFunction)
                    .tags(normalizeTags(tags))
                    .register(mr);
        }
    }

    public <T> T time(Metrics name, java.util.concurrent.Callable<T> callable, String... tags)
            throws Exception {
        if (mr != null) {
            Timer timer = Timer.builder(namespaced(name)).tags(normalizeTags(tags)).register(mr);
            return timer.recordCallable(callable);
        }
        return callable.call();
    }

    public void time(Metrics name, Runnable runnable, String... tags) {
        if (mr != null) {
            Timer timer = Timer.builder(namespaced(name)).tags(normalizeTags(tags)).register(mr);
            timer.record(runnable);
        } else {
            runnable.run();
        }
    }

    private String namespaced(Metrics name) {
        return (prefix == null || prefix.isBlank())
                ? name.name().toLowerCase()
                : prefix + "." + name.name().toLowerCase();
    }

    private String[] normalizeTags(String... tags) {
        if (tags == null || tags.length == 0) {
            return new String[0];
        }
        String[] normalized = new String[tags.length];
        for (int i = 0; i < tags.length; i++) {
            normalized[i] = tags[i] == null ? "unknown" : tags[i];
        }
        return normalized;
    }
}

