package com.vodafone.vss.weaver.common.secrets;

import java.util.UUID;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SecretRequest {

    @NotBlank(message = "Secret name is required")
    @Pattern(
            regexp = SecretPlaceholderParser.NAME_REGEX,
            message =
                    "Secret name must start with a letter and contain only letters, digits, '_' or '-' (max 100 chars)")
    private String name;

    @NotBlank(message = "Secret value is required")
    private String value;

    @Size(max = 500, message = "Description must be at most 500 characters")
    private String description;

    private UUID createdBy;
    private UUID updatedBy;

    @Override
    public String toString() {
        return "SecretRequest{name='" + name + "', description='" + description + "'}";
    }
}

