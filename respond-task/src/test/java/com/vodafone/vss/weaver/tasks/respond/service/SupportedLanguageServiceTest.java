package com.vodafone.vss.weaver.tasks.respond.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import com.vodafone.vss.weaver.common.exceptions.BusinessException;
import com.vodafone.vss.weaver.common.language.SupportedLanguageDto;
import com.vodafone.vss.weaver.common.language.SupportedLanguageModel;
import com.vodafone.vss.weaver.common.response.ApiResponse;
import com.vodafone.vss.weaver.dao.SupportedLanguageDAO;

@ExtendWith(MockitoExtension.class)
class SupportedLanguageServiceTest {

    @Mock
    private SupportedLanguageDAO dao;

    private SupportedLanguageService service;

    @BeforeEach
    void setUp() {
        service = new SupportedLanguageService(dao);
    }

    @Test
    void testInitDefaultsWhenEmpty() {
        when(dao.count()).thenReturn(0L);

        service.initDefaults();

        verify(dao, times(2)).create(any(SupportedLanguageModel.class));
    }

    @Test
    void testGetAllLanguages() {
        SupportedLanguageModel lang =
                SupportedLanguageModel.builder()
                        .id(UUID.randomUUID())
                        .code("en")
                        .name("English")
                        .isDefault(true)
                        .createdAt(Instant.now())
                        .build();

        when(dao.findAll()).thenReturn(List.of(lang));

        ApiResponse response = service.getAllLanguages();
        assertEquals(HttpStatus.OK, response.getStatus());
        assertNotNull(response.getData());
    }

    @Test
    void testCreateLanguageSuccess() {
        SupportedLanguageDto dto =
                SupportedLanguageDto.builder().code("fr").name("French").isDefault(false).build();

        when(dao.findByCode("fr")).thenReturn(Optional.empty());
        when(dao.create(any(SupportedLanguageModel.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        ApiResponse response = service.createLanguage(dto);
        assertEquals(HttpStatus.CREATED, response.getStatus());
        assertNotNull(response.getData());
    }

    @Test
    void testCreateLanguageAlreadyExists() {
        SupportedLanguageDto dto = SupportedLanguageDto.builder().code("en").build();
        when(dao.findByCode("en"))
                .thenReturn(Optional.of(SupportedLanguageModel.builder().code("en").build()));

        assertThrows(BusinessException.class, () -> service.createLanguage(dto));
    }

    @Test
    void testDeleteDefaultLanguageFails() {
        UUID id = UUID.randomUUID();
        when(dao.findById(id))
                .thenReturn(
                        Optional.of(
                                SupportedLanguageModel.builder()
                                        .id(id)
                                        .code("en")
                                        .isDefault(true)
                                        .build()));

        assertThrows(BusinessException.class, () -> service.deleteLanguage(id));
    }
}

