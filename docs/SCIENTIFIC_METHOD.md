# 計算、資料與驗證邊界

## 能力／資料矩陣

| 輸出                                   | 必要資料                                                               | 本版狀態                                                                                                            |
| -------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 預測位置與速度                         | 支援格式的 GP mean elements、適用的 SGP4、指定時間                     | 已實作，TEME km／km/s；不是測量真值                                                                                 |
| TCA、miss distance、相對速度           | 同時刻同座標系的兩物體狀態                                             | 已實作幾何 local-minimum search                                                                                     |
| Pc                                     | 兩物體可用且經評估的 uncertainty／covariance、幾何尺寸、適用的評估方法 | 未實作；GP 本身不提供本版所需 covariance                                                                            |
| 避碰方案評估                           | operator ephemeris、可行機動、推進／姿態／時間與通訊限制、再篩查       | 未實作                                                                                                              |
| 質量、尺寸、慣量、翻滾                 | 權威物理資料或額外觀測／辨識與其誤差                                   | 未知，固定 null；沒有由元素推測                                                                                     |
| 初步 ADR 軌道比較                      | 指定 reference／target mean elements，近圓軌道假設                     | 已實作概念 proxy，不是完整可達性                                                                                    |
| rendezvous、capture、de-spin、disposal | 相對導航、六自由度／接觸、組合體、推進與處置模型等                     | 動力學能力未實作；另有獨立合成第一人稱捕獲 state-machine／authored joint kinematics 演練，見 `CAPTURE_REHEARSAL.md` |

