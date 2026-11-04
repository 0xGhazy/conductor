package com.vodafone.vss.weaver.common.language;

import java.time.Instant;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class SupportedLanguageDto {

    private UUID id;

    @NotBlank(message = "Language code is required")
    @Size(min = 2, max = 15, message = "Language code must be between 2 and 15 characters")
    @Pattern(
            regexp = "^[a-zA-Z0-9_-]+$",
            message = "Language code may only contain alphanumeric characters, hyphens, and underscores")
    private String code;

    @NotBlank(message = "Language name is required")
    @Size(max = 100, message = "Language name must not exceed 100 characters")
    private String name;

    private Instant createdAt;
    private Instant updatedAt;

    public static SupportedLanguageDto fromModel(SupportedLanguageModel model) {
        if (model == null) return null;
        return SupportedLanguageDto.builder()
                .id(model.getId())
                .code(model.getCode())
                .name(model.getName())
                .createdAt(model.getCreatedAt())
                .updatedAt(model.getUpdatedAt())
                .build();
    }

    public SupportedLanguageModel toModel() {
        return SupportedLanguageModel.builder()
                .id(this.id)
                .code(this.code)
                .name(this.name)
                .createdAt(this.createdAt)
                .updatedAt(this.updatedAt)
                .build();
    }
}

