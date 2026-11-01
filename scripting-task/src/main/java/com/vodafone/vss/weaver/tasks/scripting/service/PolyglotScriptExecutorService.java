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
package com.vodafone.vss.weaver.tasks.scripting.service;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.ScheduledThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

import jakarta.annotation.PreDestroy;

import org.graalvm.polyglot.Context;
import org.graalvm.polyglot.PolyglotException;
import org.graalvm.polyglot.Source;
import org.graalvm.polyglot.Value;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.vodafone.vss.weaver.common.scripting.Languages;
import com.vodafone.vss.weaver.common.scripting.ScriptEngineTaskResult;
import com.vodafone.vss.weaver.common.scripting.ScriptErrorCode;
import com.vodafone.vss.weaver.tasks.scripting.contract.ScriptEngine;
import com.vodafone.vss.weaver.tasks.scripting.metrics.ScriptMetricsService;
import com.vodafone.vss.weaver.tasks.scripting.polyglot.PolyglotContextPool;
import com.vodafone.vss.weaver.tasks.scripting.polyglot.PolyglotValues;
import com.vodafone.vss.weaver.tasks.scripting.polyglot.PreparedContext;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import static com.vodafone.vss.weaver.common.utils.WorkerUtils.resultSize;
import static com.vodafone.vss.weaver.common.utils.WorkerUtils.resultType;
import static com.vodafone.vss.weaver.common.utils.WorkerUtils.safeLogReason;
import static com.vodafone.vss.weaver.common.utils.WorkerUtils.sortedKeys;

public abstract class PolyglotScriptExecutorService implements ScriptEngine {

    private static final Logger log = LoggerFactory.getLogger(PolyglotScriptExecutorService.class);
    private static final int DEFAULT_TIMEOUT_MS = 3000;
    private static final ObjectMapper JSON = new ObjectMapper();

    private final Languages language;
    private final String languageId;
    private final String displayName;
    private final PolyglotContextPool pool;
    private final ScriptMetricsService metrics;
    private final long acquireTimeoutMs;
    private final AtomicInteger inFlight = new AtomicInteger();
    private final ScheduledThreadPoolExecutor timeoutScheduler;

    protected PolyglotScriptExecutorService(
            Languages language,
            String languageId,
            String displayName,
            PolyglotContextPool pool,
            ScriptMetricsService metrics,
            long acquireTimeoutMs) {
        this.language = language;
        this.languageId = languageId;
        this.displayName = displayName;
        this.pool = pool;
        this.metrics = metrics;
        this.acquireTimeoutMs = acquireTimeoutMs;
        this.timeoutScheduler = new ScheduledThreadPoolExecutor(1, runnable -> {
            Thread thread = new Thread(runnable, languageId + "-script-timeout");
            thread.setDaemon(true);
            return thread;
        });
        this.timeoutScheduler.setRemoveOnCancelPolicy(true);
        if (metrics != null) {
            metrics.registerInFlightGauge(language, inFlight);
        }
    }

    protected abstract void bindVariables(Context context, Value parsed, Set<String> names);

    protected abstract ScriptErrorCode failureCode(PolyglotException ex);

    protected Object toResult(Value value) {
        return PolyglotValues.toJava(value);
    }

    @Override
    public ScriptEngineTaskResult evaluate(String script, Map<String, Object> args) {
        return evaluate(script, args, null);
    }

    @Override
    public ScriptEngineTaskResult evaluate(String script, Map<String, Object> args, Integer timeoutMs) {
        long startNs = System.nanoTime();
        Map<String, Object> variables = args == null ? Map.of() : args;
        int effectiveTimeoutMs = timeoutMs == null || timeoutMs <= 0 ? DEFAULT_TIMEOUT_MS : timeoutMs;
        if (metrics != null) {
            metrics.recordPayload(language, script, variables);
        }

        log.debug("{}_script_evaluation_started scriptLength={} timeoutMs={} variableKeys={}",
                languageId, script == null ? 0 : script.length(), effectiveTimeoutMs, sortedKeys(variables));

        if (script == null || script.isBlank()) {
            return failed(ScriptErrorCode.SCRIPT_VALIDATION_ERROR, displayName + " script can not be empty", startNs);
        }
        String variablesJson;
        try {
            variablesJson = JSON.writeValueAsString(variables);
        } catch (JsonProcessingException e) {
            return failed(ScriptErrorCode.SCRIPT_VALIDATION_ERROR,
                    "Script variables must be JSON values: " + e.getOriginalMessage(), startNs);
        }

        inFlight.incrementAndGet();
        try {
            return run(script, variables.keySet(), variablesJson, effectiveTimeoutMs, startNs);
        } finally {
            inFlight.decrementAndGet();
        }
    }

