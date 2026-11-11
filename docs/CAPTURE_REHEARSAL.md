# 第一人稱碎片捕獲演練

使用者已授權將提供的 Blender 資產接進本 repo，加入第一人稱捕獲體驗。這是 Fetscape 的 authored mechanism concept，用來說明近距接近還需檢查旋轉抓點與機構條件。最新腳本與點擊順序見 `docs/pitch/DEMO_CLICK_SHEET.md`。它沒有將 GP 分析改成機載導航、接觸力學或捕獲性能證明。

## 入口與操作

本機打包版：<http://127.0.0.1:4180/#/capture>。選單 **Capture rehearsal** 或 ADR 頁的 **Open first-person rehearsal** 都可進入。選中的分析／目標只作 planning context；不將它的軌道狀態、外形或物理性質轉入近距場景。

1. 等待收集器、目標及機械臂三個組件載入。
2. 按 **Guided approach** 看程式控制的接近與減速；到 **Stand-off hold** 後按 **Close cage / capture**。
3. 或按 **Take controls**，以 `W/S` 前後、`A/D` 左右、`R/F` 上下移動。鬆開平移鍵仍有慣性，`Space` 制動。
4. 拖曳畫面或方向鍵瞄準；`Q/E` roll，`T` 重新對準。相機位於服務船上，預設為第一人稱。
5. `C` 申請捕獲、`X` 中止撤離、`G` 導引接近、`Esc` 暫停並釋放操作。切離視窗也會暫停。
6. 可暫停／重設、調整 1／2／4／8 倍時間、使用螢幕平移按鈕或全螢幕。
7. 換成 excessive tumble 情境，會在停駐後拒絕捕獲；lateral drift 情境則有合成橫向移動。
8. **Show mechanism camera** 可切到外部機構觀察視角；**Show first-person camera** 返回服務船相機。手動接管也返回第一人稱。
9. **Export rehearsal** 匯出 JSON，含情境假設、模型 hash、planning context、事件、捕獲入口門檻、rig 定義、末端／抓點幾何與取樣 simulator truth。
10. **Test degraded thrust** 開啟腳本的 seed-7 獨立研究對照；這是凍結結果重播，不驅動 3D 場景。未開啟時匯出中的 `independentFaultEvidence` 為 null。

## 所有提供的資產如何使用

| 資產                       | 用途                                     | 網頁處理                                             |
| -------------------------- | ---------------------------------------- | ---------------------------------------------------- |
| collector lowpoly          | 可選服務船本體                           | 7,370 triangles                                      |
| collector robot            | 可選較詳細服務船本體                     | 約 55k triangles                                     |
| collector split            | 預設；實際左右爪由 pivot 驅動            | 保留 7 parts，18,563 triangles                       |
| upper stage 兩份           | 可選碎片目標                             | 原檔 byte-identical，合併一份 GLB 並保留兩個來源別名 |
| lowpoly orbital debris     | 可選不規則碎片目標                       | 約 55k triangles                                     |
| modular caging robotic arm | 左右兩組，實際網格由 authored bones 驅動 | 約 55k triangles，右側為同一資產實例                 |
| spacecraft bus             | 可選衛星本體目標                         | 約 55k triangles                                     |

8 份來源檔、7 個獨立 GLB，約 12.46 MB。貼圖保留並縮至最多 1024px、以 WebP 嵌入 GLB；不依賴外部圖片、解碼器服務或 3D 平台。原始檔沒有骨架或 action；split 只是拆件。執行時以 authored bones／skin weights 為機械臂加上 base、shoulder、elbow、wrist 與上下夾指關節，以 pivot 驅動收集器的 `model_part3`／`model_part4`。骨架位置、權重與抓點來自外觀檢查，不是 CAD／硬體標定。低面數與 detailed collector 不含這組拆件，因此只有 segmented configuration 會驅動實際收集爪。

每個 GLB 最長邊正規化為 2 viewer units。演練另假設目標最長邊 3.8 m，不能把作者場景單位視為實際測量。原始 `.blend` 不被覆寫，也不放進 repo。`apps/web/public/models/manifest.json` 和 capture source manifest 記錄來源檔名／hash、別名、輸出 hash、面數與大小。

## 模型與門檻

