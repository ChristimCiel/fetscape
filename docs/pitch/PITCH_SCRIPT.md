# Fetscape 英文簡報講稿

日期：2026-11-11，Asia/Taipei。對應更新後的既有簡報，主線13頁，另有9頁技術與成本附錄。以下為錄音與演講文字，尚未錄製音訊或影片。

品牌：Fetscape，取自fetching與escaping。封面句：Plan the approach. Test the escape.。產品方向：避碰分析與碎片移除任務規劃軟體。

## 30 秒介紹

We're building Fetscape: software for collision-avoidance analysis and debris-removal mission planning. Engineers need to know whether an approach remains feasible when conditions change. Our prototypes demonstrate orbital geometry and synthetic withdrawal testing under reduced thrust. We're seeking a servicing team and an RPO/GNC specialist to test one mission case and measure whether the scenarios expose planning mistakes earlier.

## 3 分鐘逐頁主講稿

目標總長180秒。約362個英文詞，需以實際語速排練。主講至第13頁結束，附錄留給問答。

### 第1頁 0:00 至 0:14

Plan the approach. Test the escape.

We're building Fetscape: software for collision-avoidance analysis and debris-removal mission planning. The name connects fetching with escaping: planning a controlled approach, and testing when and how to withdraw.

先說我們幫誰做什麼，再把現在的兩個本機示範與整合產品願景分清。

### 第2頁 0:14 至 0:27

Decisions before an orbital encounter

Engineers must decide whether to avoid an encounter or approach a target for servicing. They need to test whether the plan remains feasible when conditions change.

問題真實存在；我們是否有值得付費的缺口，仍須訪談。

### 第3頁 0:27 至 0:41

Relative motion is the shared foundation

Both applications use relative position, velocity, and trajectory prediction. Collision assessment adds uncertainty; capture adds rotation and contact. We propose shared interfaces; today's demonstrators run independently.

共用資料與可追溯性，依任務階段選模型，不把SGP4說成通用捕獲引擎。

### 第4頁 0:41 至 0:55

Prototype A: predicted orbital encounters

Public orbital data predicts closest approach, separation, and relative speed. This eighty-point-eight-kilometer example demonstrates geometry at wide separation. Operational collision-risk assessment needs additional validated inputs.

展示播放、來源、事件紀錄；80.8公里不是碰撞警告。

### 第5頁 0:55 至 1:13

Prototype B: withdrawal after reduced thrust

In our separate simulation, thirty percent of thrust remains. At the end, the original model finishes sixty meters away. Using simulator-provided thrust availability, the revision ends one hundred thirty meters away, passing our custom end-distance criterion.

兩條線取同一seed。關鍵是錯誤推力假設如何改變退出結果，不把健康回報說成已做硬體故障診斷。

### 第6頁 1:13 至 1:30

Capture requires tracking a rotating grasp point

Capture requires matching a moving grasp point. At two meters from a three-degree-per-second spin axis, that point moves about zero-point-one-zero-five meters per second. Position and velocity at the target's center are insufficient.

手臂要追抓點的位置與速度。目標重心速度匹配仍不夠。

### 第7頁 1:30 至 1:44

Demonstrated capability and development gates

We demonstrate orbital geometry and synthetic approach testing. Operational uncertainty, image-based pose estimation, and contact control remain development gates. Customer trials must test whether this finds planning mistakes earlier.

哪些欄位有來源、哪些未知，保持清楚。不能用AI補質量、姿態或風險值。

### 第8頁 1:44 至 1:58

First pilot: approach and withdrawal analysis

Our initial user hypothesis is a servicing-mission or GNC engineer. A proposed four-to-six-week pilot compares approach and degraded-thrust scenarios with the team's current process, using agreed acceptance criteria.

先賣明確工作包，量現有工時與缺漏，再決定授權或訂閱。

### 第9頁 1:58 至 2:10

Existing tools are the comparison baseline

Existing data services, analysis tools, and internal GNC teams set the baseline. Differentiation requires a measurable improvement in finding problems or reviewing a mission case.

成熟工具是基準也是可整合資源；不能以有3D或有公式當護城河。

### 第10頁 2:10 至 2:24

Customer prospects and collaborators

We would approach Astroscale and ClearSpace for engineering discussions, and Starfish to challenge our assumptions. TASA could introduce specialists; LeoLabs is a potential supplier. No partnerships are confirmed. Government funding is conditional.

名單按買家假說、技術反證、轉介、供應商分清。第一封只請求評閱或走讀，不宣稱已合作。

### 第11頁 2:24 至 2:35

