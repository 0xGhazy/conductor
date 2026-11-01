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
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Future;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.SynchronousQueue;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;

import org.apache.commons.jexl3.JexlContext;
import org.apache.commons.jexl3.JexlEngine;
import org.apache.commons.jexl3.JexlException;
import org.apache.commons.jexl3.JexlScript;
import org.apache.commons.jexl3.MapContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.vodafone.vss.weaver.common.scripting.Languages;
import com.vodafone.vss.weaver.common.scripting.ScriptEngineTaskResult;
import com.vodafone.vss.weaver.common.scripting.ScriptErrorCode;
import com.vodafone.vss.weaver.tasks.scripting.contract.ScriptEngine;
import com.vodafone.vss.weaver.tasks.scripting.metrics.ScriptMetricsService;

import static com.vodafone.vss.weaver.common.utils.WorkerUtils.resultSize;
import static com.vodafone.vss.weaver.common.utils.WorkerUtils.resultType;
import static com.vodafone.vss.weaver.common.utils.WorkerUtils.safeLogReason;
import static com.vodafone.vss.weaver.common.utils.WorkerUtils.sortedKeys;

@Component
public class JexlScriptExecutorService implements ScriptEngine {

    private static final Logger log = LoggerFactory.getLogger(JexlScriptExecutorService.class);
    private static final int DEFAULT_TIMEOUT_MS = 3000;
    private static final Pattern QUOTED_NAME = Pattern.compile("'([^']*)'");
    private static final Pattern QUOTED_METHOD = Pattern.compile("'([^'(]+)");
    private static final Pattern TRAILING_QUOTED_CODE = Pattern.compile("'([^']*)'\\s*$");
    private static final AtomicInteger THREAD_COUNTER = new AtomicInteger();

    private final JexlEngine jexlEngine;
    private final ScriptMetricsService scriptMetricsService;
    private final AtomicInteger inFlight = new AtomicInteger();

    @Value("${script.engine.jexl.executor.core-pool-size:0}")
    private int corePoolSize;

    @Value("${script.engine.jexl.executor.max-pool-size:50}")
    private int maxPoolSize;

    @Value("${script.engine.jexl.executor.queue-capacity:100}")
    private int queueCapacity;

    private ThreadPoolExecutor executorService;

    @Autowired
    public JexlScriptExecutorService(
            JexlEngine jexlEngine, @Autowired(required = false) ScriptMetricsService scriptMetricsService) {
        this.jexlEngine = jexlEngine;
        this.scriptMetricsService = scriptMetricsService;
    }

    @PostConstruct
    public void initExecutor() {
        int resolvedMaxPoolSize = Math.max(1, maxPoolSize);
        int resolvedCorePoolSize = Math.max(0, Math.min(corePoolSize, resolvedMaxPoolSize));
        BlockingQueue<Runnable> workQueue = queueCapacity <= 0
                ? new SynchronousQueue<>()
                : new ArrayBlockingQueue<>(queueCapacity);

        executorService = new ThreadPoolExecutor(
                resolvedCorePoolSize,
                resolvedMaxPoolSize,
                60L,
                TimeUnit.SECONDS,
                workQueue,
                daemonThreadFactory("jexl-script"),
                (runnable, executor) -> {
                    if (scriptMetricsService != null) {
                        scriptMetricsService.incrementJexlExecutorRejected();
                    }
                    throw new RejectedExecutionException("JEXL script executor queue is full");
                }
        );
        executorService.allowCoreThreadTimeOut(resolvedCorePoolSize > 0);
        if (scriptMetricsService != null) {
            scriptMetricsService.registerInFlightGauge(Languages.JEXL, inFlight);
            scriptMetricsService.registerJexlExecutorGauges(executorService);
        }
    }

    @Override
    public ScriptEngineTaskResult evaluate(String jexlScript, Map<String, Object> args) {
        return evaluate(jexlScript, args, null);
    }

