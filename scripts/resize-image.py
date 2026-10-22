"""
Batch image resizer for the recipe catalogue.

Reads a JSON job list (``[{"src": ..., "dst": ...}]``), centre-crops every
image to 16:9, resizes it to 480x270 and re-encodes it as a progressive JPEG.
Used by scripts/fetch-recipe-images.mjs so the app ships small, uniform
thumbnails instead of 700x700 originals.

Run it through the fetch script rather than by hand:

    python -m pip install pillow
    node scripts/fetch-recipe-images.mjs

Prints one JSON object with the results so the caller can record dimensions
and byte sizes in the manifest.
"""

import json
import os
import sys

from PIL import Image

WIDTH = int(os.environ.get("IMAGE_WIDTH", "400"))
HEIGHT = int(os.environ.get("IMAGE_HEIGHT", "225"))
QUALITY = int(os.environ.get("IMAGE_QUALITY", "65"))


def resize(job):
    src = job["src"]
    dst = job["dst"]
    os.makedirs(os.path.dirname(dst), exist_ok=True)

    with Image.open(src) as image:
        image = image.convert("RGB")
        width, height = image.size
        target = WIDTH / HEIGHT

        if width / height > target:
            crop_width = int(height * target)
            left = (width - crop_width) // 2
            image = image.crop((left, 0, left + crop_width, height))
        else:
            crop_height = int(width / target)
            top = (height - crop_height) // 2
            image = image.crop((0, top, width, top + crop_height))

        image = image.resize((WIDTH, HEIGHT), Image.LANCZOS)
        image.save(dst, "JPEG", quality=QUALITY, optimize=True, progressive=True)

    return {
        "src": src,
        "dst": dst,
        "width": WIDTH,
        "height": HEIGHT,
        "bytes": os.path.getsize(dst),
    }


def main():
    if len(sys.argv) != 2:
        print("usage: resize-image.py <jobs.json>", file=sys.stderr)
        return 2

    with open(sys.argv[1], encoding="utf-8") as handle:
        jobs = json.load(handle)

    results = []
    failures = []
    for job in jobs:
        try:
            results.append(resize(job))
        except Exception as error:  # noqa: BLE001 - report and keep going
            failures.append({"src": job.get("src"), "error": str(error)})

    print(json.dumps({"resized": results, "failed": failures}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
