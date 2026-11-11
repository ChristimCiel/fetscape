# 與 Fetscape 講稿相符的操作順序

對照 `DEMO_90S.md`。原旁白未被改寫；本頁只把已存在的軟體動作對齊其敘事。獨立模型與機構概念保持明示，不把動畫當硬體捕獲成果。

| 秒數  | 操作                                              | 畫面與要說的事                                                                                                                                                                                                                              |
| ----- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0–22  | 開 `/#/capture`                                   | Fetscape／Plan the approach. Test the escape.，以及「Find planning mistakes before execution」。提出工程師執行前的判斷問題。                                                                                                                |
| 22–35 | 按 `Inspect orbital geometry`                     | 重新計算並跳至固定公開快照的 ISS–DUPLEX TCA；確認 80.8 km、3.360 km/s、來源與 epoch。它是廣距參考。                                                                                                                                         |
| 35–62 | 回 `Capture rehearsal`，按 `Test degraded thrust` | 顯示獨立 HCW/Kalman 研究的 seed-7 凍結結果。可從頭 replay，或跳到 130 s 故障與 650 s 終點。保留 100 m 自訂門檻和 simulator-provided availability。                                                                                          |
| 62–75 | 按 `Track the grasp point`                        | 用已進入 stand-off 的合成機構場景，展示 first-person 與 mechanism camera。actual Meshy meshes 經 authored bones／pivots 動作；這一段依舊是未經硬體驗證的 mechanism concept。2 m、3°/s、0.105 m/s 是旁邊的獨立參考算例，不是這個模型的量測。 |
| 75–87 | `Export rehearsal`                                | 展示原始假設、capture entry evidence、機構階段、末端／抓點幾何、來源 hash 與已檢視的 fault evidence；說下一步是一個有基準與驗收條件的 servicing-team pilot。                                                                                |
| 87–90 | 回頂部產品主張                                    | 保留結尾停頓；不宣稱需求、收入、飛行或接觸已驗證。                                                                                                                                                                                          |

## 錄影準備

- 先讓 GLB 完成載入、試過兩個相機與匯出；不靠後製遮蔽失敗。
- 機構預設 segmented collector，真的使用左右爪 `model_part3`／`model_part4`。機械臂為原網格加 authored bones，不是來源檔原本已有的 rig。
- 回到 Capture rehearsal 後，先以 8× 啟動 `Guided approach`，再開 fault comparison。局部合成接近可以在同頁的對照播放期間到 stand-off；不要在接近尚未完成時申請捕獲。到 1:02 時以 1× 或 2× 播放 8 秒機構序列。切離路由會重建場景，因此不要在離開前預熱。這是合成 controller 的操作排程，不是實際任務成果。
- 入口門檻在申請捕獲時保存。收回至 cradle 後的距離會變小，不能拿後續距離重新宣稱入口條件一直成立。
- 若要講 fault-study 結果，先開啟對照再匯出；未開啟時 export 的 `independentFaultEvidence` 為 null，不能說它已被檢視。
- `commanded tip error` 是 authored geometry／IK 的殘差，不是導航精度或真實末端追蹤性能。
- 旁白仍需依 Tim 實際語速排練；軟體沒有宣稱已完成 90 秒錄影。