    @Override
    public ScriptEngineTaskResult evaluate(String jexlScript, Map<String, Object> args, Integer timeoutMs) {
        inFlight.incrementAndGet();
        long startNs = System.nanoTime();
        Map<String, Object> variables = args == null ? Map.of() : args;
        int effectiveTimeoutMs = resolveTimeout(timeoutMs);
        Future<Object> future = null;
        if (scriptMetricsService != null) {
            scriptMetricsService.recordPayload(Languages.JEXL, jexlScript, variables);
        }

        log.debug("jexl_script_evaluation_started scriptLength={} timeoutMs={} variableKeys={}",
                jexlScript == null ? 0 : jexlScript.length(), effectiveTimeoutMs, sortedKeys(variables));
        try {
            if (jexlScript == null || jexlScript.isBlank()) {
                throw new IllegalArgumentException("JEXL script can not be empty");
            }

            JexlScript script = jexlEngine.createScript(jexlScript);
            JexlContext ctx = new MapContext();
            variables.forEach(ctx::set);

            future = executorService.submit(() -> script.execute(ctx));
            Object result = future.get(effectiveTimeoutMs, TimeUnit.MILLISECONDS);
            log.debug("jexl_script_evaluation_completed durationMs={} timeoutMs={} resultType={} resultSize={}",
                    elapsedMs(startNs), effectiveTimeoutMs, resultType(result), resultSize(result));
            ScriptEngineTaskResult successResult = ScriptEngineTaskResult.builder()
                    .status("SUCCESS")
                    .code(ScriptErrorCode.SCRIPT_EXECUTED.name())
                    .message("JEXL script executed successfully")
                    .output(result)
                    .executionTime(elapsedMs(startNs))
                    .build();
            recordEngineResult(successResult, elapsedMs(startNs));
            return successResult;
        } catch (TimeoutException ex) {
            if (future != null) {
                future.cancel(true);
            }
            return timeoutResult(effectiveTimeoutMs, elapsedMs(startNs));
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            return failedResult(ScriptErrorCode.SCRIPT_EXECUTION_ERROR, "JEXL script execution was interrupted", elapsedMs(startNs));
        } catch (ExecutionException ex) {
            return failedExecutionResult(ex.getCause(), elapsedMs(startNs));
        } catch (JexlException.Variable ex) {
            return failedResult(ScriptErrorCode.SCRIPT_NAME_ERROR, resolveUndefinedVariablesError(ex.getMessage()), elapsedMs(startNs));
        } catch (JexlException.Method ex) {
            return failedResult(ScriptErrorCode.SCRIPT_UNSUPPORTED_METHOD_ERROR, resolveUnsupportedMethodsError(ex.getMessage()), elapsedMs(startNs));
        } catch (JexlException.Parsing ex) {
            return failedResult(ScriptErrorCode.SCRIPT_SYNTAX_ERROR, resolveAmbiguousSyntaxError(ex.getMessage()), elapsedMs(startNs));
        } catch (RejectedExecutionException ex) {
            return failedResult(ScriptErrorCode.ENGINE_BUSY, "JEXL script engine is busy", elapsedMs(startNs));
        } catch (IllegalArgumentException ex) {
            String reason = safeLogReason(ex.getMessage());
            return failedResult(ScriptErrorCode.SCRIPT_VALIDATION_ERROR, reason, elapsedMs(startNs));
        } catch (RuntimeException ex) {
            String reason = safeLogReason(ex.getMessage());
            log.error("jexl_script_evaluation_failed durationMs={} failureType={} exceptionClass={} reason={}",
                    elapsedMs(startNs), "EXECUTION", ex.getClass().getSimpleName(), reason, ex);
            return buildFailedResult(ScriptErrorCode.SCRIPT_EXECUTION_ERROR, reason, elapsedMs(startNs));
        } finally {
            inFlight.decrementAndGet();
        }
    }

