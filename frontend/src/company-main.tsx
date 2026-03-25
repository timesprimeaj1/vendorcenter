import React from "react";
import ReactDOM from "react-dom/client";
import AdminApp from "./admin/AdminApp";
import "./i18n/i18n";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AdminApp />
  </React.StrictMode>
);
