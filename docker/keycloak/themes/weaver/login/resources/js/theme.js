/**
 * Weaver Keycloak Theme Client Interactions
 */
document.addEventListener("DOMContentLoaded", function () {
  // 1. Password Visibility Toggle
  var passwordInput = document.getElementById("password");
  var toggleBtn = document.getElementById("weaver-password-toggle");

  if (passwordInput && toggleBtn) {
    var eyeShow = toggleBtn.querySelector(".eye-show");
    var eyeHide = toggleBtn.querySelector(".eye-hide");

    toggleBtn.addEventListener("click", function (e) {
      e.preventDefault();
      var isPassword = passwordInput.getAttribute("type") === "password";
      if (isPassword) {
        passwordInput.setAttribute("type", "text");
        if (eyeShow) eyeShow.style.display = "none";
        if (eyeHide) eyeHide.style.display = "inline-flex";
        toggleBtn.setAttribute("aria-label", "Hide password");
      } else {
        passwordInput.setAttribute("type", "password");
        if (eyeShow) eyeShow.style.display = "inline-flex";
        if (eyeHide) eyeHide.style.display = "none";
        toggleBtn.setAttribute("aria-label", "Show password");
      }
      passwordInput.focus();
    });
  }

  // 2. Light / Dark Theme Switcher Button
  var themeToggleBtn = document.getElementById("weaver-theme-toggle");
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", function (e) {
      e.preventDefault();
      var currentTheme = document.documentElement.getAttribute("data-theme") || "dark";
      var nextTheme = currentTheme === "dark" ? "light" : "dark";

      document.documentElement.setAttribute("data-theme", nextTheme);
      try {
        localStorage.setItem("weaver_theme", nextTheme);
      } catch (err) {}
    });
  }

  // 3. Form Submit State (prevents duplicate submissions)
  var loginForm = document.getElementById("kc-form-login");
  var submitBtn = document.getElementById("kc-login");

  if (loginForm && submitBtn) {
    loginForm.addEventListener("submit", function () {
      submitBtn.setAttribute("disabled", "true");
      submitBtn.textContent = "Signing in...";
      submitBtn.style.opacity = "0.75";
      submitBtn.style.cursor = "wait";
    });
  }

  // 4. Focus Management
  var usernameInput = document.getElementById("username");
  if (usernameInput && !usernameInput.value) {
    usernameInput.focus();
  } else if (passwordInput && usernameInput && usernameInput.value) {
    passwordInput.focus();
  }
});
