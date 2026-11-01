import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/App";
import AppProviders from "@/context/AppProviders";
import { installFetchInterceptor } from "@/services/fetchInterceptor";

installFetchInterceptor();

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error('Root element "#root" not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </React.StrictMode>
);
