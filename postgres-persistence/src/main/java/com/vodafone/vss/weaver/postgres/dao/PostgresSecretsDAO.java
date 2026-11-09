package com.vodafone.vss.weaver.postgres.dao;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import com.vodafone.vss.weaver.dao.SecretsDAO;
import com.vodafone.vss.weaver.model.secret.CredentialMeta;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import com.vodafone.vss.weaver.common.Encryption;
import com.vodafone.vss.weaver.common.secrets.SecretMasker;
import com.vodafone.vss.weaver.common.secrets.SecretModel;
import com.vodafone.vss.weaver.dao.SecretDAO;

@Component
@ConditionalOnProperty(name = "weaver.secrets.type", havingValue = "postgres")
public class PostgresSecretsDAO implements SecretsDAO {

    private final SecretDAO secretDAO;
    private final Encryption encryption;

    public PostgresSecretsDAO(SecretDAO secretDAO, Encryption encryption) {
        this.secretDAO = secretDAO;
        this.encryption = encryption;
    }

    @Override
    public String getSecret(String name) {
        Optional<SecretModel> opt = secretDAO.findByName(name);
        if (opt.isEmpty()) {
            return null;
        }
        SecretModel secret = opt.get();
        return encryption.decRaw(secret.getIv(), secret.getEncryptedValue());
    }

    @Override
    public boolean secretExists(String name) {
        return secretDAO.existsByName(name);
    }

    @Override
    public List<String> listSecretNames() {
        return secretDAO.listSecretNames();
    }

    @Override
    public void putSecret(String name, String value) {
        Encryption.Encrypted enc = encryption.encRaw(value);
        Optional<SecretModel> existing = secretDAO.findByName(name);
        if (existing.isPresent()) {
            SecretModel model = existing.get();
            model.setEncryptedValue(enc.ciphertext());
            model.setIv(enc.iv());
            model.setDisplayedText(SecretMasker.mask(value));
            secretDAO.update(model);
        } else {
            SecretModel model =
                    SecretModel.builder()
                            .name(name)
                            .encryptedValue(enc.ciphertext())
                            .iv(enc.iv())
                            .displayedText(SecretMasker.mask(value))
                            .build();
            secretDAO.create(model);
        }
    }

    @Override
    public void deleteSecret(String name) {
        secretDAO.deleteByName(name);
    }

    @Override
    public List<CredentialMeta> listWithMeta() {
        List<SecretModel> all = secretDAO.findAll(null, 0, 1000);
        List<CredentialMeta> result = new ArrayList<>();
        for (SecretModel s : all) {
            result.add(
                    CredentialMeta.builder()
                            .name(s.getName())
                            .partial(s.getDisplayedText())
                            .createdAt(s.getCreatedAt())
                            .updatedAt(s.getUpdatedAt())
                            .build());
        }
        return result;
    }
}

