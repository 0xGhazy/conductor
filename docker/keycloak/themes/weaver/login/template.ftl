<#macro registrationLayout bodyClass="" displayInfo=false displayMessage=true displayRequiredFields=false>
<!DOCTYPE html>
<html data-theme="dark" lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex, nofollow">
    <title>${msg("loginTitle", (realm.displayName!'Weaver'))}</title>
    <link rel="icon" type="image/x-icon" href="${url.resourcesPath}/img/favicon.ico" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300..800;1,300..800&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    
    <#-- Synchronous early theme resolution to eliminate any light/dark flash -->
    <script>
        (function() {
            try {
                var params = new URLSearchParams(window.location.search);
                var themeParam = params.get('theme');
                var resolvedTheme = null;
                if (themeParam === 'dark' || themeParam === 'light') {
                    resolvedTheme = themeParam;
                    try { localStorage.setItem('weaver_theme', themeParam); } catch (e) {}
                } else {
                    try { resolvedTheme = localStorage.getItem('weaver_theme'); } catch (e) {}
                    if (!resolvedTheme) {
                        resolvedTheme = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
                    }
                }
                document.documentElement.setAttribute('data-theme', resolvedTheme || 'dark');
            } catch (err) {
                document.documentElement.setAttribute('data-theme', 'dark');
            }
        })();
    </script>

    <link href="${url.resourcesPath}/css/login.css" rel="stylesheet" />
