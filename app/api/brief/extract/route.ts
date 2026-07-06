export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { WORK_DIR } from "@/lib/workdir";
import { mkdirSync, writeFileSync, unlinkSync } from "fs";
import path from "path";
import crypto from "crypto";
import { spawn } from "child_process";

const PYTHON = process.env.PYTHON_BIN || "python3";
const PDF_TEXT = path.join(process.cwd(), "scripts", "pdf_text.py");

function pdfToText(pdfPath: string): Promise<string> {
  return new Promise((resolve) => {
    let out = "", err = "";
    const p = spawn(PYTHON, [PDF_TEXT, pdfPath]);
    p.stdout.on("data", d => { out += d.toString(); });
    p.stderr.on("data", d => { err += d.toString(); });
    p.on("close", () => resolve(out.trim() || (err ? "" : "")));
    p.on("error", () => resolve(""));
  });
}

// Accepts an uploaded brief file (PDF or plain text) and returns its extracted text so the
// client can hand it to the brief parser — lets users upload a brief file alongside footage.
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const name = (file.name || "brief").toLowerCase();
    const buf = Buffer.from(await file.arrayBuffer());

    if (name.endsWith(".pdf")) {
      const dir = path.join(WORK_DIR, "uploads", "tmp");
      mkdirSync(dir, { recursive: true });
      const tmp = path.join(dir, `${crypto.randomUUID()}.pdf`);
      writeFileSync(tmp, buf);
      const text = await pdfToText(tmp);
      try { unlinkSync(tmp); } catch { /* noop */ }
      if (!text) return NextResponse.json({ error: "Couldn't read text from that PDF." }, { status: 422 });
      return NextResponse.json({ text });
    }
    // plain text / markdown / rtf-ish — return as UTF-8
    return NextResponse.json({ text: buf.toString("utf8") });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
