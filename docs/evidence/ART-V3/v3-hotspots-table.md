# v3 熱區座標表（data/cityLayoutV3.json）

畫布 2496×1440；bbox 由 polygon 頂點算出；badge 為 `Lv.X` 牌落點。

| id | 標籤 | bbox x,y,w,h | badge | action |
| --- | --- | --- | --- | --- |
| gov | 官府 | 1250,715,655,590 | 1478,880 | MOCK_升級:gov |
| drill | 校場 | 390,757,632,309 | 700,930 | MOCK_列陣 |
| gate_n | 北門塔 | 852,298,290,180 | 1005,400 | MOCK_出城 |
| market | 市集 | 1208,412,200,216 | 1310,520 | MOCK_升級:market |
| barrack | 兵營倉庫 | 1412,332,406,136 | 1605,400 | MOCK_徵兵 |
| workshop | 工坊 | 0,538,208,184 | 100,600 | MOCK_工坊 |
| stable | 馬廐 | 222,486,286,198 | 360,560 | MOCK_馬廐 |
| tavern | 酒館 | 2150,905,288,205 | 2295,940 | MOCK_酒館 |
| house | 民居 | 1760,1266,724,174 | 2080,1330 | MOCK_升級:house |
| farm | 農田 | 1356,160,190,90 | 1450,196 | MOCK_升級:farm |
| pond | 池塘 | 2138,545,358,355 | 2300,660 | MOCK_池塘 |
| pavilion | 亭院 | 118,746,234,256 | 245,840 | MOCK_亭院 |
| shrine | 寶塔 | 8,728,90,220 | 52,820 | MOCK_寶塔 |

驗收：`node scripts/v3-check.mjs` → 13 zones、全部頂點在畫布內、badge 全落 polygon 內、兩兩重疊 0。
