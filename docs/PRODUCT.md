# Fetscape：產品主張與目前範圍

**Plan the approach. Test the escape.**

最新使用者要求：讓軟體展示符合目前 Fetscape 講稿及價值主張。對齊來源為本 repo 保存的 [90 秒稿](pitch/DEMO_90S.md) 與 [完整講稿](pitch/PITCH_SCRIPT.md)，來源 hash 見 `docs/pitch/SOURCE.json`。它取代本 repo 早期以衛星營運 review 為第一個商業切入點的建議。

## 第一個客戶與價值假說

先面向衛星服務／RPO 公司的任務與 GNC 工程團隊，定義一個四至六週的工程試點：以授權案例比較原本流程與本工具，測試是否能在執行前較早發現規劃錯誤，以及是否改善 review 工作量與證據可追溯性。

這是待驗證的價值主張。沒有已確認 design partner、付費客戶、節省比例、硬體成功率或採購承諾。公開資料、3D、IK 或公式都不構成護城河；要以實際案例、工作流整合、重複使用與付費驗收建立證據。

## 展示如何對應講稿

| 講稿                   | 實際畫面／功能                                                                                                    | 能力界線                                                                                        |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 預測接近幾何           | 公開 GP／SGP4 的 TCA、miss、相對速度；腳本入口指定 ISS–DUPLEX 的 80.8 km 廣距參考                                 | 不稱碰撞警告；沒有本版 Pc 所需 uncertainty inputs                                               |
| 推力下降時測試退出     | seed 7、weak_thrust 凍結對照；130 s 起剩 30% 推力，650 s 原版 59.520106 m、改版 129.769781 m                      | 來自獨立研究模型；改版拿到 simulator-provided thrust availability，未驗證故障診斷或通用安全退出 |
| 捕獲增加旋轉與接觸問題 | 第一人稱／機構相機；實際 collector 拆件與 arm mesh 的 authored joint animation；抓點速度公式與 2 m／3°/s 參考算例 | 合成抓點與 IK；沒有 image pose estimation、真實接觸、力感測或硬體 latch verification            |
| 可檢查的決策證據       | 匯出分析、人工 review 或機構演練；後者附 rig 定義、入口門檻、階段、抓點／末端幾何、來源與已檢視的故障對照         | 記錄是本機研究證據，不是任務放行或飛行驗證                                                      |

A 的 SGP4、B 的 HCW/Kalman fault study、C 的局部機構演練是不同模型。介面將其連在同一條 review 動線，沒有宣稱三者已形成一個經驗證的 GNC 系統。選中的 catalog 目標只作 planning context；Meshy 模型不是其真實外形重建。

## 軟體現在能做什麼

共用資料與來源處理、格式驗證、可重現軌道幾何、人工 review、故障對照重播，以及 authored mechanism rehearsal。新版驅動 `model_part3`／`model_part4` 的 pivot，並為連續 robotic-arm 網格建立 base／shoulder／elbow／wrist／finger bones；沒有用替代橫桿冒充實際模型。

更完整的研究／操作能力依次需要：partner 授權需求與狀態資料、適用的 uncertainty、相對姿態與抓點追蹤、接觸／力控與組合體模型、獨立驗證及任務條件。未知質量、尺寸、慣量、姿態與 Pc 不由 AI 補造。

## 商業與團隊

先驗證有範圍、有基準、有驗收的工程 pilot，再決定授權／訂閱。Astroscale、ClearSpace、Starfish 等在講稿中都是接觸候選；TASA 是可能轉介路徑、LeoLabs 是可能供應商，沒有已確認合作。

Tim 的海事導航、值班、radar、ECDIS 與軟體經驗可支持接近作業、資訊品質、異常程序與交接需求。航太模型和 mission requirements 仍需合格 orbital-mechanics／GNC 專家驗證。

90 天目標為五次訪談、涵蓋至少兩個組織、一個授權案例與一個付費 pilot；這些是投資門檻，不是已完成成果。參見 [路線圖](ROADMAP.md) 與 [與腳本相符的點擊順序](pitch/DEMO_CLICK_SHEET.md)。