</head>
<body class="weaver-login-body">
    <#-- Ambient Background Grid & Decorative Workflow Builder Graph -->
    <div class="weaver-workflow-bg" aria-hidden="true">
        <svg class="weaver-canvas-grid" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <pattern id="weaver-grid-dots" width="28" height="28" patternUnits="userSpaceOnUse">
                    <circle cx="2" cy="2" r="1.2" class="grid-dot" />
                </pattern>
                <linearGradient id="coral-flow-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#FF5A5F" stop-opacity="0.75" />
                    <stop offset="50%" stop-color="#FF9B45" stop-opacity="0.55" />
                    <stop offset="100%" stop-color="#5BC8BC" stop-opacity="0.75" />
                </linearGradient>
            </defs>
            <rect width="100%" height="100%" fill="url(#weaver-grid-dots)" />
            
            <#-- Smooth Bézier Workflow Connector Lines -->
            <g class="workflow-connectors">
                <#-- Left side: Trigger -> Condition -> Process -->
                <path d="M 175 190 C 230 190, 190 340, 245 340" class="connector-line" />
                <path d="M 175 190 C 230 190, 190 340, 245 340" class="connector-line-pulse pulse-1" />

                <path d="M 245 425 C 210 470, 170 480, 195 560" class="connector-line" />
                <path d="M 245 425 C 210 470, 170 480, 195 560" class="connector-line-pulse pulse-2" />

                <#-- Connecting across towards card -->
                <path d="M 330 350 C 440 350, 460 280, 520 280" class="connector-line dashed" />

                <#-- Right side: Action -> Database -> Notify -->
                <path d="M 1060 210 C 1140 210, 1120 370, 1180 370" class="connector-line" />
                <path d="M 1060 210 C 1140 210, 1120 370, 1180 370" class="connector-line-pulse pulse-3" />

                <path d="M 1180 450 C 1130 520, 1100 530, 1070 590" class="connector-line" />
                <path d="M 1180 450 C 1130 520, 1100 530, 1070 590" class="connector-line-pulse pulse-4" />

                <#-- Connecting across towards card from right -->
                <path d="M 975 380 C 880 380, 860 300, 800 300" class="connector-line dashed" />
            </g>
        </svg>

        <#-- Decorative Workflow Nodes (Tasteful, subtle, non-intrusive) -->
        <div class="decorative-node node-trigger" style="top: 150px; left: 60px;">
            <div class="node-port port-out"></div>
            <div class="node-header">
                <span class="node-icon icon-trigger">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                    </svg>
                </span>
                <span class="node-tag">Trigger</span>
            </div>
            <div class="node-title">Webhook Request</div>
            <div class="node-detail">POST /api/v1/trigger</div>
        </div>

        <div class="decorative-node node-condition" style="top: 310px; left: 180px;">
            <div class="node-port port-in"></div>
            <div class="node-port port-out"></div>
            <div class="node-header">
                <span class="node-icon icon-condition">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="6" y1="3" x2="6" y2="15"></line>
                        <circle cx="18" cy="6" r="3"></circle>
                        <circle cx="6" cy="18" r="3"></circle>
                        <path d="M18 9a9 9 0 0 1-9 9"></path>
                    </svg>
                </span>
                <span class="node-tag">Condition</span>
            </div>
            <div class="node-title">Verify Payload</div>
            <div class="node-detail">status == "ACTIVE"</div>
        </div>

        <div class="decorative-node node-process" style="top: 530px; left: 110px;">
            <div class="node-port port-in"></div>
            <div class="node-header">
                <span class="node-icon icon-process">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="16 18 22 12 16 6"></polyline>
                        <polyline points="8 6 2 12 8 18"></polyline>
                    </svg>
                </span>
                <span class="node-tag">Process</span>
            </div>
            <div class="node-title">Transform Output</div>
            <div class="node-detail">Format JSON Response</div>
        </div>

        <div class="decorative-node node-action" style="top: 170px; right: 120px;">
            <div class="node-port port-out"></div>
            <div class="node-header">
                <span class="node-icon icon-action">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="2" y1="12" x2="22" y2="12"></line>
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                    </svg>
                </span>
                <span class="node-tag">Action</span>
            </div>
            <div class="node-title">Service Gateway</div>
            <div class="node-detail">REST Endpoint Sync</div>
        </div>

        <div class="decorative-node node-database" style="top: 340px; right: 40px;">
            <div class="node-port port-in"></div>
            <div class="node-port port-out"></div>
            <div class="node-header">
                <span class="node-icon icon-database">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
                        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
                        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
                    </svg>
                </span>
                <span class="node-tag">Database</span>
            </div>
            <div class="node-title">Postgres Store</div>
            <div class="node-detail">Execute Workflow Query</div>
        </div>

        <div class="decorative-node node-notify" style="top: 550px; right: 130px;">
            <div class="node-port port-in"></div>
            <div class="node-header">
                <span class="node-icon icon-notify">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                    </svg>
                </span>
                <span class="node-tag">Notify</span>
            </div>
            <div class="node-title">Audit Dispatcher</div>
            <div class="node-detail">Emit Event Log</div>
        </div>
    </div>

    <#-- Top Navigation Bar with Theme Switcher -->
    <header class="weaver-login-header">
        <button id="weaver-theme-toggle" class="weaver-theme-btn" type="button" aria-label="Toggle theme mode" title="Toggle theme mode">
            <span class="theme-icon icon-sun">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="5"></circle>
                    <line x1="12" y1="1" x2="12" y2="3"></line>
                    <line x1="12" y1="21" x2="12" y2="23"></line>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                    <line x1="1" y1="12" x2="3" y2="12"></line>
                    <line x1="21" y1="12" x2="23" y2="12"></line>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                </svg>
            </span>
            <span class="theme-icon icon-moon">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                </svg>
            </span>
        </button>
    </header>

    <#-- Centered Weaver Authentication Card Shell -->
    <main class="weaver-login-main">
        <div class="weaver-card">
            <div class="weaver-card-header">
                <div class="weaver-brand">
                    <img src="${url.resourcesPath}/img/logo.png" alt="Weaver" class="weaver-logo" />
                    <h1 class="weaver-title">Weaver</h1>
                </div>
                <p class="weaver-subtitle">Sign in to continue to your workflow builder</p>
            </div>

            <#-- Keycloak Feedback / Global Alerts (invalid credentials, session expired, etc.) -->
            <#if displayMessage && message?has_content && (message.type != 'warning' || !isAppInitiatedAction??)>
                <div class="weaver-alert weaver-alert-${message.type}" role="alert">
                    <span class="weaver-alert-icon">
                        <#if message.type = 'error'>
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="8" x2="12" y2="12"></line>
                                <line x1="12" y1="16" x2="12.01" y2="16"></line>
                            </svg>
                        <#elseif message.type = 'warning'>
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                                <line x1="12" y1="9" x2="12" y2="13"></line>
                                <line x1="12" y1="17" x2="12.01" y2="17"></line>
                            </svg>
                        <#elseif message.type = 'success'>
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                <polyline points="22 4 12 14.01 9 11.01"></polyline>
                            </svg>
                        <#else>
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="16" x2="12" y2="12"></line>
                                <line x1="12" y1="8" x2="12.01" y2="8"></line>
                            </svg>
                        </#if>
                    </span>
                    <span class="weaver-alert-text">${kcSanitize(message.summary)?no_esc}</span>
                </div>
            </#if>

            <#-- Render Login Form -->
            <div class="weaver-card-body">
                <#nested "form">
                
                <#if displayInfo>
                    <div class="weaver-card-info">
                        <#nested "info">
                    </div>
                </#if>
            </div>

            <#-- Small Security Footer Note -->
            <footer class="weaver-card-footer">
                <div class="weaver-security-note">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                    <span>Protected authentication powered by Keycloak</span>
                </div>
            </footer>
        </div>
    </main>

    <script src="${url.resourcesPath}/js/theme.js"></script>
</body>
</html>
</#macro>
