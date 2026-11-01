package com.vodafone.vss.weaver.common.secrets;

import java.util.UUID;

public record SecretMinimal(UUID id, String name, String displayedText, String placeholder) {}

