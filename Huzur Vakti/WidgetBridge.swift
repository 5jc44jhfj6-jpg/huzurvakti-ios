//
//  WidgetBridge.swift — web (WKWebView) ile ana ekran widget'ları arasındaki köprü
//  Web 'widget-data' mesajıyla JSON gönderir → App Group'a yazılır → widget'lar yenilenir.
//  Widget'ta işaretlenen namazlar uygulama açılınca web'e (hvWidgetTakipAl) aktarılır.
//

import Foundation
import WebKit
import WidgetKit

enum WidgetBridge {
    static let grup = "group.com.huzurvakti.namazvakitleri"
    static var defaults: UserDefaults? { UserDefaults(suiteName: grup) }
    static var sayfaHazir = false
    static var bekleyenHedef: String? = nil
    static let izinliHedefler = ["kuran", "kible", "zikir", "dua", "takip", "vakit", "ayet"]

    /// Web'den gelen veri
    static func veriGeldi(_ body: Any) {
        var json: String? = body as? String
        if json == nil, JSONSerialization.isValidJSONObject(body),
           let d = try? JSONSerialization.data(withJSONObject: body) {
            json = String(data: d, encoding: .utf8)
        }
        guard let j = json, let ud = defaults else { return }
        ud.set(j, forKey: "veri")
        // Widget'ta henüz uygulamaya aktarılmamış işaret yoksa takip durumunu web'den al
        if !ud.bool(forKey: "takipBekleyen"),
           let data = j.data(using: .utf8),
           let o = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let t = o["takip"] as? [String: Any] {
            ud.set(t, forKey: "takip")
        }
        yenile()
    }

    static func yenile() {
        WidgetCenter.shared.reloadAllTimelines()
    }

    /// Uygulama öne gelince / sayfa yüklenince çağrılır
    static func uygulamaAcildi() {
        guard sayfaHazir, let wv = webView else { return }
        if let ud = defaults, ud.bool(forKey: "takipBekleyen"),
           let t = ud.dictionary(forKey: "takip"),
           JSONSerialization.isValidJSONObject(t),
           let data = try? JSONSerialization.data(withJSONObject: t),
           let s = String(data: data, encoding: .utf8) {
            wv.evaluateJavaScript("window.hvWidgetTakipAl && hvWidgetTakipAl(\(s)); window.hvWidgetGonder && hvWidgetGonder(true); true;") { _, hata in
                if hata == nil { ud.set(false, forKey: "takipBekleyen") }
            }
        } else {
            wv.evaluateJavaScript("window.hvWidgetGonder && hvWidgetGonder(true); true;", completionHandler: nil)
        }
        if let h = bekleyenHedef {
            bekleyenHedef = nil
            wv.evaluateJavaScript("window.hvWidgetAc && hvWidgetAc('\(h)'); true;", completionHandler: nil)
        }
    }

    static func sayfaYuklendi() {
        sayfaHazir = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { uygulamaAcildi() }
    }

    /// namazdostu://ac/<hedef> bağlantıları. Bizimse true döner.
    @discardableResult
    static func baglanti(_ u: URL) -> Bool {
        guard u.scheme?.lowercased() == "namazdostu" else { return false }
        let h = (u.host == "ac" ? u.lastPathComponent : (u.host ?? "")).lowercased()
        if izinliHedefler.contains(h) {
            bekleyenHedef = h
            if sayfaHazir {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { uygulamaAcildi() }
            }
        }
        return true
    }
}
