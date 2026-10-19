FROM azul/zulu-openjdk-debian:21

WORKDIR /workspace/conductor
COPY . /workspace/conductor

RUN sh ./mvnw clean package -DskipTests -B --no-transfer-progress

