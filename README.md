# Fetscape · Mission Verification

以可追溯資料與確定性計算，協助人工檢視軌道近接事件與初步任務限制的本機軟體原型。

**Plan the approach. Test the escape. 目前產品方向是 mission verification／decision support。影像感知、機載導航與自主飛控屬於另一組能力，這個 repo 尚未實作。**

## 快速開始

需求：**Node.js 24.x** 與 npm。SQLite 使用 Node 內建的 `node:sqlite`；此版本可能顯示 experimental 警告。一般使用不需要 Python、API key、雲端帳號或外部地圖。

```bash
npm ci
npm run dev
```

開啟 <http://127.0.0.1:5175>。前端開發伺服器會把 `/api` 轉送到本機 `4180`。

使用打包版：

```bash
npm run build
npm start
```

開啟 <http://127.0.0.1:4180>。資料存在 `.local/orbit.sqlite`，重啟後仍保留。`ORBIT_DB_PATH` 可改變資料庫位置；測試可設為 `:memory:`。`PORT` 可改 API／打包版埠號，服務固定綁定 loopback。

第一人稱捕獲演練：<http://127.0.0.1:4180/#/capture>。操作與假設見 [Capture rehearsal](docs/CAPTURE_REHEARSAL.md)。

## 已完成的工作區

| 工作區                       | 可操作功能                                                                                                                                               | 能力界線                                                                                   |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Satellite operations         | 選擇資料與主要物體、設定 UTC／時窗／幾何門檻、SGP4 軌道重播、播放／暫停／倍速／時間拖曳、TCA／miss distance／相對速度、倒數、人工 review、歷史紀錄與報告 | 選定物體的幾何分析；沒有 Pc、避碰機動或即時告警服務                                        |
| Debris removal lab           | 候選物體列表、軌道面夾角、概念性圓軌道轉移與獨立平面變更 proxy、RIC 相對幾何、缺失資料清單、target brief                                                 | 初步比較；沒有完整 rendezvous、物理捕獲、去旋、再入或多目標最佳化                          |
| Capture rehearsal（ADR Lab） | 第一人稱相機、手動／導引接近、制動、捕獲門檻、實際拆件與機械臂網格的 authored joints、中止撤離、七模型切換／檢視、拆件展開、演練 JSON                    | 獨立合成局部運動；數值為 simulator truth，沒有相機感知、真實接觸力或 coupled-body dynamics |
| 共用基礎                     | GP JSON／TLE 匯入驗證、SGP4、UTC／TEME、資料分類、來源 hash、SQLite、JSON 匯出                                                                           | 只支援明列的格式子集；沒有觀測資料 orbit determination 或 covariance propagation           |

介面使用英文，方便與國際合作夥伴討論。所有資料與繪圖資產皆由本機提供，安裝後展示不依賴外部網路。

## 三分鐘操作

1. 先看 **Public elements · frozen replay**，檢查取得時間、來源和資料 age。這是固定快照，並非最新監測。
2. 換成 **Synthetic orbital laboratory** 並按 **Run analysis**。`SIM-*` 是虛構物體；軌道由 SGP4 計算。
3. 從 queue 選 `SIM-CROSSING`，播放或跳到 TCA。幾何門檻匹配不表示碰撞風險。
4. 填入 review note，保存後重新整理；再匯出文字報告與完整 JSON。
5. 切到 **Debris removal lab**，比較目標、檢查未知資料，再匯出 target brief。
6. **Data sources** 可以貼入 2–24 個唯一物體的 GP JSON 或 checksum-valid TLE；**Analysis history** 可重開舊分析。

## 驗證

```bash
npm run check
npm test
npm run validate:reference
npm run validate:assets
npm run build
npx playwright install chromium
npm run test:e2e
npm run format:check
```

本機已有 Chrome 時，可用 `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`。E2E 使用獨立的記憶體資料庫與 `4188`，不改使用者紀錄。先完成 build，再執行 E2E。

GitHub Actions 從乾淨 checkout 安裝依賴，執行軟體驗證、故障對照重跑、11 個 Python research tests 與 Chromium E2E。Python 3.12／NumPy 僅供這組獨立研究重跑；應用程式啟動不需要 Python。

獨立 reference 包含 **18 個 python-sgp4 狀態**：公開 GP、Vallado 近地與深空 TLE。固定輸入與預期結果已放在 repo；Python 僅供重建 fixture：

```bash
python3 -m venv .venv
.venv/bin/python -m pip install sgp4==2.27
.venv/bin/python scripts/generate-reference.py
npm run validate:reference
```

數值比對目前最大位置差約 **5.93 m**，主要出現在原始 GP 微秒 epoch 經 JavaScript 毫秒日期初始化的案例。**這是實作差異，不是軌道定位誤差或保證精度。** 詳見 [科學方法與驗證](docs/SCIENTIFIC_METHOD.md)。

## Repo 結構

```text
apps/web/                 React + Vite；軌道、事件、review、資料與歷史介面
apps/api/                 Fastify API、SQLite、凍結資料與匯出
packages/orbital-core/    格式、傳播、幾何、screening、removal proxy、報告
data/                    公開快照子集及取得紀錄
tests/                   核心、API、reference 與端到端測試
scripts/                 獨立 reference 產生與驗證工具
docs/                    產品範圍、架構、方法、API、驗證紀錄與路線圖
```

## 下一步閱讀

- [產品主張與 servicing／RPO pilot 假說](docs/PRODUCT.md)
- [與 Fetscape 講稿相符的點擊順序](docs/pitch/DEMO_CLICK_SHEET.md)
- [架構與資料流](docs/ARCHITECTURE.md)
- [計算方法、必要資料與限制](docs/SCIENTIFIC_METHOD.md)
- [API 範例](docs/API.md)
- [30／90／180 天軟體路線圖](docs/ROADMAP.md)
- [本次驗證紀錄](docs/VALIDATION.md)
- [第一人稱捕獲、資產來源與操作](docs/CAPTURE_REHEARSAL.md)
- [貢獻方式](CONTRIBUTING.md) · [本機與部署邊界](SECURITY.md)

本版不提供認證、多租戶、背景工作、通知投遞或服務可用性承諾。原始碼未選定對外授權；`private` package 不代表第三方資料已獲商用／轉授權。公開資料來源與使用條款見 [資料說明](data/README.md)。
