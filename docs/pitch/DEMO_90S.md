# Fetscape：90 秒 Demo 錄製版

更新：2026-11-11。這是錄影講稿與分鏡，尚未錄製或用真人錄音驗證長度。

## 核心定位

工程師在執行軌道機動前，需要判斷接近事件如何發展、計畫是否可行，以及性能下降時能否退出。產品方向是支援避碰分析與碎片移除任務規劃的軟體。

兩種應用共享相對位置、速度與軌跡預測的基礎；避碰風險評估還需要可信的不確定性資料，捕獲還需要相對姿態、角速度、抓點追蹤與接觸控制。它們需要不同模型與驗證，不能以同一項示範代表兩種任務都已完成。

目前可展示：公開軌道資料的幾何預測，以及另一個獨立的合成接近／退出模擬。尚未展示：操作等級碰撞機率、避碰機動規劃、真實感知或捕獲、整合後的平台。

首選試點對象是衛星服務／RPO公司的任務與GNC工程團隊。其是否願意付費、是否能較早發現規劃錯誤，都是待測的商業假說。

## 英文旁白與分鏡

品牌句：**Plan the approach. Test the escape.**。Fetscape結合fetching與escaping，分別對應受控接近及避讓／退出。

### 0:00–0:22｜痛點與產品

In orbit, engineers must decide when to avoid another object, and how to approach one for servicing. Position and speed alone do not show whether a planned maneuver will work when conditions change.

We're building Fetscape: software for collision-avoidance analysis and debris-removal mission planning.

畫面：兩條任務路徑「Avoid an unwanted encounter」與「Approach under control」，接Fetscape產品標題。這是示意圖；保留產品正在建構的語意。

### 0:22–0:35｜展示軌道幾何預測

Here, our first prototype uses public orbital data to predict closest approach, separation, and relative speed. This is a wide-separation reference, not a collision warning.

畫面：本機A跳至最近接近時刻，顯示80.8 km、3.360 km/s與資料來源時間。標示「Public-data geometry」及「Wide-separation reference」。這個案例與下一段的合成目標不同。

### 0:35–1:02｜展示推力故障對照

In a separate simulation, only thirty percent of thrust remains after a fault. At the end, the original model, still assuming full thrust, finishes sixty meters away. Using simulator-provided thrust availability, the revision finishes one hundred thirty meters away, passing our custom end-distance criterion.

畫面：B示範或既有第5頁對照圖。固定weak_thrust、seed7；模擬第130秒時推力降至額定值30%。兩線動畫播放至第650秒，顯示原版59.5 m、改版129.8 m，並加上100 m自訂退出驗收線。固定顯示「At t = 650 s · Custom criterion: final separation ≥ 100 m」。

保留「Synthetic simulation」及「Simulator-provided thrust availability」。改版取得模擬器直接提供的實際可用推力比例，並非已經證明硬體故障可被偵測。原版未達退出門檻，不等於發生碰撞；改版通過這個案例，也不代表所有故障都可安全退出。

### 1:02–1:15｜講清共通技術與捕獲差異

These applications share relative-motion prediction. Collision assessment also requires validated uncertainty. Capturing debris adds target rotation, grasp-point tracking, and contact control.

畫面：中央「Relative-motion prediction」，兩側列避碰與捕獲的額外要求。捕獲圖標示「Future work」。可用抓點速度公式 v_grasp = v_COM + ω × r_offset 作圖示；不要把目前點質量模擬畫成已實現的機械臂捕獲。

### 1:15–1:27｜交代現況與下一步

Today, we demonstrate orbital geometry and synthetic approach testing. Our next step is a pilot with a satellite-servicing team, testing whether these scenarios expose planning mistakes before execution.

畫面：「Next: one engineering pilot」。試點預計使用有授權的工程案例，比較現有工作流程與本工具發現問題的能力及所需時間；尚無已確認合作或商業成效。

### 1:27–1:30｜結尾停頓

只留Fetscape結尾卡，無新增旁白。

## 錄製依據

- 幾何案例：既有本機原型的公開GP資料重播；80.8 km是廣距參考，不能描述成真實碰撞威脅。
- 故障案例：同目錄demo-chart-data.json；weak_thrust、seed7，原版最終59.520106 m，改版129.769781 m；是同一套研究模擬條件的對照。
- 自訂退出條件：模擬第650秒時距離至少100 m。130 m是控制器目標，並非通用安全距離。
- 共通技術不代表單一已驗證引擎：A使用SGP4傳播公開軌道資料；B使用合成動態模型、相對狀態估測及控制。
- 暫不在90秒內放入公司名單、創辦人背景、定價或合作成果。公司名單及商業假說留在完整pitch。
- 秒數是剪輯目標；英文口說會把連字詞拆開，需保留畫面停頓並以實際錄音確認90秒。

## 查核來源

- [NASA CARA：接近幾何與碰撞風險的區別](https://www.nasa.gov/cara/step-2-close-approach-risk-assessment/)：相近軌跡不等同碰撞風險；機率計算須考慮軌跡不確定性。
- [Starfish Space：Otter技術架構](https://www.starfishspace.com/the-otter/)：業者分別描述相對位置／速度／姿態感知、導引與控制、實體接合裝置；這支持我們區分計算、控制與硬體接觸的必要性，並非Fetscape已具備這些能力的證據。
- [既有技術研究](../technical-foundation-2026-11-11/TECHNICAL_RESEARCH.md)與[統整講稿](PITCH_SCRIPT.md)。
