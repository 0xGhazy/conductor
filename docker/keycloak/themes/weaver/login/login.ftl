<#import "template.ftl" as layout>
<@layout.registrationLayout displayMessage=true; section>
    <#if section = "header">
        Weaver
    <#elseif section = "form">
        <div id="kc-form">
            <div id="kc-form-wrapper">
                <#if realm.password>
                    <form id="kc-form-login" onsubmit="login.disabled = true; return true;" action="${url.loginAction}" method="post" autocomplete="on">
                        <#if !usernameHidden??>
                            <div class="weaver-form-field">
                                <label for="username" class="weaver-label">
                                    <#if !realm.loginWithEmailAllowed>
                                        ${msg("username")}
                                    <#elseif !realm.registrationEmailAsUsername>
                                        ${msg("usernameOrEmail")}
                                    <#else>
                                        ${msg("email")}
                                    </#if>
                                </label>
                                <div class="weaver-input-wrapper">
                                    <input 
                                        tabindex="1" 
                                        id="username" 
                                        class="weaver-input <#if messagesPerField.existsError('username','password')>has-error</#if>" 
                                        name="username" 
                                        value="${(login.username!'')}" 
                                        type="text" 
                                        autofocus 
                                        autocomplete="username"
                                        placeholder="Enter your username or email"
                                        required
                                        aria-invalid="<#if messagesPerField.existsError('username','password')>true<#else>false</#if>"
                                        dir="ltr"
                                    />
                                </div>
                            </div>
                        </#if>

                        <div class="weaver-form-field">
                            <label for="password" class="weaver-label">${msg("password")}</label>
                            <div class="weaver-input-wrapper weaver-password-wrapper" dir="ltr">
                                <input 
                                    tabindex="2" 
                                    id="password" 
                                    class="weaver-input <#if messagesPerField.existsError('username','password')>has-error</#if>" 
                                    name="password" 
                                    type="password" 
                                    autocomplete="current-password"
                                    placeholder="Enter your password"
                                    required
                                    aria-invalid="<#if messagesPerField.existsError('username','password')>true<#else>false</#if>"
                                />
                                <button 
                                    type="button" 
                                    id="weaver-password-toggle" 
                                    class="weaver-password-toggle" 
                                    aria-label="Show password" 
                                    tabindex="3"
                                >
                                    <svg class="eye-icon eye-show" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                        <circle cx="12" cy="12" r="3"></circle>
                                    </svg>
                                    <svg class="eye-icon eye-hide" style="display:none;" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                                        <line x1="1" y1="1" x2="23" y2="23"></line>
                                    </svg>
                                </button>
                            </div>

                            <#if messagesPerField.existsError('username','password')>
                                <span id="input-error" class="weaver-field-error" aria-live="polite">
                                    ${kcSanitize(messagesPerField.getFirstError('username','password'))?no_esc}
                                </span>
                            </#if>
                        </div>

                        <div class="weaver-form-actions">
                            <input type="hidden" id="id-hidden-input" name="credentialId" <#if auth.selectedCredential?has_content>value="${auth.selectedCredential}"</#if>/>
                            <button 
                                tabindex="4" 
                                class="weaver-btn-primary" 
                                name="login" 
                                id="kc-login" 
                                type="submit"
                            >
                                Sign in
                            </button>
                        </div>
                    </form>
                </#if>
            </div>
        </div>
    </#if>
</@layout.registrationLayout>
