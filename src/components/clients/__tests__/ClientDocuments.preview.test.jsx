// Clicking an uploaded image must open the in-app lightbox, never a new tab.
//
// ClientDocuments renders four different layouts from one component and only
// the tile one carried a lightbox; the others fell through to window.open().
// Every layout is covered here because the difference between them is exactly
// where the regression lived.

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ClientDocuments from "../ClientDocuments";

const photo = {
  id: "f1",
  name: "before-kitchen.jpg",
  type: "image/jpeg",
  size: 12345,
  uploadedAt: "2026-09-01T02:00:00.000Z",
  category: "BEFORE",
};

const pdf = {
  id: "f2",
  name: "contract.pdf",
  type: "application/pdf",
  size: 2048,
  uploadedAt: "2026-09-01T02:00:00.000Z",
  category: "CONTRACT",
};

let openSpy;
let resolveUrl;

beforeEach(() => {
  openSpy = jest.spyOn(window, "open").mockImplementation(() => null);
  resolveUrl = jest.fn(async () => ({ url: "https://storage.example/signed.jpg" }));
});

afterEach(() => {
  openSpy.mockRestore();
});

function renderDocs(props = {}) {
  return render(
    <ClientDocuments
      documents={[photo]}
      onResolveUrl={resolveUrl}
      onUpload={jest.fn()}
      onRemove={jest.fn()}
      {...props}
    />
  );
}

// The roomy layout (Client Profile) and the compact one (Scheduling's
// Documents tab) both label the control "Preview"; the tile layout uses an
// icon button titled "Preview".
async function clickPreview() {
  await userEvent.click(screen.getByRole("button", { name: "Preview" }));
}

describe.each([
  ["roomy layout", {}],
  ["compact layout", { compact: true }],
  ["tile layout", { variant: "tile" }],
])("ClientDocuments image preview — %s", (_label, layoutProps) => {
  it("opens the lightbox instead of a new tab", async () => {
    renderDocs(layoutProps);
    await clickPreview();

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAttribute("aria-label", "Preview of before-kitchen.jpg");
    // Scoped to the dialog: the tile layout also renders a row thumbnail of
    // the same image.
    await waitFor(() =>
      expect(within(dialog).getByAltText("before-kitchen.jpg")).toHaveAttribute(
        "src",
        "https://storage.example/signed.jpg"
      )
    );
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("closes on the close button", async () => {
    renderDocs(layoutProps);
    await clickPreview();
    await screen.findByRole("dialog");

    await userEvent.click(screen.getByRole("button", { name: "Close preview" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    renderDocs(layoutProps);
    await clickPreview();
    await screen.findByRole("dialog");

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("still sends a PDF to the browser, which an img cannot render", async () => {
    renderDocs({ ...layoutProps, documents: [pdf] });
    await clickPreview();

    await waitFor(() => expect(openSpy).toHaveBeenCalled());
    expect(openSpy.mock.calls[0][1]).toBe("_blank");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("downloads from inside the lightbox without closing it", async () => {
    renderDocs(layoutProps);
    await clickPreview();
    const dialog = await screen.findByRole("dialog");

    await userEvent.click(within(dialog).getByRole("button", { name: "Download" }));
    await waitFor(() => expect(openSpy).toHaveBeenCalled());
    expect(openSpy.mock.calls[0][1]).toBe("_self");
    expect(resolveUrl).toHaveBeenCalledWith(photo, { download: true });
  });
});
