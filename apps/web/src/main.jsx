// Path: goviet247/apps/web/src/main.jsx

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import "./index.css";
import App from "./App.jsx";

import { CustomerAuthProvider } from "./context/CustomerAuthContext.jsx";
import { initializeAdminSocketBridge } from "./services/adminSocket.js";

initializeAdminSocketBridge();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <CustomerAuthProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </CustomerAuthProvider>
  </StrictMode>
);