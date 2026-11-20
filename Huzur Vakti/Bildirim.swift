//
//  Bildirim.swift — 1.9.4 "Ezan bildirimleri hiç kesilmesin"
//
//  Web (app.js) 30 günlük bildirim planını tek mesajla ('bildirim-plani', JSON dizi) gönderir.
//  iPhone en fazla 64 bekleyen bildirim tutabildiği için plan burada saklanır ve en yakın
//  ~58 tanesi kurulur. Uygulama her açıldığında, her bildirim geldiğinde ve iOS arka planda
//  izin verdikçe (BGAppRefreshTask) sıradakiler eklenir. Kurulu son günden bir gün önce
//  "uygulamayı bir kez aç" hatırlatması da kurulur (arka plan hiç çalışmazsa diye).
//

import Foundation
import UserNotifications
import BackgroundTasks

enum HVBildirimPlani {
    private static let anahtar = "hv_bildirim_plani"
    private static let sinir = 58          // 64'ün altında kal (Canlı etkinlik / push vb. için pay)
    private static let hatirlatId = "hv_hatirlat_ac"
    static var gorevId: String { (Bundle.main.bundleIdentifier ?? "com.huzurvakti.namazvakitleri") }

    // MARK: kayıt

    static func kaydet(_ govde: Any) {
        var dizi: [[String: Any]] = []
        if let s = govde as? String, let d = s.data(using: .utf8),
           let j = try? JSONSerialization.jsonObject(with: d) as? [[String: Any]] {
            dizi = j
        } else if let j = govde as? [[String: Any]] {
            dizi = j
        }
        // yalnız geçerli öğeler (id + timestamp)
        let temiz = dizi.filter { ($0["id"] as? String) != nil && zaman($0) != nil }
        if let d = try? JSONSerialization.data(withJSONObject: temiz) {
            UserDefaults.standard.set(d, forKey: anahtar)
        }
        doldur()
        arkaPlanIste()
    }

    static func temizle() {
        UserDefaults.standard.removeObject(forKey: anahtar)
    }

    private static func plan() -> [[String: Any]] {
        guard let d = UserDefaults.standard.data(forKey: anahtar),
              let j = try? JSONSerialization.jsonObject(with: d) as? [[String: Any]] else { return [] }
        return j
    }

    private static func zaman(_ o: [String: Any]) -> TimeInterval? {
        if let t = o["timestamp"] as? TimeInterval { return t }
        if let n = o["timestamp"] as? NSNumber { return n.doubleValue }
        return nil
    }

    // MARK: kurma

    /// Plandaki en yakın bildirimleri kurar; zaten kurulu olanlara dokunmaz.
    static func doldur(_ bitti: (() -> Void)? = nil) {
        let p = plan()
        guard !p.isEmpty else { bitti?(); return }
        let simdi = Date().timeIntervalSince1970
        let gelecek = p.filter { (zaman($0) ?? 0) > simdi + 15 }
            .sorted { (zaman($0) ?? 0) < (zaman($1) ?? 0) }
        let planHatirlat = gelecek.first { ($0["id"] as? String) == hatirlatId }
        let normal = gelecek.filter { ($0["id"] as? String) != hatirlatId }
        let secilen = Array(normal.prefix(sinir))
        let hepsiSigdi = normal.count <= sinir

        let merkez = UNUserNotificationCenter.current()
        merkez.getPendingNotificationRequests { bekleyen in
            let kurulu = Set(bekleyen.map { $0.identifier })
            for o in secilen {
                guard let id = o["id"] as? String, !kurulu.contains(id), let t = zaman(o) else { continue }
                merkez.add(istek(id: id, o: o, t: t), withCompletionHandler: nil)
            }
            // hatırlatma: plan tamamen sığdıysa web'in kendi hatırlatması, sığmadıysa kurulu son günden önce
            merkez.removePendingNotificationRequests(withIdentifiers: [hatirlatId])
            if hepsiSigdi {
                if let h = planHatirlat, let t = zaman(h) { merkez.add(istek(id: hatirlatId, o: h, t: t), withCompletionHandler: nil) }
            } else if let son = secilen.last, let st = zaman(son) {
                let sonTarih = Date(timeIntervalSince1970: st)
                let cal = Calendar.current
                var at = cal.date(bySettingHour: 21, minute: 0, second: 0, of: cal.date(byAdding: .day, value: -1, to: sonTarih) ?? sonTarih) ?? sonTarih
                if at.timeIntervalSince1970 <= simdi + 3600 { at = sonTarih.addingTimeInterval(-1800) }
                if at.timeIntervalSince1970 > simdi + 3600 {
                    let f = DateFormatter(); f.locale = Locale(identifier: "tr_TR"); f.dateFormat = "d MMMM EEEE"
                    let o: [String: Any] = [
                        "title": "🔔 Ezan bildirimlerin bitmek üzere",
                        "body": "Vakit bildirimlerin \(f.string(from: sonTarih)) gününe kadar kurulu. Devam etmesi için Namaz Dostu'nu bir kez açman yeterli.",
                        "sound": "default"
                    ]
                    merkez.add(istek(id: hatirlatId, o: o, t: at.timeIntervalSince1970), withCompletionHandler: nil)
                }
            }
            bitti?()
        }
    }

    /// ViewController'daki tek tek kurma ile aynı ses kuralları
    static func istek(id: String, o: [String: Any], t: TimeInterval) -> UNNotificationRequest {
        let c = UNMutableNotificationContent()
        c.title = (o["title"] as? String) ?? "Namaz Dostu"
        c.body = (o["body"] as? String) ?? ""
        let ses = (o["sound"] as? String) ?? "default"
        if ses == "none" {
            c.sound = nil
        } else if ses.hasPrefix("ezan") {
            let ad = Bundle.main.url(forResource: ses, withExtension: "caf") != nil ? ses : "ezan"
            c.sound = Bundle.main.url(forResource: ad, withExtension: "caf") != nil
                ? UNNotificationSound(named: UNNotificationSoundName(rawValue: "\(ad).caf"))
                : UNNotificationSound.default
        } else if ses == "bip", Bundle.main.url(forResource: "bip", withExtension: "caf") != nil {
            c.sound = UNNotificationSound(named: UNNotificationSoundName(rawValue: "bip.caf"))
        } else {
            c.sound = UNNotificationSound.default
        }
        let bilesen = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute, .second], from: Date(timeIntervalSince1970: t))
        return UNNotificationRequest(identifier: id, content: c, trigger: UNCalendarNotificationTrigger(dateMatching: bilesen, repeats: false))
    }

    // MARK: arka plan (BGAppRefreshTask)

    /// didFinishLaunching içinde, uygulama açılış işi bitmeden çağrılmalı
    static func arkaPlanKaydet() {
        BGTaskScheduler.shared.register(forTaskWithIdentifier: gorevId, using: nil) { gorev in
            arkaPlanIste()   // bir sonrakini de iste
            var bittiMi = false
            gorev.expirationHandler = { if !bittiMi { bittiMi = true; gorev.setTaskCompleted(success: false) } }
            doldur {
                DispatchQueue.main.async { if !bittiMi { bittiMi = true; gorev.setTaskCompleted(success: true) } }
            }
        }
    }

    static func arkaPlanIste() {
        guard !plan().isEmpty else { return }
        let r = BGAppRefreshTaskRequest(identifier: gorevId)
        r.earliestBeginDate = Date().addingTimeInterval(6 * 3600)
        try? BGTaskScheduler.shared.submit(r)
    }
}
