"use client";

import { SmileIcon } from "@/components/icons";
import type { ChangeEventHandler } from "react";
import { useEffect, useId, useRef, useState } from "react";

type EmojiPickerModule = typeof import("emoji-picker-react");
type EditorElement = HTMLInputElement | HTMLTextAreaElement;

type EmojiTextEditorProps = {
  value: string;
  onValueChange: (nextValue: string) => void;
  className?: string;
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
  required?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  rows?: number;
  ariaLabel?: string;
};

export function EmojiTextEditor({
  value,
  onValueChange,
  className = "",
  placeholder,
  multiline = false,
  maxLength,
  required,
  disabled,
  autoFocus,
  rows,
  ariaLabel,
}: EmojiTextEditorProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerModule, setPickerModule] = useState<EmojiPickerModule | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<EditorElement | null>(null);
  const selectionRef = useRef({ start: value.length, end: value.length });
  const pickerId = useId();

  useEffect(() => {
    if (!pickerOpen || pickerModule) {
      return;
    }

    let active = true;

    void import("emoji-picker-react").then((module) => {
      if (active) {
        setPickerModule(module);
      }
    });

    return () => {
      active = false;
    };
  }, [pickerModule, pickerOpen]);

  useEffect(() => {
    if (!pickerOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current?.contains(event.target as Node)) {
        return;
      }

      setPickerOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      setPickerOpen(false);
      inputRef.current?.focus();
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [pickerOpen]);

  const rememberSelection = () => {
    const target = inputRef.current;

    if (!target) {
      return;
    }

    selectionRef.current = {
      start: target.selectionStart ?? value.length,
      end: target.selectionEnd ?? value.length,
    };
  };

  const insertEmoji = (emoji: string) => {
    const target = inputRef.current;
    const fallbackPosition = value.length;
    const start = Math.min(target?.selectionStart ?? selectionRef.current.start ?? fallbackPosition, value.length);
    const end = Math.min(Math.max(target?.selectionEnd ?? selectionRef.current.end ?? fallbackPosition, start), value.length);
    const nextValue = `${value.slice(0, start)}${emoji}${value.slice(end)}`;
    const nextCaretPosition = start + emoji.length;

    onValueChange(nextValue);
    selectionRef.current = { start: nextCaretPosition, end: nextCaretPosition };
    setPickerOpen(false);

    requestAnimationFrame(() => {
      const editor = inputRef.current;

      if (!editor) {
        return;
      }

      editor.focus();
      editor.setSelectionRange(nextCaretPosition, nextCaretPosition);
    });
  };

  const handleChange: ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement> = (event) => onValueChange(event.target.value);
  const EmojiPicker = pickerModule?.default;

  const sharedProps = {
    className: `${className} emoji-editor-field`.trim(),
    placeholder,
    value,
    maxLength,
    required,
    disabled,
    autoFocus,
    "aria-label": ariaLabel,
    onChange: handleChange,
    onSelect: rememberSelection,
    onClick: rememberSelection,
    onKeyUp: rememberSelection,
    onBlur: rememberSelection,
  };

  return (
    <div ref={containerRef} className="emoji-editor">
      {multiline ? (
        <textarea
          ref={(node) => {
            inputRef.current = node;
          }}
          rows={rows}
          {...sharedProps}
        />
      ) : (
        <input
          ref={(node) => {
            inputRef.current = node;
          }}
          type="text"
          {...sharedProps}
        />
      )}

      <button
        type="button"
        className={`emoji-trigger ${multiline ? "emoji-trigger-multiline" : ""} ${pickerOpen ? "is-open" : ""}`.trim()}
        aria-label="Insert emoji"
        aria-expanded={pickerOpen}
        aria-controls={pickerOpen ? pickerId : undefined}
        title="Insert emoji"
        onMouseDown={(event) => {
          event.preventDefault();
          rememberSelection();
        }}
        onClick={() => setPickerOpen((current) => !current)}
      >
        <SmileIcon size={18} />
      </button>

      {pickerOpen ? (
        <div id={pickerId} className="emoji-picker-popover menu-pop" role="dialog" aria-label="Emoji picker">
          {pickerModule && EmojiPicker ? (
            <EmojiPicker
              onEmojiClick={(emojiData) => insertEmoji(emojiData.emoji)}
              emojiStyle={pickerModule.EmojiStyle.NATIVE}
              theme={pickerModule.Theme.DARK}
              lazyLoadEmojis
              searchDisabled
              skinTonesDisabled
              previewConfig={{ showPreview: false }}
              width="100%"
              height={340}
            />
          ) : (
            <div className="emoji-picker-loading">Loading emojis...</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
