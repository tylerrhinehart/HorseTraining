import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import App from "./App";
import "./index.css";
import { AuthProvider } from "./auth/AuthProvider";
import { initAppearance } from "./state/appearance";

initAppearance();

const basename = import.meta.env.BASE_URL.replace(/\/$/, "");

const router = createBrowserRouter([{ path: "*", element: <AuthProvider><App /></AuthProvider> }], { basename });
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><RouterProvider router={router} /></React.StrictMode>,
);
