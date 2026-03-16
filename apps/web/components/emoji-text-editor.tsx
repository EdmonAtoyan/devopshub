"use client";

import { SmileIcon } from "@/components/icons";
import { apiRequest } from "@/lib/api";
import type { ChangeEventHandler, FocusEventHandler } from "react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type EmojiPickerModule = typeof import("emoji-picker-react");
type EditorElement = HTMLInputElement | HTMLTextAreaElement;
type MentionSuggestion = {
  id: string;
  username: string;
  verified?: boolean;
  name: string;
};
type MentionMatch = {
  start: number;
  end: number;
  query: string;
};
type PickerPosition = {
  top: number;
  left: number;
  width: number;
  height: number;
};

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
  enableMentions?: boolean;
};

const VALID_MENTION_CHAR = /[a-z0-9._-]/i;
const MENTION_TRIGGER_PATTERN = /(^|[\s([{"'<])@([a-z0-9._-]*)$/i;
const PICKER_GAP = 12;
const PICKER_MARGIN = 16;
const PICKER_MAX_WIDTH = 320;
const PICKER_MAX_HEIGHT = 340;

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
  enableMentions = false,
}: EmojiTextEditorProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerModule, setPickerModule] = useState<EmojiPickerModule | null>(null);
  const [pickerPosition, setPickerPosition] = useState<PickerPosition | null>(null);
  const [mentionMatch, setMentionMatch] = useState<MentionMatch | null>(null);
  const [mentionSuggestions, setMentionSuggestions] = useState<MentionSuggestion[]>([]);
  const [mentionLoading, setMentionLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<EditorElement | null>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
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
    if (!pickerOpen && !mentionMatch) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (
        containerRef.current?.contains(event.target as Node) ||
        pickerRef.current?.contains(event.target as Node)
      ) {
        return;
      }

      setPickerOpen(false);
      setMentionMatch(null);
      setMentionSuggestions([]);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      setPickerOpen(false);
      setMentionMatch(null);
      setMentionSuggestions([]);
      inputRef.current?.focus();
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [mentionMatch, pickerOpen]);

  useLayoutEffect(() => {
    if (!pickerOpen) {
      setPickerPosition(null);
      return;
    }

    const updatePickerPosition = () => {
      const trigger = triggerRef.current;

      if (!trigger) {
        return;
      }

      const rect = trigger.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const width = Math.min(PICKER_MAX_WIDTH, Math.max(0, viewportWidth - PICKER_MARGIN * 2));
      const height = Math.min(PICKER_MAX_HEIGHT, Math.max(0, viewportHeight - PICKER_MARGIN * 2));
      const maxLeft = Math.max(PICKER_MARGIN, viewportWidth - width - PICKER_MARGIN);
      const maxTop = Math.max(PICKER_MARGIN, viewportHeight - height - PICKER_MARGIN);

      setPickerPosition({
        left: clamp(rect.right - width, PICKER_MARGIN, maxLeft),
        top: clamp(rect.top - height - PICKER_GAP, PICKER_MARGIN, maxTop),
        width,
        height,
      });
    };

    updatePickerPosition();

    window.addEventListener("resize", updatePickerPosition);
    window.addEventListener("scroll", updatePickerPosition, true);

    return () => {
      window.removeEventListener("resize", updatePickerPosition);
      window.removeEventListener("scroll", updatePickerPosition, true);
    };
  }, [pickerOpen]);

  useEffect(() => {
    if (!enableMentions || !mentionMatch) {
      setMentionSuggestions([]);
      setMentionLoading(false);
      return;
    }

    let active = true;
    setMentionLoading(true);

    const timer = window.setTimeout(() => {
      const path = mentionMatch.query
        ? `search/users?q=${encodeURIComponent(mentionMatch.query)}&limit=6`
        : "search/users?limit=6";

      void apiRequest<MentionSuggestion[]>(path)
        .then((users) => {
          if (!active) {
            return;
          }

          setMentionSuggestions(sortMentionSuggestions(users, mentionMatch.query));
          setMentionLoading(false);
        })
        .catch(() => {
          if (!active) {
            return;
          }

          setMentionSuggestions([]);
          setMentionLoading(false);
        });
    }, 120);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [enableMentions, mentionMatch]);

  useEffect(() => {
    if (mentionMatch) {
      setPickerOpen(false);
    }
  }, [mentionMatch]);

  const syncSelectionState = (nextValue: string, start: number, end: number) => {
    selectionRef.current = { start, end };

    if (!enableMentions) {
      setMentionMatch(null);
      return;
    }

    setMentionMatch(resolveMentionMatch(nextValue, start, end));
  };

  const rememberSelection = () => {
    const target = inputRef.current;

    if (!target) {
      return;
    }

    syncSelectionState(
      value,
      target.selectionStart ?? value.length,
      target.selectionEnd ?? value.length,
    );
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
    setMentionMatch(null);
    setMentionSuggestions([]);

    requestAnimationFrame(() => {
      const editor = inputRef.current;

      if (!editor) {
        return;
      }

      editor.focus();
      editor.setSelectionRange(nextCaretPosition, nextCaretPosition);
    });
  };

  const insertMention = (suggestion: MentionSuggestion) => {
    if (!mentionMatch) {
      return;
    }

    const before = value.slice(0, mentionMatch.start);
    const after = value.slice(mentionMatch.end);
    const needsTrailingSpace = after.length === 0 || !/^[\s.,!?;:)\]}]/.test(after);
    const spacer = needsTrailingSpace ? " " : "";
    const nextValue = `${before}@${suggestion.username}${spacer}${after}`;
    const nextCaretPosition = before.length + suggestion.username.length + 1 + spacer.length;

    onValueChange(nextValue);
    selectionRef.current = { start: nextCaretPosition, end: nextCaretPosition };
    setMentionMatch(null);
    setMentionSuggestions([]);

    requestAnimationFrame(() => {
      const editor = inputRef.current;

      if (!editor) {
        return;
      }

      editor.focus();
      editor.setSelectionRange(nextCaretPosition, nextCaretPosition);
    });
  };

  const handleChange: ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement> = (event) => {
    const nextValue = event.target.value;
    const start = event.target.selectionStart ?? nextValue.length;
    const end = event.target.selectionEnd ?? start;

    onValueChange(nextValue);
    syncSelectionState(nextValue, start, end);
  };

  const handleBlur: FocusEventHandler<HTMLInputElement | HTMLTextAreaElement> = () => {
    rememberSelection();

    window.setTimeout(() => {
      if (containerRef.current?.contains(document.activeElement)) {
        return;
      }

      setMentionMatch(null);
      setMentionSuggestions([]);
    }, 0);
  };

  const EmojiPicker = pickerModule?.default;
  const showMentionSuggestions = enableMentions && mentionMatch && (mentionLoading || mentionSuggestions.length > 0);
  const pickerPortal =
    pickerOpen && pickerPosition && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={pickerRef}
            id={pickerId}
            className="emoji-picker-popover emoji-picker-popover-portal menu-pop"
            role="dialog"
            aria-label="Emoji picker"
            style={{
              top: pickerPosition.top,
              left: pickerPosition.left,
              width: pickerPosition.width,
              maxHeight: pickerPosition.height,
            }}
          >
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
                height={pickerPosition.height}
              />
            ) : (
              <div className="emoji-picker-loading">Loading emojis...</div>
            )}
          </div>,
          document.body,
        )
      : null;

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
    onBlur: handleBlur,
  };

  return (
    <>
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
          ref={triggerRef}
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
          onClick={() => {
            setMentionMatch(null);
            setMentionSuggestions([]);
            setPickerOpen((current) => !current);
          }}
        >
          <SmileIcon size={18} />
        </button>

        {showMentionSuggestions ? (
          <div className="mention-suggestions menu-pop" role="listbox" aria-label="Mention suggestions">
            {mentionSuggestions.map((suggestion) => (
              <button
                key={suggestion.id}
                type="button"
                className="mention-suggestion"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => insertMention(suggestion)}
              >
                <span className="mention-suggestion-copy">
                  <span className="mention-suggestion-username">@{suggestion.username}</span>
                  <span className="mention-suggestion-name">{suggestion.name}</span>
                </span>
              </button>
            ))}
            {mentionLoading ? <div className="mention-suggestion-empty">Searching users...</div> : null}
          </div>
        ) : null}
      </div>

      {pickerPortal}
    </>
  );
}

