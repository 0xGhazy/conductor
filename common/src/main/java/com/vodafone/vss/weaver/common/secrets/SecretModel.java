package com.vodafone.vss.weaver.common.secrets;

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
public class SecretModel {
    private UUID id;
    private String name;
    private byte[] encryptedValue;
    private byte[] iv;
    private String displayedText;
    private String description;
    @Builder.Default
    private Long version = 0L;
    private UUID createdBy;
    private UUID updatedBy;
    private Instant createdAt;
    private Instant updatedAt;
}

