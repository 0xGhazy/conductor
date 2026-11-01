package com.vodafone.vss.weaver.secrets.service;

import java.util.*;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import com.vodafone.vss.weaver.common.Encryption;
import com.vodafone.vss.weaver.common.secrets.*;
import com.vodafone.vss.weaver.dao.SecretDAO;
import com.vodafone.vss.weaver.secrets.spi.SecretUsageProvider;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.extern.log4j.Log4j2;

@Log4j2
@Service
public class SecretService {

    private final SecretDAO secretDAO;
    private final Encryption encryption;
    private final List<SecretUsageProvider> usageProviders;

    public SecretService(
            SecretDAO secretDAO,
            Encryption encryption,
            @Autowired(required = false) List<SecretUsageProvider> usageProviders) {
        this.secretDAO = secretDAO;
        this.encryption = encryption;
        this.usageProviders = usageProviders != null ? usageProviders : List.of();
    }

    public SecretResponse create(@Valid SecretRequest request) {
        String name = request.getName().trim();
        log.info("Creating secret [{}]", name);

        if (secretDAO.existsByName(name)) {
            throw SecretException.alreadyExists(name);
        }

        Encryption.Encrypted encrypted = encryption.encRaw(request.getValue());
        SecretModel model =
                SecretModel.builder()
                        .name(name)
                        .encryptedValue(encrypted.ciphertext())
                        .iv(encrypted.iv())
                        .displayedText(SecretMasker.mask(request.getValue()))
                        .description(normalizeDescription(request.getDescription()))
                        .build();

        SecretModel saved = secretDAO.create(model);
        log.info("Secret [{}] created with id {}", name, saved.getId());
        return toResponse(saved, 0);
    }

    public Page<SecretResponse> findAll(@NotNull Pageable pageable, String search) {
        int offset = (int) pageable.getOffset();
        int limit = pageable.getPageSize();
        List<SecretModel> list = secretDAO.findAll(search, offset, limit);
        long total = secretDAO.count(search);

        List<SecretResponse> responses = list.stream().map(s -> toResponse(s, null)).toList();
        return new PageImpl<>(responses, pageable, total);
    }

    public Page<SecretMinimal> findAllMinimal(@NotNull Pageable pageable, String search) {
        int offset = (int) pageable.getOffset();
        int limit = pageable.getPageSize();
        List<SecretMinimal> list = secretDAO.findAllMinimal(search, offset, limit);
        long total = secretDAO.count(search);

        return new PageImpl<>(list, pageable, total);
    }

    public SecretResponse findById(@NotNull UUID id) {
        SecretModel secret = getOrThrow(id);
        return toResponse(secret, collectUsages(secret.getName()).size());
    }

    public List<SecretUsage> findUsages(@NotNull UUID id) {
        return collectUsages(getOrThrow(id).getName());
    }

    public SecretResponse update(@NotNull UUID id, @Valid SecretUpdateRequest request) {
        SecretModel secret = getOrThrow(id);
        if (request.getVersion() != null && !Objects.equals(request.getVersion(), secret.getVersion())) {
            throw SecretException.optimisticLock();
        }

        boolean valueChanged = request.getValue() != null && !request.getValue().isBlank();
        if (valueChanged) {
            Encryption.Encrypted encrypted = encryption.encRaw(request.getValue());
            secret.setEncryptedValue(encrypted.ciphertext());
            secret.setIv(encrypted.iv());
            secret.setDisplayedText(SecretMasker.mask(request.getValue()));
        }
        if (request.getDescription() != null) {
            secret.setDescription(normalizeDescription(request.getDescription()));
        }

        SecretModel saved = secretDAO.update(secret);

        if (valueChanged) {
            log.info(
                    "Secret [{}] value changed - notifying {} usage provider(s)",
                    saved.getName(),
                    usageProviders.size());
            usageProviders.forEach(p -> p.onSecretValueChanged(saved.getName()));
        }

        log.info("Secret [{}] updated successfully", saved.getName());
        return toResponse(saved, collectUsages(saved.getName()).size());
    }

    public void delete(@NotNull UUID id) {
        SecretModel secret = getOrThrow(id);
        List<SecretUsage> usages = collectUsages(secret.getName());
        if (!usages.isEmpty()) {
            log.warn("Refusing to delete secret [{}] - referenced by {}", secret.getName(), usages);
            throw SecretException.inUse(secret.getName(), usages);
        }
        secretDAO.deleteById(id);
        log.info("Secret [{}] deleted", secret.getName());
    }

    private List<SecretUsage> collectUsages(String name) {
        List<SecretUsage> usages = new ArrayList<>();
        usageProviders.forEach(p -> usages.addAll(p.findUsages(name)));
        return usages;
    }

    private SecretModel getOrThrow(UUID id) {
        return secretDAO.findById(id).orElseThrow(() -> SecretException.notFound(id));
    }

    private SecretResponse toResponse(SecretModel model, Integer usageCount) {
        if (model == null) return null;
        return SecretResponse.builder()
                .id(model.getId())
                .name(model.getName())
                .displayedText(model.getDisplayedText())
                .description(model.getDescription())
                .placeholder(SecretPlaceholderParser.placeholderFor(model.getName()))
                .usageCount(usageCount)
                .version(model.getVersion())
                .createdAt(model.getCreatedAt())
                .updatedAt(model.getUpdatedAt())
                .build();
    }

    private static String normalizeDescription(String description) {
        return description == null || description.isBlank() ? null : description.trim();
    }
}