公開 GP 是以觀測擬合後的 mean elements，應搭配 SGP4 使用；格式不是任意 propagator 可直接使用的精確 osculating state。[CelesTrak 格式說明](https://celestrak.org/NORAD/documentation/gp-data-formats.php)、[Vallado 等人的 SGP4 論文與測試](https://celestrak.org/publications/AIAA/2006-6753/)支持這個實作基礎。

`BSTAR` 是模型中的拖曳相關參數，不能單獨反推出可靠質量或尺寸。光學亮度、radar cross section 也需要形狀、材料、姿態與觀測模型，不能直接當質量。此 repo 不匯入或推算這些物理性質。

## 格式與時間

- GP JSON：支援 CelesTrak 風格的 OMM-keyword 子集，Earth／TEME／UTC／SGP4，非完整 CCSDS OMM XML／KVN reader。未提供的固定 metadata 依這個格式的已知約定補上；明確不同的 metadata 會拒絕。
- TLE：接受具／不具名稱列的兩行資料、驗證兩行 catalog ID 及 checksum、支援數字與 Alpha-5 catalog ID。原始兩行直接供傳播，不經 OMM 再轉 TLE。
- GP JSON 保留大於五位數的 catalog IDs，不截斷、不強制轉 TLE。
- 拒絕重複 ID、非有限值、明顯無效範圍、無效 UTC、offset epoch 及 leap second。這不是所有國際時間標準的完整實作。
- JavaScript 日期為 UTC 毫秒。原始 GP epoch 可有微秒，但 `satellite.js 7.1.0` 初始化時使用 JS Date；因此實際計算 epoch 有毫秒量化。來源原值仍保留於 payload。
- signed epoch offset 是預測時刻減元素 epoch，負數表示在元素 epoch 之前。它不是位置誤差估計。

## Conjunction geometry

在同一時刻取 TEME 狀態，令 `dr = r_secondary - r_primary`，`dv = v_secondary - v_primary`。

```text
miss distance at candidate TCA = ||dr||                 [km]
relative velocity             = ||dv||                 [km/s]
range rate                    = dot(dr,dv) / ||dr||    [km/s]
```

相對速度不同於物體絕對速度，也不同於 range rate。核心用 `dot(dr,dv)` 的負到非負跨越來 bracket 距離平方的極小值，逐一二分至 20 ms，再檢查前後狀態。搜尋不以粗取樣距離先刪除候選；視窗邊界不收為 TCA。相同元素 representation 會排除並記錄理由。

這仍是 cadence-limited 數值搜尋，無法保證同一取樣間隔內多個 extrema 都被發現。傳播失敗的區間不連接、不補值；結果標為 partial。未找到事件不能推論軌道安全。選定幾何 threshold 只影響匹配標記，不改變碰撞機率，也不代表完整 catalog 的覆蓋。

## 不確定度與 Pc

本版不發明 covariance、不把 TLE 年齡換成固定 error bar，也不以 miss distance 轉成風險百分比。GP 定位品質受目標、觀測、拖曳、未建模機動與 epoch offset 影響，不能宣稱單一通用精度。

未來即使取得 covariance，也需確認 epoch、座標系、單位、正定性、相關性、代表性、hard-body geometry 與所用 Pc 方法的適用條件。加入一個公式不代表建立可信 collision assessment。實際營運流程與風險分析資源可參考 [NASA CARA](https://www.nasa.gov/conjunction-assessment/)。

## ADR proxy

由 mean motion 算出等效半長軸 `a = (mu / n²)^(1/3)`。這是 approximate mean geometry，不能當精確軌道解。

軌道面角度使用 inclination 和 RAAN 的法向量夾角，不只比較 inclination：

```text
cos(alpha) = cos(i1)cos(i2) + sin(i1)sin(i2)cos(RAAN1 - RAAN2)
```

當兩者 eccentricity ≤ 0.02，自訂研究 applicability gate 才顯示：

- 理想兩體、瞬時推進、共面圓軌道的 Hohmann altitude-transfer proxy。
- 在 reference 圓軌道速度下，單獨進行 plane change 的 `2 v sin(alpha/2)` proxy。

兩數不合併成完整任務 Δv。共同／最佳 plane change、相位、epoch 對齊、有限推力、推進劑、目標質量、捕獲與處置均未解。原始 mean elements 在各自 epoch 比較，沒有傳播到共同 epoch；資料時間差寫入 target brief。輸出不得標示為「能到達」「能清除」或最佳目標排序。

## 驗證方法

1. **解析案例**：直線掠過的已知 TCA／miss、週期多極小值、邊界排除、失敗區間不可跨接。
2. **座標與量綱**：relative speed、ECEF 旋轉速度項、RIC reference rotation。
3. **模型適用性**：同軌 proxy 為零、RAAN 改變會影響 plane angle、高 eccentricity 拒絕。
4. **獨立實作**：`python-sgp4==2.27`、WGS72、improved mode，包含公開 GP 與 Vallado 近地／深空 TLE 共 18 個狀態。
5. **工作流**：API 儲存／重開、event ownership、格式錯誤、報告及瀏覽器端到端。

Independent reference 容差：GP position <10 m、velocity <0.02 m/s；TLE position <0.1 m、velocity <0.001 m/s。GP 容差允許來源微秒 epoch 與 JS 初始化的差異，不是任務要求。Reference 固定檔帶原始輸入檔 hash，改資料時不能默默沿用舊的 passed fixture。

獨立 fixture 證明的是特定輸入的實作一致性。尚無實際精密 ephemeris／追蹤真值比對、coverage 完整性證明、近距導航驗證或飛行驗證。

## Fetscape 故障對照與機構演練

腳本使用的 weak_thrust seed 7 來自獨立 HCW／Kalman 研究，非 SGP4 或近距 3D controller。130 s 起推力可用度為 30%，650 s 終點分離為 baseline 59.52010643477721 m、revised 129.76978101130004 m。100 m 是自訂終點判準，不是最小距離或一般任務標準。改版取得 simulator-provided thrust availability，並未示範真實故障診斷。固定資料、來源 hash、假設與重跑指令見 `data/verification/README.md`。

機構演練現在會以作者指定的 pivots、skin weights、bones 與 IK 驅動實際 Meshy 網格。它能驗證軟體順序與幾何輸出；不能驗證力、扭矩、可抓取表面、摩擦、衝擊、組合體控制或硬體 latch。抓點使用合成形狀上的 authored anchors，沒有 image-derived relative pose。這些界線在 HUD、機構區及匯出中保存。
