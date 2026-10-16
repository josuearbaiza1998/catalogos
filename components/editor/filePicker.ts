"use client";
import { addFiles } from "@/lib/client/actions";

export function openFilePicker(accept = "image/*,.heic,.heif,.xlsx,.xlsm,.csv") {
  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;
  input.accept = accept;
  input.onchange = () => input.files && addFiles([...input.files]);
  input.click();
}
