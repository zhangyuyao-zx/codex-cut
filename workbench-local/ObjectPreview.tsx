import React from "react";
export function ObjectPreview({
  objects,
  selected,
  onSelect,
  children,
}: {
  objects: any[];
  selected: string;
  onSelect: (id: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="object-preview"
      onClickCapture={(e) => {
        const node = (e.target as HTMLElement).closest?.(
          "[data-editable-object]",
        );
        const id = node?.getAttribute("data-editable-object");
        if (id && objects.some((o) => o.id === id)) {
          e.preventDefault();
          e.stopPropagation();
          onSelect(id);
        }
      }}
    >
      <style>
        {selected
          ? `.object-preview [data-editable-object="${selected.replace(/[^a-zA-Z0-9_-]/g, "")}"]{outline:2px solid #0a84ff;outline-offset:4px;}`
          : ""}
      </style>
      {children}
    </div>
  );
}
