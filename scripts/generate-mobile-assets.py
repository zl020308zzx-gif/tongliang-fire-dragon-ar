from pathlib import Path
from shutil import copy2

from PIL import Image


ASSET_ROOT = Path(__file__).resolve().parents[1] / "public" / "assets"


def target_size(group: str, relative_path: Path, width: int, height: int):
    if group == "page1":
        scale = min(800 / width, 1200 / height, 1)
        return round(width * scale), round(height * scale)
    if group == "page2" and relative_path.as_posix() == "background/page2-bg-full-base.jpg":
        return 704, 994
    if (width, height) == (1600, 2400):
        return 800, 1200
    if height == 2400 and width > 1200:
        scale = 1200 / height
        return round(width * scale), 1200
    return None


def save_optimized(image: Image.Image, output: Path):
    has_alpha = "A" in image.getbands() and image.getchannel("A").getextrema()[0] < 255
    if output.suffix.lower() in {".jpg", ".jpeg"} and not has_alpha:
        image.convert("RGB").save(
            output,
            format="JPEG",
            quality=82,
            optimize=True,
            progressive=True,
        )
        return
    image.save(output, format="PNG", optimize=True)


def generate_group(group: str):
    source_root = ASSET_ROOT / group
    output_root = ASSET_ROOT / f"{group}-mobile"
    generated = []

    sources = sorted(
        path for path in source_root.rglob("*")
        if path.is_file()
        and (
            path.suffix.lower() == ".png"
            or (
                path.suffix.lower() in {".jpg", ".jpeg"}
                and (group == "page1" or "background" in path.relative_to(source_root).parts)
            )
        )
    )
    for source in sources:
        relative_path = source.relative_to(source_root)
        output = output_root / relative_path
        output.parent.mkdir(parents=True, exist_ok=True)

        with Image.open(source) as image:
            size = target_size(group, relative_path, image.width, image.height)
            if size is None:
                copy2(source, output)
                output_size = image.size
            elif size != image.size:
                resized = image.resize(size, Image.Resampling.LANCZOS)
                save_optimized(resized, output)
                output_size = resized.size
            else:
                resized = image.copy()
                save_optimized(resized, output)
                output_size = resized.size

        generated.append((relative_path.as_posix(), output_size))

    return generated


if __name__ == "__main__":
    for page_group in ("page1", "page2", "page3"):
        print(page_group)
        for path, size in generate_group(page_group):
            print(f"  {path}: {size[0]}x{size[1]}")