function resolveMentionMatch(text: string, start: number, end: number) {
  if (start !== end) {
    return null;
  }

  const beforeCursor = text.slice(0, start);
  const triggerMatch = beforeCursor.match(MENTION_TRIGGER_PATTERN);
  if (!triggerMatch) {
    return null;
  }

  const mentionStart = start - triggerMatch[2].length - 1;
  let mentionEnd = start;

  while (mentionEnd < text.length && VALID_MENTION_CHAR.test(text[mentionEnd])) {
    mentionEnd += 1;
  }

  return {
    start: mentionStart,
    end: mentionEnd,
    query: text.slice(mentionStart + 1, mentionEnd).toLowerCase(),
  };
}

function sortMentionSuggestions(users: MentionSuggestion[], query: string) {
  const term = query.trim().toLowerCase();
  if (!term) {
    return users;
  }

  const score = (user: MentionSuggestion) => {
    const username = user.username.toLowerCase();
    const name = user.name.toLowerCase();

    if (username === term) return 5;
    if (username.startsWith(term)) return 4;
    if (name.startsWith(term)) return 3;
    if (username.includes(term)) return 2;
    if (name.includes(term)) return 1;
    return 0;
  };

  return [...users].sort((left, right) => score(right) - score(left) || left.username.localeCompare(right.username));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