Maritime navigation informs the product workflow

My maritime navigation, watchkeeping, and software experience informs workflow design. An orbital-mechanics and GNC specialist must validate our models and mission requirements.

使用你明確提供的經驗，別把海事操作類比說成航太專業已足夠。

### 第12頁 2:35 至 2:49

A 90-day customer validation plan

Our ninety-day targets are five interviews across two organizations, one authorized case, and one paid pilot. We would compare findings and review effort, then test reuse on a second case.

把每階段當投資門檻，有證據才擴充；不把目標數字當已完成。

### 第13頁 2:49 至 3:00

One mission case, one engineering pilot

We are seeking a servicing team and an RPO/GNC lead for one pilot, with an agreed case, acceptance criteria, and commercial scope.

收束到一個可驗收試點與缺少的專業，避免用巨大願景掩蓋當前門檻。

## 90 秒 Demo 影片講稿

本版以任務痛點、兩個獨立示範與故障對照為主線。約162個英文詞；90秒包含畫面停頓，實際長度仍須錄音排練。

In orbit, engineers must decide when to avoid another object, and how to approach one for servicing. Position and speed alone do not show whether a planned maneuver will work when conditions change.

We're building Fetscape: software for collision-avoidance analysis and debris-removal mission planning.

Here, our first prototype uses public orbital data to predict closest approach, separation, and relative speed. This is a wide-separation reference, not a collision warning.

In a separate simulation, only thirty percent of thrust remains after a fault. At the end, the original model, still assuming full thrust, finishes sixty meters away. Using simulator-provided thrust availability, the revision finishes one hundred thirty meters away, passing our custom end-distance criterion.

These applications share relative-motion prediction. Collision assessment also requires validated uncertainty. Capturing debris adds target rotation, grasp-point tracking, and contact control.

Today, we demonstrate orbital geometry and synthetic approach testing. Our next step is a pilot with a satellite-servicing team, testing whether these scenarios expose planning mistakes before execution.

## Demo 分鏡

| 秒數 | 畫面 | 操作與標示 |

| --- | --- | --- |

| 0–22 | 任務示意與產品標題 | 避開不希望發生的接近／完成受控接近；Fetscape標為正在建構的軟體方向 |

| 22–35 | 本機A操作畫面 | 跳到TCA，保留80.8km、3.360km/s、來源時間；標示Public-data geometry／wide-separation reference |

| 35–62 | 第5頁或B示範的對照曲線 | 相同weak_thrust、seed7；130秒時推力降至30%；650秒時59.5m對129.8m，並顯示自訂100m退出門檻；標示Synthetic／ideal thrust feedback |

| 62–75 | 共用基礎與捕獲需求示意 | 共用相對運動預測；避碰另需不確定性，捕獲另需旋轉、抓點與接觸控制；捕獲整合標為future work |

| 75–87 | 下一步試點卡 | 首選試點對象為satellite-servicing engineering team；測試能否較早發現規劃錯誤，尚未驗證商業效益 |

| 87–90 | Fetscape結尾卡 | 停頓3秒；既有兩個示範與整合產品願景分清 |

## 數字讀法與問答

- `80.8 km`：eighty point eight kilometers。模型預測的廣距參考案例，不叫威脅。

- `0.105 m/s`：zero point one zero five meters per second。2m垂直槓桿臂、3°/s的假設例。

- `180 model runs`：限定模型與種子的研究試驗，不叫flight tests或可靠度。

- `GP`：General Perturbations。`RPO`：Rendezvous and Proximity Operations。`GNC`：Guidance, Navigation and Control。

- 若問能否實際捕獲：目前展示幾何、合成接近／退出與力學算例；真實捕獲需感知、機構、6DoF接觸及任務驗收。

- 若問怎麼賺錢：先定義有驗收的工程試點，量工時／漏項與可重用性，才決定授權或訂閱。

- 若問政府是否會買：既有program顯示任務需求；目前先找整合商工作包，申請資格與開放題目尚未核實。

- 若問需要多少錢：附錄US$19.8k是單一試點的假設交付經濟成本，含imputed labor，並非cash burn、公司runway或本次募資額。

- 若問護城河：目前未建立。要以實際流程整合、可重複交付與客戶採用驗證。

## 附錄使用順序

第14頁TCA與frame；第15頁轉移與相位；第16頁HCW/KF；第17頁停止距離；第18頁接觸與角動量；第19頁成本；第20頁捕獲流程與驗證關卡；第21至22頁來源。

所有主頁附有英文逐頁講稿、中文提示與來源備註。時間是排練目標，未以Tim實際錄音驗證。
