package com.vodafone.vss.weaver.dao;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.vodafone.vss.weaver.common.language.SupportedLanguageModel;

/**
 * DAO interface for managing application-wide supported languages.
 */
public interface SupportedLanguageDAO {

    SupportedLanguageModel create(SupportedLanguageModel model);

    SupportedLanguageModel update(SupportedLanguageModel model);

    boolean deleteById(UUID id);

    Optional<SupportedLanguageModel> findById(UUID id);

    Optional<SupportedLanguageModel> findByCode(String code);

    List<SupportedLanguageModel> findAll();

    long count();

    void clearDefaultFlagExcept(UUID id);
}