純計算狀態機位於 `packages/orbital-core/src/capture.ts`。使用固定 1/120 s 步長、局部合成 XYZ；Three.js 只畫出狀態。它沒有 SGP4、HCW、感測器、姿態動力學或接觸模型。`mechanism.ts` 定義序列與兩節手臂 IK；`mechanism-rig.ts` 把結果套到實際網格，屬運動學，不是力學求解。

- 起始中心距離：14 m；合成目標初始速度：nominal 0、drifting 有指定橫向速度。
- scripted controller 的停駐中心距離：4.4 m。
- 允許申請捕獲：approach／hold 狀態、中心距離 3.6–5.2 m、總相對速度 ≤0.15 m/s、boresight error ≤5°、假設 tumble ≤2.5°/s。
- 所謂 nominal tumble 0.6°/s 是示範參數；target Euler animation 另有軸向分量，並未建立真實剛體角動量或 sensor-derived angular velocity。
- 捕獲序列持續 8 s：deploy arms → track & grasp → retract to cradle → close collector → verify latch → secured。
- 夾指閉合以前不吸附或去旋；進度到 48% 才以當下 body-relative pose 建立軟附著。目標再移到相機座標 `[0, -0.3, -3.2]` 的 authored cradle，中心距離約 3.214 m。兩個實際收集爪最後關閉。
- 申請捕獲時保存入口門檻；收回後 UI 顯示保存的入口檢查，不以 berth 距離重新判定同一入口。
- 目標去旋與 latch verification 仍為 scripted interpolation／state transition；沒有接觸力、摩擦、夾持力、扭矩、joint limits 或硬體 latch sensor。完成後場景暫停。
- 顯示的 commanded tip error 為 authored anchor 與 IK 的幾何殘差，不是影像定位精度或量測追蹤性能。`v_grasp = v_COM + ω × r` 的 2 m、3°/s、0.105 m/s 是獨立參考算例，不是 Meshy 尺寸量測。
- 中心距離 <2.6 m 觸發 **proxy collision** 失敗；不是 mesh collision 或損傷判定。
- Abort 沿當下 simulator line of sight 退離，達 24 m 時停止場景；不是可證明的避碰逃逸軌跡。

這些值都是選定的演練假設，不是任務規範。HUD 明列 **SIMULATOR TRUTH / LOCAL XYZ / NO SENSOR ESTIMATE**；沒有真實 range／pose sensing 或 uncertainty estimate。Earth／stars 是程式化背景，沒有傳播服務船相機的軌道位置。

## 重建資產與驗證

已處理的 GLB 放在 repo，正常啟動不需要 Blender 或原始 Downloads。若要重建，需 Blender 5.2（本次使用 5.2.2）與使用者提供的 8 份檔案：

```bash
mkdir -p .local/blender
blender --background --disable-autoexec --threads 2 \
  --python scripts/blender/inspect_assets.py -- SOURCE_DIRECTORY .local/blender/inspection.json
blender --background --disable-autoexec --threads 2 \
  --python scripts/blender/export_assets.py -- SOURCE_DIRECTORY .local/blender/inspection.json REPO_DIRECTORY
npm run validate:assets
npm test
npm run build
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
```

匯出腳本不執行場景內的 Python、不保存原始場景。Blender exporter 曾提示多個 image node 共用 texture sampler；本次實際載入與視覺檢查是驗證匯出結果的一部分，不宣稱與所有原始 shader 完全一致。

測試涵蓋：門檻拒絕、總相對速度、手動慣性與制動、中止打斷捕獲、proxy collision、固定步長重現／收斂、禁止過早附著、IK／抓點速度、原始 GLB 頂點的骨架變形、實際拆件的開合與部署，以及 GLB 完整性和瀏覽器實際流程。WebGL 不可用或模型載入失敗時，介面顯示錯誤並停用飛行動作；不改用假的模型宣告載入成功。

Three.js 於這個路由才載入；離開時停止動畫／輸入監聽並釋放 geometry、material、texture 與 WebGL context。這是單使用者本機演練，事件不另存 API／SQLite，需自行匯出 JSON。Trace 最多保留 2,400 筆約每 0.25 秒的 simulator truth，並非精確控制輸入重播。
