import React from "react";
import ReactDOM from "react-dom/client";
import VendorApp from "./vendor/VendorApp";
import "./i18n/i18n";
import "./index.css";
import "leaflet/dist/leaflet.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <VendorApp />
  </React.StrictMode>
);
