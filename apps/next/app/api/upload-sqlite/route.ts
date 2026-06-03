import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const ext = path.extname(file.name).toLowerCase();
    const allowedExts = [".db", ".sqlite", ".sqlite3", ".s3db"];
    if (!allowedExts.includes(ext) && ext !== "") {
      return NextResponse.json(
        { error: `Invalid file type. Allowed: ${allowedExts.join(", ")}` },
        { status: 400 }
      );
    }

    const uploadDir = path.join(os.tmpdir(), "dbview-uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filepath = path.join(uploadDir, `${Date.now()}_${safeName}`);

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filepath, buffer);

    return NextResponse.json({
      filepath,
      filename: file.name,
      size: file.size,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Upload failed" },
      { status: 500 }
    );
  }
}
