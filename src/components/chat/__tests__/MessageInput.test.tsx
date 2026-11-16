import { test, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MessageInput, INPUT_PLACEHOLDER } from "../MessageInput";

afterEach(() => {
  cleanup();
});

test("renders with placeholder text", () => {
  const mockProps = {
    input: "",
    handleInputChange: vi.fn(),
    handleSubmit: vi.fn(),
    isLoading: false,
  };

  render(<MessageInput {...mockProps} />);
  
  const textarea = screen.getByPlaceholderText(INPUT_PLACEHOLDER);
  expect(textarea).toBeDefined();
});

test("displays the input value", () => {
  const mockProps = {
    input: "Test input value",
    handleInputChange: vi.fn(),
    handleSubmit: vi.fn(),
    isLoading: false,
  };

  render(<MessageInput {...mockProps} />);
  
  const textarea = screen.getByDisplayValue("Test input value");
  expect(textarea).toBeDefined();
});

test("calls handleInputChange when typing", async () => {
  const handleInputChange = vi.fn();
  const mockProps = {
    input: "",
    handleInputChange,
    handleSubmit: vi.fn(),
    isLoading: false,
  };

  render(<MessageInput {...mockProps} />);
  
  const textarea = screen.getByPlaceholderText(INPUT_PLACEHOLDER);
  await userEvent.type(textarea, "Hello");
  
  expect(handleInputChange).toHaveBeenCalled();
});

test("calls handleSubmit when form is submitted", async () => {
  const handleSubmit = vi.fn((e) => e.preventDefault());
  const mockProps = {
    input: "Test input",
    handleInputChange: vi.fn(),
    handleSubmit,
    isLoading: false,
  };

  render(<MessageInput {...mockProps} />);
  
  const form = screen.getByRole("textbox").closest("form")!;
  fireEvent.submit(form);
  
  expect(handleSubmit).toHaveBeenCalledOnce();
});

test("submits form when Enter is pressed without shift", async () => {
  const handleSubmit = vi.fn((e) => e.preventDefault());
  const mockProps = {
    input: "Test input",
    handleInputChange: vi.fn(),
    handleSubmit,
    isLoading: false,
  };

  render(<MessageInput {...mockProps} />);
  
  const textarea = screen.getByRole("textbox");
  fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
  
  expect(handleSubmit).toHaveBeenCalledOnce();
});

test("does not submit form when Enter is pressed with shift", async () => {
  const handleSubmit = vi.fn((e) => e.preventDefault());
  const mockProps = {
    input: "Test input",
    handleInputChange: vi.fn(),
    handleSubmit,
    isLoading: false,
  };

  render(<MessageInput {...mockProps} />);
  
  const textarea = screen.getByRole("textbox");
  fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
  
  expect(handleSubmit).not.toHaveBeenCalled();
});

test("disables textarea when isLoading is true", () => {
  const mockProps = {
    input: "",
    handleInputChange: vi.fn(),
    handleSubmit: vi.fn(),
    isLoading: true,
  };

  render(<MessageInput {...mockProps} />);
  
  const textarea = screen.getByRole("textbox");
  expect(textarea).toHaveProperty("disabled", true);
});

test("disables submit button when isLoading is true", () => {
  const mockProps = {
    input: "Test input",
    handleInputChange: vi.fn(),
    handleSubmit: vi.fn(),
    isLoading: true,
  };

  render(<MessageInput {...mockProps} />);
  
  const submitButton = screen.getByRole("button");
  expect(submitButton).toHaveProperty("disabled", true);
});

test("disables submit button when input is empty", () => {
  const mockProps = {
    input: "",
    handleInputChange: vi.fn(),
    handleSubmit: vi.fn(),
    isLoading: false,
  };

  render(<MessageInput {...mockProps} />);
  
  const submitButton = screen.getByRole("button");
  expect(submitButton).toHaveProperty("disabled", true);
});

test("disables submit button when input contains only whitespace", () => {
  const mockProps = {
    input: "   ",
    handleInputChange: vi.fn(),
    handleSubmit: vi.fn(),
    isLoading: false,
  };

  render(<MessageInput {...mockProps} />);
  
  const submitButton = screen.getByRole("button");
  expect(submitButton).toHaveProperty("disabled", true);
});

test("enables submit button when input has content and not loading", () => {
  const mockProps = {
    input: "Valid content",
    handleInputChange: vi.fn(),
    handleSubmit: vi.fn(),
    isLoading: false,
  };

  render(<MessageInput {...mockProps} />);
  
  const submitButton = screen.getByRole("button");
  expect(submitButton).toHaveProperty("disabled", false);
});

test("shows a spinner instead of the arrow while loading", () => {
  const props = { input: "Test", handleInputChange: vi.fn(), handleSubmit: vi.fn() };
  const { rerender } = render(<MessageInput {...props} isLoading={false} />);
  expect(screen.getByRole("button").querySelector("svg")?.getAttribute("class")).not.toContain("animate-spin");

  rerender(<MessageInput {...props} isLoading={true} />);
  expect(screen.getByRole("button").querySelector("svg")?.getAttribute("class")).toContain("animate-spin");
});

test("send button is highlighted only when it can send", () => {
  const props = { handleInputChange: vi.fn(), handleSubmit: vi.fn(), isLoading: false };
  const { rerender } = render(<MessageInput {...props} input="" />);
  expect(screen.getByRole("button").className).not.toContain("from-violet-500");
  rerender(<MessageInput {...props} input="oi" />);
  expect(screen.getByRole("button").className).toContain("from-violet-500");
});

test("submit button click triggers form submission", async () => {
  const handleSubmit = vi.fn((e) => e.preventDefault());
  const mockProps = {
    input: "Test input",
    handleInputChange: vi.fn(),
    handleSubmit,
    isLoading: false,
  };

  render(<MessageInput {...mockProps} />);
  
  const submitButton = screen.getByRole("button");
  await userEvent.click(submitButton);
  
  expect(handleSubmit).toHaveBeenCalledOnce();
});