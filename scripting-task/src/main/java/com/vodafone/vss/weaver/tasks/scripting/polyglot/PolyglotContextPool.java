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
package com.vodafone.vss.weaver.tasks.scripting.polyglot;

import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class PolyglotContextPool implements AutoCloseable {

    private static final Logger log = LoggerFactory.getLogger(PolyglotContextPool.class);

    private final String languageId;
    private final Supplier<PreparedContext> factory;
    private final int warmSize;
    private final int maxRunsPerContext;
    private final BlockingQueue<PreparedContext> ready;
    private final Semaphore permits;
    private final ExecutorService refiller;
    private volatile boolean closed;

    public PolyglotContextPool(
            String languageId,
            int warmSize,
            int maxConcurrent,
            int maxRunsPerContext,
            Supplier<PreparedContext> factory) {
        if (maxConcurrent < 1) {
            throw new IllegalArgumentException("maxConcurrent must be at least 1 for " + languageId);
        }
        this.languageId = languageId;
        this.factory = factory;
        this.warmSize = Math.max(0, warmSize);
        this.maxRunsPerContext = Math.max(1, maxRunsPerContext);
        this.ready = new ArrayBlockingQueue<>(Math.max(this.warmSize, maxConcurrent));
        this.permits = new Semaphore(maxConcurrent, true);
        this.refiller = Executors.newSingleThreadExecutor(runnable -> {
            Thread thread = new Thread(runnable, languageId + "-context-refill");
            thread.setDaemon(true);
            return thread;
        });
        scheduleRefill();
    }

    public PreparedContext acquire(long waitMs) throws InterruptedException {
        if (closed) {
            throw new IllegalStateException(languageId + " context pool is closed");
        }
        if (!permits.tryAcquire(waitMs, TimeUnit.MILLISECONDS)) {
            throw new EngineBusyException(
                    languageId + " script engine is busy: no free context within " + waitMs + " ms");
        }
        try {
            PreparedContext context = ready.poll();
            if (maxRunsPerContext == 1) {
                scheduleRefill();
            }
            if (context == null) {
                context = factory.get();
            }
            return context;
        } catch (RuntimeException e) {
            permits.release();
            throw e;
        }
    }

    public void release(PreparedContext context, boolean reusable) {
        try {
            int runs = context.countRun();
            if (reusable && !closed && context.reset() != null && runs < maxRunsPerContext) {
                try {
                    context.reset().execute();
                    if (ready.offer(context)) {
                        return;
                    }
                } catch (RuntimeException e) {
                    log.warn("{} context could not be reset, replacing it: {}", languageId, e.getMessage());
                }
            }
            closeQuietly(context);
            scheduleRefill();
        } finally {
            permits.release();
        }
    }

    private void scheduleRefill() {
        if (closed || warmSize == 0) {
            return;
        }
        try {
            refiller.execute(this::refill);
        } catch (RejectedExecutionException e) {
            // Pool is shutting down
        }
    }

    private void refill() {
        while (!closed && ready.size() < warmSize) {
            PreparedContext context;
            try {
                context = factory.get();
            } catch (RuntimeException e) {
                log.error("Failed to create a {} context ahead of time", languageId, e);
                return;
            }
            if (closed || !ready.offer(context)) {
                closeQuietly(context);
                return;
            }
        }
    }

    private void closeQuietly(PreparedContext context) {
        try {
            context.context().close(true);
        } catch (RuntimeException e) {
            log.warn("{} context did not close cleanly: {}", languageId, e.getMessage());
        }
    }

    @Override
    public void close() {
        closed = true;
        refiller.shutdownNow();
        PreparedContext context;
        while ((context = ready.poll()) != null) {
            closeQuietly(context);
        }
    }

    public static final class EngineBusyException extends RuntimeException {
        public EngineBusyException(String message) {
            super(message);
        }
    }
}

