"use client";

import { useEffect, useId, useRef, useState } from "react";

export type SelectOption = { value: string; label: string };

export function BrandSelect({
  value,
  onChange,
  options,
  ariaLabel
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  function openMenu() {
    setActiveIndex(Math.max(0, options.findIndex((option) => option.value === value)));
    setOpen(true);
  }

  function commit(index: number) {
    const option = options[index];
    if (option) onChange(option.value);
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open && (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      openMenu();
      return;
    }
    if (!open) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) => Math.min(options.length - 1, prev + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => Math.max(0, prev - 1));
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      commit(activeIndex);
    }
  }

  return (
    <div className="brand-select" ref={ref}>
      <button
        type="button"
        className={`brand-select-trigger${open ? " brand-select-trigger--open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
      >
        <span className="brand-select-value">{selected?.label}</span>
        <span className="brand-select-chevron" aria-hidden />
      </button>

      {open ? (
        <ul className="brand-select-panel" role="listbox" id={listId} aria-label={ariaLabel}>
          {options.map((option, index) => {
            const isSelected = option.value === value;
            const isActive = index === activeIndex;
            return (
              <li
                key={option.value || "default"}
                role="option"
                aria-selected={isSelected}
                className={`brand-select-option${isSelected ? " brand-select-option--selected" : ""}${isActive ? " brand-select-option--active" : ""}`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => commit(index)}
              >
                <span className="brand-select-check" aria-hidden>{isSelected ? <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden><path d="M2 6.5l2.5 2.5L10 3.5" stroke="currentColor" strokeWidth="1.8" /></svg> : null}</span>
                {option.label}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
