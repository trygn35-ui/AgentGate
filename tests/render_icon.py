"""从 SVG 生成 Windows 打包所需的 PNG 与 ICO 图标（应用图标 + 托盘两态）。"""

from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
ICO_SIZES = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
TRAY_SIZES = [(16, 16), (20, 20), (24, 24), (32, 32), (40, 40), (48, 48), (64, 64)]

# (源 SVG, 输出前缀, ICO 尺寸集, 是否保留 512 PNG)
JOBS = [
    (root / "public" / "agentgate.svg", root / "assets" / "icon", ICO_SIZES, True),
    (root / "assets" / "tray-on.svg", root / "assets" / "tray-on", TRAY_SIZES, False),
    (root / "assets" / "tray-off.svg", root / "assets" / "tray-off", TRAY_SIZES, False),
]


def render(page, svg: str, out_png: Path) -> None:
    page.set_content(
        f"""<!doctype html>
<style>
  html, body {{ width: 512px; height: 512px; margin: 0; overflow: hidden; background: transparent; }}
  svg {{ display: block; width: 512px; height: 512px; }}
</style>
{svg}"""
    )
    page.wait_for_timeout(150)  # 等字体渲染完成
    page.screenshot(path=str(out_png), omit_background=True)


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        headless=True,
        executable_path=r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    )
    page = browser.new_page(viewport={"width": 512, "height": 512}, device_scale_factor=1)

    for svg_path, out_prefix, sizes, keep_png in JOBS:
        png_path = out_prefix.with_suffix(".png")
        render(page, svg_path.read_text(encoding="utf-8"), png_path)

        image = Image.open(png_path).convert("RGBA")
        image.save(out_prefix.with_suffix(".ico"), format="ICO", sizes=sizes)
        if not keep_png:
            png_path.unlink()
        print("生成", out_prefix.with_suffix(".ico").name)

    browser.close()
