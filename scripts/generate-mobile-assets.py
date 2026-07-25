from pathlib import Path
from shutil import copy2

from PIL import Image


ASSET_ROOT = Path(__file__).resolve().parents[1] / "public" / "assets"


def target_size(group: str, relative_path: Path, width: int, height: int):
    if group == "page2" and relative_path.as_posix() == "background/page2-bg-full-base.png":
        return 704, 994
    if (width, height) == (1600, 2400):
        return 800, 1200
    if height == 2400 and width > 1200:
        scale = 1200 / height
        return round(width * scale), 1200
    return None


def generate_group(group: str):
    source_root = ASSET_ROOT / group
    output_root = ASSET_ROOT / f"{group}-mobile"
    generated = []

    for source in sorted(source_root.rglob("*.png")):
        relative_path = source.relative_to(source_root)
        output = output_root / relative_path
        output.parent.mkdir(parents=True, exist_ok=True)

        with Image.open(source) as image:
            size = target_size(group, relative_path, image.width, image.height)
            if size is None:
                copy2(source, output)
                output_size = image.size
            else:
                resized = image.resize(size, Image.Resampling.LANCZOS)
                resized.save(output, format="PNG", optimize=True)
                output_size = resized.size

        generated.append((relative_path.as_posix(), output_size))

    return generated


if __name__ == "__main__":
    for page_group in ("page2", "page3"):
        print(page_group)
        for path, size in generate_group(page_group):
            print(f"  {path}: {size[0]}x{size[1]}")
