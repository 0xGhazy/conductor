package com.vodafone.vss.weaver.secrets.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;

import com.vodafone.vss.weaver.common.Encryption;
import com.vodafone.vss.weaver.common.secrets.SecretException;
import com.vodafone.vss.weaver.common.secrets.SecretModel;
import com.vodafone.vss.weaver.common.secrets.SecretRequest;
import com.vodafone.vss.weaver.common.secrets.SecretResponse;
import com.vodafone.vss.weaver.common.secrets.SecretUpdateRequest;
import com.vodafone.vss.weaver.dao.SecretDAO;

@ExtendWith(MockitoExtension.class)
class SecretServiceTest {

    @Mock
    private SecretDAO secretDAO;

    @Mock
    private Encryption encryption;

    private SecretService service;

    @BeforeEach
    void setUp() {
        service = new SecretService(secretDAO, encryption, List.of());
    }

    @Test
    void testCreateSecretSuccess() {
        SecretRequest req =
                SecretRequest.builder()
                        .name("api_key")
                        .value("supersecretvalue12345")
                        .description("Test key")
                        .build();

        when(secretDAO.existsByName("api_key")).thenReturn(false);
        when(encryption.encRaw("supersecretvalue12345"))
                .thenReturn(new Encryption.Encrypted(new byte[] {1, 2}, new byte[] {3, 4}));

        when(secretDAO.create(any(SecretModel.class)))
                .thenAnswer(
                        inv -> {
                            SecretModel m = inv.getArgument(0);
                            m.setId(UUID.randomUUID());
                            return m;
                        });

        SecretResponse response = service.create(req);
        assertNotNull(response);
        assertEquals("api_key", response.getName());
        assertEquals("${weaver.secrets.api_key}", response.getPlaceholder());
    }

    @Test
    void testCreateSecretAlreadyExistsThrows() {
        SecretRequest req = SecretRequest.builder().name("api_key").value("val").build();
        when(secretDAO.existsByName("api_key")).thenReturn(true);

        assertThrows(SecretException.class, () -> service.create(req));
    }

    @Test
    void testFindAllPaginated() {
        when(secretDAO.findAll(any(), anyInt(), anyInt()))
                .thenReturn(
                        List.of(
                                SecretModel.builder()
                                        .id(UUID.randomUUID())
                                        .name("sec1")
                                        .displayedText("****")
                                        .build()));
        when(secretDAO.count(any())).thenReturn(1L);

        Page<SecretResponse> page = service.findAll(PageRequest.of(0, 10), null);
        assertEquals(1, page.getTotalElements());
        assertEquals("sec1", page.getContent().get(0).getName());
    }

    @Test
    void testUpdateSecret() {
        UUID id = UUID.randomUUID();
        SecretModel existing =
                SecretModel.builder()
                        .id(id)
                        .name("sec1")
                        .version(1L)
                        .encryptedValue(new byte[] {1})
                        .iv(new byte[] {2})
                        .displayedText("****")
                        .build();

        when(secretDAO.findById(id)).thenReturn(Optional.of(existing));
        when(secretDAO.update(any(SecretModel.class))).thenAnswer(inv -> inv.getArgument(0));

        SecretUpdateRequest req =
                SecretUpdateRequest.builder().description("Updated desc").version(1L).build();

        SecretResponse res = service.update(id, req);
        assertEquals("Updated desc", res.getDescription());
    }
}

