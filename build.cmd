@echo off
set "JAVA_HOME=C:\Users\TawfikH\.antigravity\extensions\redhat.java-1.55.0-win32-x64\jre\21.0.11-win32-x86_64"
set "PATH=%JAVA_HOME%\bin;%PATH%"
call "%~dp0mvnw.cmd" %*
