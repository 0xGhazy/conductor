package com.vodafone.vss.weaver.dao;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.vodafone.vss.weaver.common.secrets.SecretMinimal;
import com.vodafone.vss.weaver.common.secrets.SecretModel;

/**
 * DAO interface for managing encrypted secrets.
 */
public interface SecretDAO {

    SecretModel create(SecretModel model);

    SecretModel update(SecretModel model);

    boolean deleteById(UUID id);

    boolean deleteByName(String name);

    Optional<SecretModel> findById(UUID id);

    Optional<SecretModel> findByName(String name);

    boolean existsByName(String name);

    List<SecretModel> findAll(String search, int offset, int limit);

    List<SecretMinimal> findAllMinimal(String search, int offset, int limit);

    List<SecretModel> findAllByNameIn(Collection<String> names);

    long count(String search);

    List<String> listSecretNames();
}

