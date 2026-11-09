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
package com.vodafone.vss.weaver.ai.tasks.worker;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.vodafone.vss.weaver.ai.document.DocumentLoader;
import com.vodafone.vss.weaver.ai.model.LLMResponse;
import com.vodafone.vss.weaver.ai.model.MarkdownToPdfRequest;
import com.vodafone.vss.weaver.ai.model.Media;
import com.vodafone.vss.weaver.ai.pdf.MarkdownToPdfConverter;
import com.vodafone.vss.weaver.ai.config.AIIntegrationEnabledCondition;
import com.vodafone.vss.weaver.core.execution.tasks.AnnotatedSystemTaskWorker;
import org.springframework.context.annotation.Conditional;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import com.vodafone.vss.weaver.common.metadata.tasks.Task;
import com.vodafone.vss.weaver.sdk.workflow.executor.task.NonRetryableException;
import com.vodafone.vss.weaver.sdk.workflow.executor.task.TaskContext;
import com.vodafone.vss.weaver.sdk.workflow.task.WorkerTask;

import lombok.extern.slf4j.Slf4j;

import static org.apache.commons.lang3.StringUtils.isBlank;

/** Worker for document generation tasks such as PDF generation from markdown. */
@Slf4j
@Component
@Conditional(AIIntegrationEnabledCondition.class)
public class DocumentGenWorkers implements AnnotatedSystemTaskWorker {

    private final MarkdownToPdfConverter pdfConverter;
    private final List<DocumentLoader> documentLoaders;
    private final String payloadStoreLocation;

    public DocumentGenWorkers(
            MarkdownToPdfConverter pdfConverter,
            List<DocumentLoader> documentLoaders,
            Environment env) {
        this.pdfConverter = pdfConverter;
        this.documentLoaders = documentLoaders;
        this.payloadStoreLocation =
                env.getProperty(
                        "weaver.file-storage.parentDir",
                        System.getProperty("user.home") + "/worker-payload/");
        log.info("Document Workers initialized");
    }

    @WorkerTask("GENERATE_PDF")
    public LLMResponse generatePdf(MarkdownToPdfRequest input) {
        if (isBlank(input.getMarkdown())) {
            throw new NonRetryableException("markdown input is required for GENERATE_PDF task");
        }

        Task task = TaskContext.get().getTask();

        // Convert markdown to PDF bytes
        byte[] pdfBytes = pdfConverter.convert(input);

        // Determine output location
        String outputLocation = input.getOutputLocation();
        if (isBlank(outputLocation)) {
            outputLocation =
                    payloadStoreLocation
                            + task.getWorkflowInstanceId()
                            + "/"
                            + task.getTaskId()
                            + "/"
                            + UUID.randomUUID()
                            + ".pdf";
        }

        // Store via DocumentLoader
        String storedLocation = storeDocument(outputLocation, pdfBytes);

        return LLMResponse.builder()
                .result(Map.of("location", storedLocation, "sizeBytes", pdfBytes.length))
                .media(
                        List.of(
                                Media.builder()
                                        .location(storedLocation)
                                        .mimeType("application/pdf")
                                        .build()))
                .finishReason("COMPLETED")
                .build();
    }

    private String storeDocument(String location, byte[] data) {
        return documentLoaders.stream()
                .filter(loader -> loader.supports(location))
                .findFirst()
                .map(loader -> loader.upload(Map.of(), "application/pdf", data, location))
                .orElseThrow(
                        () ->
                                new NonRetryableException(
                                        "No DocumentLoader supports output location: " + location));
    }
}
