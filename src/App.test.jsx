import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders the app shell or login page", () => {
  render(<App />);

  expect(
    screen.getByRole("heading", { name: /welcome back|torres pest control/i })
  ).toBeInTheDocument();
});
