#!/usr/bin/env python3
"""Extract plain text from a PDF so the brief parser can read it.
Usage: python3 pdf_text.py <file.pdf>  ->  prints the text to stdout."""
import sys

def run():
    try:
        import pypdf
    except Exception as e:
        sys.stderr.write("pypdf unavailable: %s" % e); sys.exit(2)
    reader = pypdf.PdfReader(sys.argv[1])
    parts = []
    for page in reader.pages:
        t = page.extract_text() or ""
        if t.strip():
            parts.append(t)
    sys.stdout.write("\n\n".join(parts))

if __name__ == "__main__":
    run()
