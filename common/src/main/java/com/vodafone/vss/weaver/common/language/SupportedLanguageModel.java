package com.vodafone.vss.weaver.common.language;

import java.time.Instant;
import java.util.UUID;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SupportedLanguageModel {
    private UUID id;
    private String code;
    private String name;
    private Instant createdAt;
    private Instant updatedAt;
}

