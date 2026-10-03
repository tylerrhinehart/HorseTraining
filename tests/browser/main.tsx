import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AuthProvider } from "../../src/auth/AuthProvider";
import App from "../../src/App";
import "../../src/index.css";
const router = createBrowserRouter([{path:"*",element:<AuthProvider><App /></AuthProvider>}]);
ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><RouterProvider router={router}/></React.StrictMode>);
