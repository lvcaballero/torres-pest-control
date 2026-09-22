// Signatures are uploaded images too, and used to be the one kind with no way
// to see them full size — they rendered at 100px and were not clickable.

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SignaturePreview from "../SignaturePreview";
import { isImageFile } from "../ImagePreviewModal";

describe("SignaturePreview", () => {
  it("waits for the signed URL before showing anything", () => {
    render(<SignaturePreview url="" alt="Customer signature" />);
    expect(screen.getByText("Loading signature…")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("enlarges into the lightbox on click, without opening a tab", async () => {
    const openSpy = jest.spyOn(window, "open").mockImplementation(() => null);
    render(<SignaturePreview url="blob:sig" alt="Customer signature" name="Customer signature" />);

    await userEvent.click(screen.getByRole("button", { name: "Enlarge customer signature" }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAttribute("aria-label", "Preview of Customer signature");
    expect(openSpy).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Close preview" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    openSpy.mockRestore();
  });

  it("offers no download, because the signature is not a file the user attached", async () => {
    render(<SignaturePreview url="blob:sig" alt="Technician signature" />);
    await userEvent.click(screen.getByRole("button", { name: "Enlarge technician signature" }));
    expect(screen.queryByRole("button", { name: "Download" })).not.toBeInTheDocument();
  });
});

describe("isImageFile", () => {
  it("trusts the MIME type when Storage gave us one", () => {
    expect(isImageFile({ type: "image/png", name: "scan" })).toBe(true);
    expect(isImageFile({ type: "application/pdf", name: "contract.pdf" })).toBe(false);
  });

  it("falls back to the extension, case-insensitively", () => {
    expect(isImageFile({ name: "BEFORE.JPEG" })).toBe(true);
    expect(isImageFile({ name: "after.webp" })).toBe(true);
    expect(isImageFile({ name: "plan.gif" })).toBe(true);
    expect(isImageFile({ name: "report.docx" })).toBe(false);
  });

  it("is safe on nothing", () => {
    expect(isImageFile(null)).toBe(false);
    expect(isImageFile({})).toBe(false);
  });
});
