# DEV-CONSOLE-V2B

開發者控制台第二批：主城 v3 校準、40×40 開發棋盤、音效與安全框、除錯包。掛在既有統一抽屜，不另開入口。

## 打開

主城或戰鬥頁：

- 網址加 `?dev=1`
- 或 `Ctrl+Shift+D`
- 或反引號 `` ` ``（輸入框裡的反引號不會開）

不要用 `?dev2b=1` 或 `?dev2a=1`。那兩個都不會打開抽屜。

分頁可用 `v2tab`：

| 網址 | 分頁 |
|---|---|
| `?dev=1&v2tab=calibrator` | 主城校準 |
| `?dev=1&v2tab=world` | 大地圖 |
| `?dev=1&v2tab=qa` | 音效與框 |
| `?dev=1&v2tab=bundle` | 除錯包 |

未開控制台時，V2B 不掛進 DOM。四個分頁在 `DevConsole` 裡以 `import()` 懶載入。V1／V2A 的六個分頁仍在。

## 1. 主城 v3 校準

開「主城校準」。十五區多邊形與 `zoom=0.4` 框疊在主城畫面上，色票沿用現有金／朱。

- 拖圓點改頂點，拖名牌改 `Lv.X` 的 XY。只改記憶體。
- 「批次 Lv.1／5／10／滿級」只套在有 `levelKind` 的六種建築（官府、校場、市集、兵營、民居、農田）。
- **滿級暫定 Lv.10。** `data/internal.json` 沒有滿級欄。這不是官方滿級，不要寫回 JSON。
- 森林、礦山官方是 `fixedLevel: 1`，批次設級不動它們。
- 「切換建造中」只在疊加層顯示浮標。
- 「匯出 layout-v3-diff.json」下載差異。不寫 `data/cityLayoutV3.json`，也不寫 `data/cityLayout.json`。

`zoom=0.4` 框用與主城相同的 `artboardFrame(0.4)`。多邊形鋪在拉滿後的主城框上；0.4 框是還沒拉滿的那一圈，並帶相機偏移。1280×720 時主城框是 1004×650，0.4 框較小，左緣在相機偏移 96。

### layout-v3-diff.json

```json
{
  "schema": "layout-v3-diff.v1",
  "source": "data/cityLayoutV3.json",
  "art": { "w": 2496, "h": 1440 },
  "provisionalMaxLevel": 10,
  "note": "滿級暫映射為 Lv.10，不是官方滿級。此檔只供校準，不回寫 data/cityLayoutV3.json。",
  "zones": [
    {
      "id": "gov",
      "polygon": [[0, 10]],
      "badgeOffset": [4, -6],
      "level": 10,
      "building": true
    }
  ]
}
```

上面的 `polygon` 只示意一個頂點。實際匯出是該區目前的完整多邊形。有改動的區才列入。列入後四欄都在：

| 欄 | 意思 |
|---|---|
| `polygon` | 目前頂點，原圖像素，已夾在畫布內 |
| `badgeOffset` | 相對原檔 `badge` 的 XY。`[0,0]` 表示沒挪 |
| `level` | 臨時等級。`null` 表示沒設。滿級按鈕寫入 `10` |
| `building` | 建造中浮標 |

`art.w`／`art.h` 讀自 `data/cityLayoutV3.json`，不是另寫的一份尺寸。

## 2. 40×40 大地圖

開「大地圖」。這是開發棋盤，不是 Phase 3 玩法。

- 棋盤 40×40，開局沒有任何點。不要把草案裡的 `(20,20)` 或樣本節點當成官方座標。
- 「戰爭迷霧」蓋住沒有標記的格。
- 「座標」開時顯示選中格，並把選中標記套上框。
- 種類只有三種標記：野怪、資源、關卡點。填 0–39 的整數再按「刷出」。越界或該格已有標記會被拒。關卡點不寫 `data/stages.json`。
- 「行軍 0 秒瞬達」打開時，按「行軍」標記立刻落到目標，事件記 `seconds: 0`。關掉時標記留在原格，不套任何行軍秒數（官方行軍還沒有）。

### Phase 3 預留

同一頁底部三欄，寫進既有鍵 `mg_dev_overrides_v1`：

| 欄 | 行為 |
|---|---|
| 科技等級 | 整數，存檔夾在 0–999。這是儲存夾限，不是官方等級上限 |
| 銅 | 數字。**不是**第八個資源鍵，左欄不會出現 |
| 裝備詞條 | 逗號分隔的 id。只存通過字元檢查的字串，最多 8 條。不對照裝備目錄 |

留空再按「寫入覆寫」或按「清除」會拿掉該欄。官方內政、戰鬥、左欄都不讀這些欄。沒有覆寫時，`overridesIdle()` 仍走原值，不多讀存檔。

## 3. 音效、彈窗、安全框

開「音效與框」。

- 五聲是主城既有的點擊、鐘聲、號角、交擊、戰鼓（`sfxClick`／`sfxBell`／`sfxHorn`／`sfxClash`／`sfxDrum`）。
- 音量存在 `mogong.sfx.volume`，1 為原聲。未寫入時增益不變。
- 靜音仍是 `mogong.sfx.muted`。靜音時五聲都不出，音量不會把門打開。
- Toast 走主城現有橫幅。主城沒開時按鈕會說「主城未開啟」。示範句（例如「官府 升至 Lv.2」）不改真實等級。
- 升級禁用走現有 `UpgradeDialog`，不另做一套窗：
  - 資源不足：預覽把資源看成 0，不寫存檔。
  - 隊列已滿：預覽把三格都看成在建民居，再開官府窗。不寫存檔。
  - 人口已滿：官方升級費用沒有人口。預覽把人口放到目前上限，並強制禁用文案「人口已滿」。不寫存檔。
- 離線 1 分、10 分、1 小時、2 小時、12 小時走現有 `simulateOffline`，**會結算進當前存檔**。1 分不受進城時 120 秒門檻限制，這一點與控制台裡原有的離線按鈕相同。
- 安全框：1280×720 與 1920×1080 另畫官方安全區內框。1366×768 只有外框，**沒有官方安全區**，所以不畫內框。色用現有朱與金。

## 4. 除錯包

開「除錯包」，按「匯出 debug-bundle.json」。一個檔，三塊：

| 欄 | 內容 |
|---|---|
| `save.internal` | `mogong.internal.v1` 原文，沒有就是 null |
| `save.general` | `mogong.general.v1` 原文 |
| `save.lastAt` | `mogong.internal.lastAt` |
| `devOverrides` | 記憶體裡的覆寫袋，沒有就是 null |
| `events` | V2B 自己的記憶體環，最多 30 筆 |

這條環與 syslog、傷害日誌無關。不呼叫 `console.log`。匯出當下會先記一筆 `bundle.export`，所以它會出現在這 30 筆裡。

## 紅線

本分支不改 `data/cityLayout.json`、`data/cityLayoutV3.json`、`data/units.json`、`data/stages.json`、`data/balance.json`、`src/combat/**`、`src/m0/**`。不改戰鬥數學。
