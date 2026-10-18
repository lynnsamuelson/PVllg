import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import CodeInput from "./CodeInput.jsx";

function Harness() {
  const [value, setValue] = useState("");
  return (
    <>
      <CodeInput value={value} onChange={setValue} />
      <output>{value}</output>
    </>
  );
}

const box = (n) => screen.getByLabelText(`Digit ${n}`);
const value = () => screen.getByRole("status").textContent;

describe("CodeInput", () => {
  it("moves forward as digits are typed and ignores letters", () => {
    render(<Harness />);
    fireEvent.change(box(1), { target: { value: "4" } });
    expect(box(2)).toHaveFocus();
    fireEvent.change(box(2), { target: { value: "x" } });
    fireEvent.change(box(5), { target: { value: "2" } }); // continues from the first empty box
    expect(value()).toBe("42");
    expect(box(3)).toHaveFocus();
  });

  it("replaces a digit typed over a filled box", () => {
    render(<Harness />);
    fireEvent.paste(box(1), { clipboardData: { getData: () => "123456" } });
    fireEvent.change(box(2), { target: { value: "29" } }); // caret before the old digit
    fireEvent.change(box(3), { target: { value: "38" } }); // caret after it
    expect(value()).toBe("198456");
  });

  it("fills every box from a paste or autofill", () => {
    render(<Harness />);
    fireEvent.paste(box(3), { clipboardData: { getData: () => "12 34-56789" } });
    expect(value()).toBe("123456");
    expect(box(6)).toHaveFocus();
    fireEvent.keyDown(box(6), { key: "Backspace" });
    fireEvent.keyDown(box(5), { key: "Backspace" });
    fireEvent.change(box(1), { target: { value: "" } });
    expect(value()).toBe("1234");
  });

  it("puts a whole autofilled code into the boxes", () => {
    render(<Harness />);
    fireEvent.change(box(1), { target: { value: "654321" } });
    expect(value()).toBe("654321");
    fireEvent.change(box(1), { target: { value: "16" } }); // typing over a filled first box isn't autofill
    expect(value()).toBe("154321");
  });

  it("moves on when a key retypes the digit already in a box", () => {
    render(<Harness />);
    fireEvent.paste(box(1), { clipboardData: { getData: () => "000000" } });
    box(1).focus();
    for (const key of "102") fireEvent.keyDown(document.activeElement, { key });
    expect(value()).toBe("102000");
  });

  it("removes just one digit on Backspace in a middle box", () => {
    render(<Harness />);
    fireEvent.paste(box(1), { clipboardData: { getData: () => "123456" } });
    fireEvent.keyDown(box(3), { key: "Backspace" });
    expect(value()).toBe("12456");
    expect(box(3)).toHaveFocus();
  });

  it("goes back on Backspace and stops at the first box", () => {
    render(<Harness />);
    fireEvent.change(box(1), { target: { value: "7" } });
    fireEvent.keyDown(box(2), { key: "Backspace" });
    expect(value()).toBe("");
    expect(box(1)).toHaveFocus();
    fireEvent.keyDown(box(1), { key: "Backspace" });
    fireEvent.keyDown(box(1), { key: "Tab" });
    expect(value()).toBe("");
  });
});
