# Validation record

驗證日期：2026-11-11。這份紀錄說明本機可重現的軟體檢查，不是任務認證。

| 層級       | 已執行證據                                                          | 限制                                                                          |
| ---------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| TypeScript | `npm run check`                                                     | 型別一致不等於科學正確                                                        |
| 核心與 API | `npm test`                                                          | 解析事件、格式、座標、去重、未知性質、儲存／重開與錯誤路徑                    |
| 獨立數值   | `npm run validate:reference`，18 states 全通過                      | 最大 position delta 5.921921 m、velocity delta 0.006798 m/s；不是實際定位精度 |
| Build      | `npm run build`                                                     | 前端只載入展示／幾何入口；SGP4 在 API                                         |
| Browser    | 9 個 Playwright E2E 流程通過                                        | 本機 Chrome、桌面與 390px；未測所有瀏覽器／輔助技術                           |
| 外部依賴   | Browser flow 無外部請求或 page error；安裝時 `npm audit` 無已知項目 | 不代表完整資安審計或永久沒有漏洞                                              |

## 完整使用者故事

1. 瀏覽器載入 snapshots／歷史 → API → SQLite 或 seed → 凍結公開元素呈現。
2. 選合成情境並執行 → 請求驗證 → SGP4／screening → SQLite → 軌道、事件、時間播放。
3. 保存 review → event ownership 驗證 → SQLite → 重新整理後讀回。
4. 下載 report／JSON → 保存的輸入、hash、計算結果和 note 都存在。
5. 切到 removal lab、選不同目標 → proxy／缺失資料 → target brief 包含正確目標與原始 pair inputs。
6. 跨工作區切回 operations → 指標、選取物體與事件一致。
7. 無效匯入 → 可見錯誤；有效匯入 → 明確 user-import 分類與可執行分析。
8. 390px viewport → 無整頁橫向溢出，資料表可以局部捲動。

API 測試另用實際暫存 SQLite 檔關閉／重開，確認分析與 review 持久化。E2E 則使用隔離的記憶體資料庫，不會留下測試筆記於使用者資料庫。

## 科學差異的解讀

`tests/fixtures/sgp4-reference.json` 由 python-sgp4 2.27 產生，包含公開 GP、Vallado Vanguard 近地與 04632 深空案例。公開 GP 保留來源微秒 epoch，JavaScript library 用毫秒日期初始化。這個差異有明列容差，沒有把來源改成 TLE 來隱藏 precision loss。

TLE 比對使用原始兩行直接初始化，避免另一次 OMM → TLE 的精度改變。獨立腳本把逐筆數值寫到 `.local/reference-validation.json`。

## 尚未驗證

實際軌道真值與 covariance、全 catalog screening 完整性、機動與 re-screening、vision／relative navigation、capture／coupled dynamics、再入、多使用者、安全隔離、備份還原、負載／長期可靠性、即時供應商及通知投遞、任何付費需求或 customer pilot。

截圖與 browser trace 是本機測試產物，保存在 git-ignored 的 `test-results/`，不作成具有客戶或飛行含義的宣傳證據。

## Initial first-person expansion — earlier verification on 2026-11-11

- 28 core/API/reference/asset tests passed, including eight synthetic capture state-machine cases and self-contained GLB hash/budget validation.
- Eight browser flows passed: original operations flows plus approach/capture/export, all seven asset inspections and split explosion, manual controls/abort/tumble rejection, WebGL unavailable, and asset HTTP failure followed by renderer recovery.
- All eight original Blender file hashes were checked after export and remained unchanged. The two upper-stage sources are identical; seven unique GLBs total 12,461,060 bytes.
- Desktop first-person/secured/inspection views and a 390px mobile viewport were inspected. These screenshots demonstrate software rendering and workflow, not physical capture capability.
- GLB texture image blobs are local `blob:` URLs; external-request checks classify HTTP(S) origins separately. No external model or texture service is used.
- Rehearsal assumptions and GPU/resource lifecycle are documented in `CAPTURE_REHEARSAL.md`. Capture sessions export locally and are not part of SQLite analysis history.

## Fetscape mechanism and script alignment — verified 2026-11-11

- `npm run verify` passed: 36 tests across 8 files, 18 independent SGP4 reference states, all 7 GLB asset hashes/budgets, TypeScript, production build and formatting. The lazy Three.js route is about 672 kB minified / 173 kB gzip and retains Vite’s >500 kB chunk notice.
- 9 Playwright Chrome flows passed. New assertions cover the default segmented collector, external mechanism camera, both real moving collector segments, two reachable arm tips, saved capture-entry checks, soft attachment, Fetscape copy, seed-7 evidence export, and the 80.8 km public-data script button.
- Actual-geometry tests read the bundled GLBs: a supplied robotic-arm vertex moves through authored skinning; real collector parts 3/4 open, deploy and close. These tests exercise mesh deformation and pivots, not hardware contact.
- `OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 python3 scripts/verify-rpo-reference.py` reproduced both seed-7 final separations exactly in this environment: 59.52010643477721 m / 129.76978101130004 m, with zero endpoint delta against the frozen evidence. The 11 copied Python research tests also passed.
- Script snapshots keep their original bytes and hashes. Frozen evidence and its browser copy are byte-identical. No runtime import depends on the older sibling research folder.
- Contact/force sensing, image pose estimation, hardware joints/limits, latch sensing, uncertainty validation and flight performance remain unverified. The rig is authored kinematics on actual supplied meshes.

## Headless rendering and frame timing

The first GitHub Linux run passed clean installation, build, all numerical checks and Python research checks. Four browser flows timed out under software WebGL; the logs showed an active approach, screenshot timeout and a delayed asset-error assertion, rather than a numerical failure. The UI clock now accumulates up to 1 s of elapsed wall time per frame while preserving the 1/120 s integrator. Slow-cadence regression tests compare equal elapsed time and ensure pauses/long stalls stay bounded. Evidence samples are collected inside fixed integration steps so the exported trace remains independent of render cadence. CI allows 120 s per flow and 15 s for ordinary assertions; explicit model readiness/error waits remain 30 s. Retries remain disabled, with the same capture/export assertions.

The script’s orbital-analysis button switches to Operations immediately and releases the capture renderer before waiting for the API. Its browser regression test deliberately holds the analysis response: navigation, renderer removal and the calculating state must appear first, then the released response must yield the expected public-data result. This avoids retaining the software WebGL workload while waiting for orbital analysis.
