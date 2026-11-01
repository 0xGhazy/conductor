package com.vodafone.vss.weaver.secrets.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.vodafone.vss.weaver.common.Encryption;
import com.vodafone.vss.weaver.common.secrets.SecretException;
import com.vodafone.vss.weaver.common.secrets.SecretModel;
import com.vodafone.vss.weaver.dao.SecretDAO;

@ExtendWith(MockitoExtension.class)
class SecretResolverTest {

    @Mock
    private SecretDAO secretDAO;

    @Mock
    private Encryption encryption;

    private SecretResolver resolver;

    @BeforeEach
    void setUp() {
        resolver = new SecretResolver(secretDAO, encryption);
    }

    @Test
    void testResolveString() {
        byte[] iv = new byte[] {1};
        byte[] cipher = new byte[] {2};

        SecretModel secret =
                SecretModel.builder()
                        .id(UUID.randomUUID())
                        .name("db_pass")
                        .encryptedValue(cipher)
                        .iv(iv)
                        .build();

        when(secretDAO.findAllByNameIn(any())).thenReturn(List.of(secret));
        when(encryption.decRaw(iv, cipher)).thenReturn("my_password");

        String input = "jdbc:postgresql://host:5432/db?password=${weaver.secrets.db_pass}";
        String resolved = resolver.resolve(input);

        assertEquals("jdbc:postgresql://host:5432/db?password=my_password", resolved);
    }

    @Test
    void testResolveMissingSecretThrows() {
        when(secretDAO.findAllByNameIn(any())).thenReturn(List.of());

        String input = "${weaver.secrets.unknown_key}";
        assertThrows(SecretException.class, () -> resolver.resolve(input));
    }

    @Test
    void testResolveMap() {
        byte[] iv = new byte[] {1};
        byte[] cipher = new byte[] {2};

        SecretModel secret =
                SecretModel.builder()
                        .id(UUID.randomUUID())
                        .name("token")
                        .encryptedValue(cipher)
                        .iv(iv)
                        .build();

        when(secretDAO.findAllByNameIn(any())).thenReturn(List.of(secret));
        when(encryption.decRaw(iv, cipher)).thenReturn("secret_token_123");

        Map<String, Object> input = Map.of("auth", "Bearer ${weaver.secrets.token}");
        Map<String, Object> resolved = resolver.resolve(input);

        assertEquals("Bearer secret_token_123", resolved.get("auth"));
    }
}

