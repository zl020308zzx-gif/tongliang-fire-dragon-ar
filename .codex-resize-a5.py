from pathlib import Path
import os

from PIL import Image, ImageOps


DESKTOP_SIZE = (1480, 2100)
MOBILE_SIZE = (740, 1050)

ASSETS = [
    Path("public/assets/page1/images/page1/craft-panel.jpg"),
    Path("public/assets/page1/images/page1/craft-panel-base.jpg"),
    Path("public/assets/page2/background/page2-bg-full.jpg"),
    Path("public/assets/page2/background/page2-bg-full-base.jpg"),
    Path("public/assets/page3/background/page3-bg-board.jpg"),
    Path("public/assets/page3/background/page3-floor-base.jpg"),
    Path("public/assets/page1-mobile/images/page1/craft-panel.jpg"),
    Path("public/assets/page1-mobile/images/page1/craft-panel-base.jpg"),
    Path("public/assets/page2-mobile/background/page2-bg-full.jpg"),
    Path("public/assets/page2-mobile/background/page2-bg-full-base.jpg"),
    Path("public/assets/page3-mobile/background/page3-bg-board.jpg"),
    Path("public/assets/page3-mobile/background/page3-floor-base.jpg"),
]


for asset_path in ASSETS:
    target_size = MOBILE_SIZE if "-mobile" in asset_path.as_posix() else DESKTOP_SIZE
    with Image.open(asset_path) as source:
        source_format = source.format
        normalized = ImageOps.exif_transpose(source)
        resized = normalized.resize(target_size, Image.Resampling.LANCZOS)
        temp_path = asset_path.with_name(f"{asset_path.name}.a5-resize-tmp")

        if source_format == "PNG":
            resized.save(temp_path, format="PNG", optimize=True)
        else:
            resized.convert("RGB").save(
                temp_path,
                format="JPEG",
                quality=88,
                subsampling=0,
                optimize=True,
                progressive=False,
            )

        os.replace(temp_path, asset_path)
        print(f"{asset_path}: {source.size} -> {target_size} ({source_format})")
