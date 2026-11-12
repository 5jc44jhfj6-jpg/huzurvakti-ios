//
//  NDCanli.swift — Kilit ekranında / Dynamic Island'da canlı geri sayım (Live Activity)
//  Hem ana uygulamada hem widget uzantısında derlenir (widget_ekle.rb ekler).
//

import Foundation
#if canImport(ActivityKit)
import ActivityKit
#endif

@available(iOS 16.1, *)
struct NDVakitAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var ad: String          // sıradaki vakit adı (ör. "İkindi")
        var saat: String        // "15:35"
        var hedef: Date         // sıradaki vaktin zamanı
        var baslangic: Date     // bir önceki vakit (ilerleme çubuğu için)
        var sonrakiAd: String   // ondan sonraki vakit
        var sonrakiSaat: String
    }
    var sehir: String
}

#if !WIDGET_EXTENSION
/// Ana uygulama tarafı: widget verisinden sıradaki vakti hesaplar, canlı etkinliği başlatır/günceller.
enum NDCanliYonetici {
    static let adlar = ["İmsak", "Güneş", "Öğle", "İkindi", "Akşam", "Yatsı"]
    static var acik: Bool {
        get { (UserDefaults.standard.object(forKey: "nd_canli_acik") as? Bool) ?? true }
        set { UserDefaults.standard.set(newValue, forKey: "nd_canli_acik") }
    }

    private static func tarih(_ gun: String, _ saat: String) -> Date? {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone.current
        f.dateFormat = "yyyy-MM-dd HH:mm"
        return f.date(from: gun + " " + String(saat.prefix(5)))
    }

    /// json: web'in widget-data çıktısı
    static func guncelle(json: String?) {
        guard #available(iOS 16.2, *) else { return }
        guard acik else { bitir(); return }
        guard let j = json, let d = j.data(using: .utf8),
              let o = try? JSONSerialization.jsonObject(with: d) as? [String: Any],
              let gunler = o["gunler"] as? [[String: Any]] else { return }
        var liste: [(i: Int, t: Date, s: String)] = []
        for g in gunler {
            guard let gun = g["d"] as? String, let t = g["t"] as? [String], t.count >= 6 else { continue }
            for i in 0..<6 { if let z = tarih(gun, t[i]) { liste.append((i, z, String(t[i].prefix(5)))) } }
        }
        liste.sort { $0.t < $1.t }
        let simdi = Date()
        guard let ix = liste.firstIndex(where: { $0.t > simdi }) else { bitir(); return }
        let s = liste[ix]
        // 1.9.3: sayaç yalnızca vakte son 1 saat kala görünür (şarj + sade kilit ekranı).
        // iOS, sunucu olmadan canlı etkinliği kendiliğinden başlatmaya izin vermez: uygulama bu 1 saat içinde
        // açılınca (ya da "önceden hatırlat" bildirimine dokununca) başlar, ezan vaktinde biter.
        if s.t.timeIntervalSince(simdi) > 3600 { bitir(); return }
        let once = max(ix > 0 ? liste[ix - 1].t : s.t.addingTimeInterval(-3600), s.t.addingTimeInterval(-3600))
        let sonra = ix + 1 < liste.count ? liste[ix + 1] : s
        let durum = NDVakitAttributes.ContentState(ad: adlar[s.i], saat: s.s, hedef: s.t, baslangic: once,
                                                    sonrakiAd: adlar[sonra.i], sonrakiSaat: sonra.s)
        let sehir = (o["sehir"] as? String) ?? ""
        let icerik = ActivityContent(state: durum, staleDate: s.t)
        Task {
            let mevcut = Activity<NDVakitAttributes>.activities
            if let a = mevcut.first {
                await a.update(icerik)
                for fazla in mevcut.dropFirst() { await fazla.end(nil, dismissalPolicy: .immediate) }
            } else if ActivityAuthorizationInfo().areActivitiesEnabled {
                _ = try? Activity.request(attributes: NDVakitAttributes(sehir: sehir), content: icerik, pushType: nil)
            }
        }
    }

    static func bitir() {
        guard #available(iOS 16.2, *) else { return }
        Task { for a in Activity<NDVakitAttributes>.activities { await a.end(nil, dismissalPolicy: .immediate) } }
    }

    /// Web'den gelen aç/kapa ("canli" mesajı)
    static func ayar(_ ac: Bool) {
        acik = ac
        if ac { guncelle(json: UserDefaults(suiteName: WidgetBridge.grup)?.string(forKey: "veri")) } else { bitir() }
    }
}
#endif
