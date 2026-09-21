// Sidebar + content shell for every authenticated page.
//
// This markup used to be inlined in App.js around <Routes>. As a component it
// can wrap routes individually, which is what lets the login and landing
// pages opt out of the chrome.

import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import { layout } from "../../styles/tokens";
import { appBackground } from "../../styles/theme";

function Layout({ children }) {
  return (
    <div className="app-shell" style={{ background: appBackground }}>
      <Sidebar />
      <div
        className="app-content"
        style={{ padding: "30px 30px 45px" }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && event.target.tagName !== "TEXTAREA") event.preventDefault();
        }}
      >
        {/* One max-width, matching pageShell. The inner wrapper used to be
            1280px while every page also applied pageShell's 1200px, so the
            outer constraint never did anything. */}
        <div style={{ maxWidth: layout.pageMaxWidth, margin: "0 auto" }}>
          <Navbar />
          {children || <Outlet />}
        </div>
      </div>
    </div>
  );
}

export default Layout;
