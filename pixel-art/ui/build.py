"""Foldworks UI art: regenerates every ui_*/portrait_*/logo* sprite in src/art/ and every preview
and mock in out/.   python build.py

    chrome.py     ui_panel, ui_panel_light, ui_inset, ui_button, ui_button_gold, ui_tab, ui_row,
                  ui_ticker, ui_node, ui_stamp_ring           (+ out/chrome_test_*.png)
    icons.py      ui_icons (20), ui_coin, ui_coin_small       (+ out/icons_check_*.png)
    portraits.py  portrait_bramble, portrait_bramble_small, portrait_unit7, portrait_voltaire
    letters.py    logo, logo_glint, ui_grade                  (+ out/logo_check_*.png)
    mock.py       out/mock.png, mock_2x.png, mock_layout.json, mock_research.png, _2x

Every export is checked against src/data/palette.ts (no off-palette colour, no pip colour, no
semi-transparent pixel) by common.export; out/report.json lists size, frames and colours.
"""
import chrome
import icons
import portraits
import letters
import mock

if __name__ == "__main__":
    o = chrome.build()
    chrome.preview(o)
    icons.build()
    portraits.build()
    letters.build()
    mock.build()
