import { render, screen } from "@testing-library/react";
import App from "./App";

// App has three top-level outcomes, and which one you get depends on the
// environment rather than on anything the test controls: without
// REACT_APP_SUPABASE_URL / _PUBLISHABLE_KEY it renders the setup screen, and
// with them it renders the router, which lands on either the login page or
// the authenticated shell. A fresh clone has no .env.local, so asserting only
// the latter two made this fail for every new contributor.
//
// The useful assertion is that App mounts and renders *a* heading rather than
// throwing, which is what a smoke test is for.
test("renders a top-level screen without crashing", () => {
  render(<App />);

  expect(
    screen.getByRole("heading", {
      name: /welcome back|torres pest control|supabase configuration required/i,
    })
  ).toBeInTheDocument();
});
