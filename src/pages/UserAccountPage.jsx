// The signed-in user's own profile route (/account).
//
// This is the single copy — the earlier structure had UserAccountPage listed
// under both pages/ and components/users/, which is how the previous set of
// duplicate files came about. The form half is components/users/ProfileForm.

import { useSearchParams } from "react-router-dom";
import ProfileForm from "../components/users/ProfileForm";
import ChangePassword from "../components/settings/ChangePassword";
import useAuth from "../hooks/useAuth";
import useUsers from "../hooks/useUsers";
import { useToast } from "../context/ToastContext";
import { card, pageShell } from "../styles/theme";

function UserAccountPage() {
  const { currentUser } = useAuth();
  const { updateProfile, changeOwnPassword } = useUsers();
  const { showSuccess, showError } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = searchParams.get("tab") === "security" ? "security" : "profile";

  const handleProfileSubmit = async (fields) => {
    const result = await updateProfile(fields);
    if (result === true) showSuccess("Your profile has been updated.");
    else showError(result);
  };

  const handleChangePassword = async (currentPassword, newPassword) => {
    const result = await changeOwnPassword(currentPassword, newPassword);
    if (result === true) {
      showSuccess("Your password has been updated. Please sign in again.");
      return true;
    }
    return result;
  };

  if (!currentUser) {
    return (
      <div style={pageShell}>
        <div style={card}>No active user found.</div>
      </div>
    );
  }

  return (
    <div style={pageShell}>
      <div style={{ maxWidth: "42rem", width: "100%", margin: "0 auto" }}>
        {activeTab === "profile" && (
          <ProfileForm
            user={currentUser}
            onSubmit={handleProfileSubmit}
            activeTab={activeTab}
            onTabChange={(nextTab) => setSearchParams(nextTab === "security" ? { tab: "security" } : {})}
          />
        )}

        {activeTab === "security" && (
          <div style={{ maxWidth: "42rem", width: "100%", margin: "0 auto" }}>
            <div
              style={{
                background: "#ffffff",
                border: "1px solid rgba(148, 163, 184, 0.24)",
                borderRadius: "1.5rem",
                boxShadow: "0 10px 28px rgba(15, 23, 42, 0.04)",
                padding: "2rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: "0.5rem",
                  marginBottom: "1.5rem",
                  padding: "0.35rem",
                  borderRadius: "999px",
                  background: "#f8fafc",
                  border: "1px solid rgba(148, 163, 184, 0.18)",
                }}
              >
                <button
                  type="button"
                  onClick={() => setSearchParams({})}
                  style={{
                    padding: "0.55rem 1.25rem",
                    borderRadius: "999px",
                    border: "none",
                    background: "transparent",
                    color: "#64748b",
                    fontWeight: 500,
                    fontSize: "0.84rem",
                    cursor: "pointer",
                  }}
                >
                  Profile Information
                </button>
                <button
                  type="button"
                  onClick={() => setSearchParams({ tab: "security" })}
                  style={{
                    padding: "0.55rem 1.25rem",
                    borderRadius: "999px",
                    border: "none",
                    background: "#fef2f2",
                    color: "#7f1d1d",
                    fontWeight: 700,
                    fontSize: "0.84rem",
                    cursor: "pointer",
                  }}
                >
                  Security & Password
                </button>
              </div>
              <ChangePassword onSubmit={handleChangePassword} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default UserAccountPage;
