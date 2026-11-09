package com.vodafone.vss.weaver.common.secrets;

import java.util.UUID;

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
public class SecretUpdateRequest {

    private String value;

    @Size(max = 500, message = "Description must be at most 500 characters")
    private String description;

    private Long version;

    private UUID updatedBy;

    @Override
    public String toString() {
        return "SecretUpdateRequest{valueChanged="
                + (value != null && !value.isBlank())
                + ", description='"
                + description
                + "', version="
                + version
                + "}";
    }
}