    private ScriptEngineTaskResult run(String script, Set<String> names, String variablesJson, int timeoutMs, long startNs) {
        PreparedContext prepared;
        long waitStartNs = System.nanoTime();
        try {
            prepared = pool.acquire(acquireTimeoutMs);
        } catch (PolyglotContextPool.EngineBusyException e) {
            log.warn("{}_script_engine_busy waitMs={} reason={}", languageId, acquireTimeoutMs, e.getMessage());
            return failed(ScriptErrorCode.ENGINE_BUSY, e.getMessage(), startNs);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return failed(ScriptErrorCode.SCRIPT_EXECUTION_ERROR, displayName + " script execution was interrupted", startNs);
        } catch (RuntimeException e) {
            log.error("{}_script_context_creation_failed", languageId, e);
            return failed(ScriptErrorCode.SCRIPT_EXECUTION_ERROR, "Failed to start the " + displayName + " engine", startNs);
        } finally {
            if (metrics != null) {
                metrics.recordContextWait(language, elapsedMs(waitStartNs));
            }
        }

        AtomicBoolean timedOut = new AtomicBoolean();
        AtomicBoolean released = new AtomicBoolean();
        ScheduledFuture<?> timeout = timeoutScheduler.schedule(() -> {
            timedOut.set(true);
            if (released.compareAndSet(false, true)) {
                pool.release(prepared, false);
            }
        }, timeoutMs, TimeUnit.MILLISECONDS);
        Context context = prepared.context();
        boolean reusable = false;
        try {
            bindVariables(context, prepared.parseJson().execute(variablesJson), names);
            Value value = context.eval(Source.create(languageId, script));
            Object output = toResult(value);
            if (timedOut.get()) {
                return timeoutResult(timeoutMs, startNs);
            }
            log.debug("{}_script_evaluation_completed durationMs={} resultType={} resultSize={}",
                    languageId, elapsedMs(startNs), resultType(output), resultSize(output));
            reusable = true;
            return record(ScriptEngineTaskResult.builder()
                    .status("SUCCESS")
                    .code(ScriptErrorCode.SCRIPT_EXECUTED.name())
                    .message(displayName + " script executed successfully")
                    .output(output)
                    .executionTime(elapsedMs(startNs))
                    .build());
        } catch (PolyglotException ex) {
            if (timedOut.get() || ex.isCancelled()) {
                return timeoutResult(timeoutMs, startNs);
            }
            String reason = safeLogReason(ex.getMessage());
            ScriptErrorCode code = ex.isResourceExhausted() ? ScriptErrorCode.SCRIPT_RESOURCE_EXHAUSTED
                    : ex.isSyntaxError() ? ScriptErrorCode.SCRIPT_SYNTAX_ERROR
                    : failureCode(ex);
            log.warn("{}_script_evaluation_failed durationMs={} code={} reason={}", languageId, elapsedMs(startNs), code, reason);
            reusable = !ex.isResourceExhausted();
            return failed(code, reason, startNs);
        } catch (IllegalArgumentException ex) {
            String reason = safeLogReason(ex.getMessage());
            log.warn("{}_script_result_rejected durationMs={} reason={}", languageId, elapsedMs(startNs), reason);
            reusable = true;
            return failed(ScriptErrorCode.SCRIPT_VALUE_ERROR, reason, startNs);
        } catch (RuntimeException ex) {
            if (timedOut.get()) {
                return timeoutResult(timeoutMs, startNs);
            }
            log.error("{}_script_evaluation_error durationMs={} exceptionClass={}",
                    languageId, elapsedMs(startNs), ex.getClass().getSimpleName(), ex);
            return failed(ScriptErrorCode.SCRIPT_EXECUTION_ERROR, safeLogReason(ex.getMessage()), startNs);
        } finally {
            timeout.cancel(false);
            if (released.compareAndSet(false, true)) {
                pool.release(prepared, reusable && !timedOut.get());
            }
        }
    }

    private ScriptEngineTaskResult timeoutResult(int timeoutMs, long startNs) {
        log.warn("{}_script_evaluation_timed_out timeoutMs={} durationMs={}", languageId, timeoutMs, elapsedMs(startNs));
        if (metrics != null) {
            metrics.incrementTimeout(language);
        }
        return record(ScriptEngineTaskResult.builder()
                .status("FAILED")
                .code(ScriptErrorCode.TIME_OUT.name())
                .reason(displayName + " script exceeded timeout of " + timeoutMs + " ms")
                .message(displayName + " script execution timed out")
                .executionTime(elapsedMs(startNs))
                .build());
    }

    private ScriptEngineTaskResult failed(ScriptErrorCode code, String reason, long startNs) {
        return record(ScriptEngineTaskResult.builder()
                .status("FAILED")
                .code(code.name())
                .reason(reason)
                .message(displayName + " script execution failed")
                .executionTime(elapsedMs(startNs))
                .build());
    }

    private ScriptEngineTaskResult record(ScriptEngineTaskResult result) {
        if (metrics != null) {
            metrics.recordEngineEvaluation(language, result, result.getExecutionTime());
            metrics.recordResult(language, result);
        }
        return result;
    }

    private static long elapsedMs(long startNs) {
        return TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startNs);
    }

    @PreDestroy
    public void shutdown() {
        timeoutScheduler.shutdownNow();
    }
}

