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
package com.vodafone.vss.weaver.tasks.scripting.metrics;

import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.atomic.AtomicInteger;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.vodafone.vss.weaver.common.metrics.MetricService;
import com.vodafone.vss.weaver.common.metrics.Metrics;
import com.vodafone.vss.weaver.common.scripting.Languages;
import com.vodafone.vss.weaver.common.scripting.ScriptEngineTaskResult;
import com.vodafone.vss.weaver.common.scripting.ScriptErrorCode;

@Component
public class ScriptMetricsService {

    private static final String UNKNOWN = "unknown";

    private final MetricService metricService;

    @Autowired
    public ScriptMetricsService(@Autowired(required = false) MetricService metricService) {
        this.metricService = metricService;
    }

    public void recordExecution(String source, Languages language, ScriptEngineTaskResult result, long durationMs) {
        if (metricService == null) return;
        String status = normalize(result == null ? null : result.getStatus());
        String code = normalize(result == null ? null : result.getCode());

        metricService.increment(
                Metrics.SCRIPT_EXECUTION_REQUESTS,
                "source", normalize(source),
                "language", language(language),
                "status", status,
                "code", code
        );
        metricService.recordTimer(
                Metrics.SCRIPT_EXECUTION_DURATION,
                durationMs,
                "source", normalize(source),
                "language", language(language),
                "status", status,
                "code", code
        );
    }

    public void recordExecutionFailure(String source, Languages language, String code, long durationMs) {
        if (metricService == null) return;
        metricService.increment(
                Metrics.SCRIPT_EXECUTION_REQUESTS,
                "source", normalize(source),
                "language", language(language),
                "status", "failed",
                "code", normalize(code)
        );
        metricService.recordTimer(
                Metrics.SCRIPT_EXECUTION_DURATION,
                durationMs,
                "source", normalize(source),
                "language", language(language),
                "status", "failed",
                "code", normalize(code)
        );
    }

    public void recordEngineEvaluation(Languages language, ScriptEngineTaskResult result, long durationMs) {
        if (metricService == null) return;
        metricService.recordTimer(
                Metrics.SCRIPT_ENGINE_EVAL_DURATION,
                durationMs,
                "language", language(language),
                "status", normalize(result == null ? null : result.getStatus()),
                "code", normalize(result == null ? null : result.getCode())
        );
    }

    public void incrementTimeout(Languages language) {
        if (metricService == null) return;
        metricService.increment(Metrics.SCRIPT_EXECUTION_TIMEOUTS, "language", language(language));
    }

    public void recordContextWait(Languages language, long durationMs) {
        if (metricService == null) return;
        metricService.recordTimer(Metrics.SCRIPT_ENGINE_LOCK_WAIT_DURATION, durationMs, "language", language(language));
    }

    public void registerInFlightGauge(Languages language, AtomicInteger inFlight) {
        if (metricService == null) return;
        metricService.registerGauge(
                Metrics.SCRIPT_EXECUTION_IN_FLIGHT,
                inFlight,
                AtomicInteger::doubleValue,
                "language", language(language)
        );
    }

    public void registerJexlExecutorGauges(ThreadPoolExecutor executor) {
        if (metricService == null) return;
        metricService.registerGauge(
                Metrics.SCRIPT_JEXL_EXECUTOR_ACTIVE_THREADS,
                executor,
                ThreadPoolExecutor::getActiveCount,
                "language", language(Languages.JEXL)
        );
        metricService.registerGauge(
                Metrics.SCRIPT_JEXL_EXECUTOR_POOL_SIZE,
                executor,
                ThreadPoolExecutor::getPoolSize,
                "language", language(Languages.JEXL)
        );
        metricService.registerGauge(
                Metrics.SCRIPT_JEXL_EXECUTOR_QUEUE_SIZE,
                executor,
                value -> value.getQueue().size(),
                "language", language(Languages.JEXL)
        );
    }

    public void incrementJexlExecutorRejected() {
        if (metricService == null) return;
        metricService.increment(Metrics.SCRIPT_JEXL_EXECUTOR_REJECTED, "language", language(Languages.JEXL));
    }

    public void recordPayload(Languages language, String script, Map<String, Object> variables) {
        if (metricService == null) return;
        metricService.recordDistributionSummary(
                Metrics.SCRIPT_PAYLOAD_SIZE_BYTES,
                byteSize(script),
                "language", language(language)
        );
        metricService.recordDistributionSummary(
                Metrics.SCRIPT_VARIABLES_COUNT,
                variables == null ? 0 : variables.size(),
                "language", language(language)
        );
    }

    public void recordResult(Languages language, ScriptEngineTaskResult result) {
        if (metricService == null || result == null || !(result.getOutput() instanceof CharSequence text)) {
            return;
        }
        metricService.recordDistributionSummary(
                Metrics.SCRIPT_RESULT_SIZE_BYTES,
                byteSize(text.toString()),
                "language", language(language),
                "status", normalize(result.getStatus())
        );
    }

    public void recordCrud(String operation, String status, long durationMs) {
        if (metricService == null) return;
        metricService.increment(
                Metrics.SCRIPT_CRUD_REQUESTS,
                "operation", normalize(operation),
                "status", normalize(status)
        );
        metricService.recordTimer(
                Metrics.SCRIPT_CRUD_DURATION,
                durationMs,
                "operation", normalize(operation),
                "status", normalize(status)
        );
    }

    public String language(Languages language) {
        return language == null ? UNKNOWN : language.name().toLowerCase(Locale.ROOT);
    }

    public String successStatus(ScriptEngineTaskResult result) {
        return result != null && "SUCCESS".equalsIgnoreCase(result.getStatus()) ? "success" : "failed";
    }

    public String timeoutCode() {
        return ScriptErrorCode.TIME_OUT.name().toLowerCase(Locale.ROOT);
    }

    private double byteSize(String value) {
        return value == null ? 0 : value.getBytes(StandardCharsets.UTF_8).length;
    }

    private String normalize(String value) {
        return value == null || value.isBlank() ? UNKNOWN : value.toLowerCase(Locale.ROOT);
    }
}