    private ScriptEngineTaskResult failedExecutionResult(Throwable cause, long executionTime) {
        if (cause instanceof JexlException.Variable ex) {
            return failedResult(ScriptErrorCode.SCRIPT_NAME_ERROR, resolveUndefinedVariablesError(ex.getMessage()), executionTime);
        }
        if (cause instanceof JexlException.Method ex) {
            return failedResult(ScriptErrorCode.SCRIPT_UNSUPPORTED_METHOD_ERROR, resolveUnsupportedMethodsError(ex.getMessage()), executionTime);
        }
        if (cause instanceof JexlException.Parsing ex) {
            return failedResult(ScriptErrorCode.SCRIPT_SYNTAX_ERROR, resolveAmbiguousSyntaxError(ex.getMessage()), executionTime);
        }
        if (cause instanceof JexlException ex) {
            return failedResult(ScriptErrorCode.SCRIPT_RUNTIME_ERROR, safeLogReason(ex.getMessage()), executionTime);
        }

        String reason = safeLogReason(cause == null ? null : cause.getMessage());
        String exceptionClass = cause == null ? "unknown" : cause.getClass().getSimpleName();
        log.error("jexl_script_evaluation_failed durationMs={} failureType={} exceptionClass={} reason={}",
                executionTime, "EXECUTION", exceptionClass, reason, cause);
        return buildFailedResult(ScriptErrorCode.SCRIPT_EXECUTION_ERROR, reason, executionTime);
    }

    private ScriptEngineTaskResult failedResult(ScriptErrorCode code, String reason, long executionTime) {
        log.warn("jexl_script_evaluation_failed durationMs={} failureCode={} reason={}",
                executionTime, code.name(), safeLogReason(reason));
        return buildFailedResult(code, reason, executionTime);
    }

    private ScriptEngineTaskResult buildFailedResult(ScriptErrorCode code, String reason, long executionTime) {
        ScriptEngineTaskResult result = ScriptEngineTaskResult.builder()
                .status("FAILED")
                .code(code.name())
                .reason(reason)
                .message("JEXL script execution failed")
                .executionTime(executionTime)
                .build();
        recordEngineResult(result, executionTime);
        return result;
    }

    private ScriptEngineTaskResult timeoutResult(int timeoutMs, long executionTime) {
        String reason = "JEXL script exceeded timeout of " + timeoutMs + " ms";
        log.warn("jexl_script_evaluation_timed_out timeoutMs={} durationMs={} code={}",
                timeoutMs, executionTime, ScriptErrorCode.TIME_OUT.name());
        if (scriptMetricsService != null) {
            scriptMetricsService.incrementTimeout(Languages.JEXL);
        }
        ScriptEngineTaskResult result = ScriptEngineTaskResult.builder()
                .status("FAILED")
                .code(ScriptErrorCode.TIME_OUT.name())
                .reason(reason)
                .message("JEXL script execution timed out")
                .executionTime(executionTime)
                .build();
        recordEngineResult(result, executionTime);
        return result;
    }

    private String resolveUndefinedVariablesError(String message) {
        String variableName = "unknown";
        Matcher matcher = QUOTED_NAME.matcher(message);
        if (matcher.find()) {
            variableName = matcher.group(1);
        }
        return "Variable '" + variableName + "' is undefined";
    }

    private String resolveUnsupportedMethodsError(String message) {
        String methodName = "unknown";
        Matcher matcher = QUOTED_METHOD.matcher(message);
        if (matcher.find()) {
            methodName = matcher.group(1);
        }
        return "Unsupported method '" + methodName + "'";
    }

    private String resolveAmbiguousSyntaxError(String message) {
        String faultyCode = "unknown";
        Matcher matcher = TRAILING_QUOTED_CODE.matcher(message);
        if (matcher.find()) {
            faultyCode = matcher.group(1);
        }
        return "Parsing error in expression: " + faultyCode;
    }

    private int resolveTimeout(Integer timeoutMs) {
        return timeoutMs == null || timeoutMs <= 0 ? DEFAULT_TIMEOUT_MS : timeoutMs;
    }

    private long elapsedMs(long startNs) {
        return (System.nanoTime() - startNs) / 1_000_000;
    }

    private void recordEngineResult(ScriptEngineTaskResult result, long executionTime) {
        if (scriptMetricsService != null) {
            scriptMetricsService.recordEngineEvaluation(Languages.JEXL, result, executionTime);
            scriptMetricsService.recordResult(Languages.JEXL, result);
        }
    }

    private static ThreadFactory daemonThreadFactory(String namePrefix) {
        return runnable -> {
            Thread thread = new Thread(runnable, namePrefix + "-" + THREAD_COUNTER.incrementAndGet());
            thread.setDaemon(true);
            return thread;
        };
    }

    @PreDestroy
    public void shutdown() {
        if (executorService != null) {
            executorService.shutdownNow();
        }
    }
}

