# Data provenance

`public-omm.json` 是 2026-11-10 12:46:39 UTC 已取得的 CelesTrak `stations` 快照之七物體子集。原始快照共 19 個物體，來源 hash 與選樣說明記錄於 `provenance.json`。這次建置沒有重新下載軌道資料。

選樣包括 ISS、相同元素的 station representation、CSS、FREGAT DEB、DUPLEX、KNACKSAT-2 及一個六位數 catalog ID，用於重播、去重與識別碼測試。它不是完整衛星／碎片目錄。物體名稱不等於已確認的運作狀態、所有權、可捕獲性或清除許可。

合成情境由 `apps/api/src/datasets.ts` 定義，使用 `SIM-*` 識別碼；catalog ID 在產品資料模型中為 null。SGP4 初始化的 0 僅為合成資料內部 placeholder。

匯入資料標為 `user_import`，來源文字由使用者填寫，不代表本平台驗證過來源真實性、精度或使用授權。匯入時間是本機收到資料的時間，不是感測或產生時間。

- [CelesTrak GP formats](https://celestrak.org/NORAD/documentation/gp-data-formats.php)
- [CelesTrak usage policy](https://celestrak.org/usage-policy.php)

本機展示採凍結資料，沒有自動更新、重試、公開轉發或資料供應商訂閱。後續商用、重新散布或來源整合需確認適用條款與合約；可公開讀取不表示可任意轉授權。
