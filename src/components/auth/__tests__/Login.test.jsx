import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Login from "../Login";
import AuthLayout from "../AuthLayout";

const renderLogin = (onLogin = jest.fn().mockResolvedValue(true)) => {
  render(
    <MemoryRouter>
      <AuthLayout>
        <Login onLogin={onLogin} />
      </AuthLayout>
    </MemoryRouter>
  );
  return onLogin;
};

describe("Login", () => {
  it("greets with a serif headline, not a bold one", () => {
    renderLogin();

    expect(screen.getByRole("heading", { level: 1, name: "Welcome back" })).toBeInTheDocument();
  });

  // Shared office PCs: a session must not outlive the window unless asked.
  it("leaves keep-me-signed-in off by default", () => {
    renderLogin();

    expect(screen.getByRole("checkbox", { name: /keep me signed in/i })).not.toBeChecked();
    expect(screen.getByText(/Shared computer/)).toBeInTheDocument();
  });

  it("does not pre-fill the password box with dots that look like a saved password", () => {
    renderLogin();

    expect(screen.getByLabelText("Password")).not.toHaveAttribute("placeholder");
  });

  it("passes the remember choice through to sign-in", async () => {
    const onLogin = renderLogin();

    await userEvent.type(screen.getByLabelText("Email or username"), "jun@torres.ph");
    await userEvent.type(screen.getByLabelText("Password"), "secret");
    await userEvent.click(screen.getByRole("checkbox", { name: /keep me signed in/i }));
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(onLogin).toHaveBeenCalledWith("jun@torres.ph", "secret", { remember: true });
  });

  it("shows the message sign-in returns", async () => {
    renderLogin(jest.fn().mockResolvedValue("Invalid email or password."));

    await userEvent.type(screen.getByLabelText("Email or username"), "jun");
    await userEvent.type(screen.getByLabelText("Password"), "nope");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password.");
  });

  it("asks for an empty field before calling the server", async () => {
    const onLogin = renderLogin();

    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(screen.getByRole("alert")).toHaveTextContent("Enter your email or username.");
    expect(onLogin).not.toHaveBeenCalled();
  });
});
