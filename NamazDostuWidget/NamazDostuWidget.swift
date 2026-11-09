//
//  NamazDostuWidget.swift — Namaz Dostu ana ekran ve kilit ekranı widget'ları
//  Veri: uygulama (web) her açılışta App Group'a JSON yazar (WidgetBridge.swift).
//

import WidgetKit
import SwiftUI
#if canImport(AppIntents)
import AppIntents
#endif

// MARK: - Ortak sabitler ve renkler

let HV_GRUP = "group.com.huzurvakti.namazvakitleri"

extension Color {
    static let hvKrem = Color(red: 0.984, green: 0.953, blue: 0.890)
    static let hvKrem2 = Color(red: 0.945, green: 0.882, blue: 0.769)
    static let hvEsp = Color(red: 0.169, green: 0.102, blue: 0.063)
    static let hvEsp2 = Color(red: 0.227, green: 0.141, blue: 0.086)
    static let hvAltin = Color(red: 0.788, green: 0.604, blue: 0.294)
    static let hvAltin2 = Color(red: 0.886, green: 0.722, blue: 0.400)
    static let hvKahve = Color(red: 0.42, green: 0.29, blue: 0.17)
}

let hvKremZemin = LinearGradient(colors: [Color.hvKrem, Color.hvKrem2], startPoint: .topLeading, endPoint: .bottomTrailing)
let hvKoyuZemin = LinearGradient(colors: [Color.hvEsp2, Color.hvEsp], startPoint: .top, endPoint: .bottom)
let hvAltinHap = LinearGradient(colors: [Color(red: 0.906, green: 0.769, blue: 0.486), Color.hvAltin], startPoint: .top, endPoint: .bottom)

func hvSerif(_ boy: CGFloat, _ agirlik: Font.Weight = .regular) -> Font {
    .system(size: boy, weight: agirlik, design: .serif)
}

// MARK: - Veri modeli (web'in gönderdiği JSON)

struct HVGun: Codable { let d: String; let h: String?; let t: [String] }
struct HVAyet: Codable { let d: String; let m: String; let k: String; let kk: String? }
struct HVSon: Codable { let ad: String?; let no: Int?; let ayet: Int?; let sayfa: Int?; let hatim: Int? }
struct HVVeri: Codable {
    let sehir: String?
    let gunler: [HVGun]?
    let ayetler: [HVAyet]?
    let son: HVSon?
}

enum HVDepo {
    static var ud: UserDefaults? { UserDefaults(suiteName: HV_GRUP) }

    static func veri() -> HVVeri? {
        guard let s = ud?.string(forKey: "veri"), let d = s.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(HVVeri.self, from: d)
    }

    static func gunAnahtari(_ t: Date) -> String {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: t)
    }

    static let vakitAnahtar = ["sabah", "ogle", "ikindi", "aksam", "yatsi"]

    /// Bugünkü namaz takibi (widget'ta işaretlenen ya da uygulamadan gelen)
    static func takip(_ t: Date = Date()) -> [String: Bool] {
        let bugun = gunAnahtari(t)
        guard let d = ud?.dictionary(forKey: "takip"), (d["d"] as? String) == bugun else {
            return Dictionary(uniqueKeysWithValues: vakitAnahtar.map { ($0, false) })
        }
        var o: [String: Bool] = [:]
        for k in vakitAnahtar { o[k] = (d[k] as? Bool) ?? false }
        return o
    }

    static func takipDegistir(_ vakit: String) {
        guard let ud = ud, vakitAnahtar.contains(vakit) else { return }
        let bugun = gunAnahtari(Date())
        var d: [String: Any] = ud.dictionary(forKey: "takip") ?? [:]
        if (d["d"] as? String) != bugun { d = ["d": bugun]; for k in vakitAnahtar { d[k] = false } }
        d[vakit] = !((d[vakit] as? Bool) ?? false)
        ud.set(d, forKey: "takip")
        ud.set(true, forKey: "takipBekleyen")   // uygulama açılınca web'e aktarılacak
    }
}

// MARK: - Vakit hesabı

let HV_VAKIT_ADLARI = ["İmsak", "Güneş", "Öğle", "İkindi", "Akşam", "Yatsı"]
let HV_KALAN_ETIKET = ["İMSAKA KALAN", "GÜNEŞE KALAN", "ÖĞLEYE KALAN", "İKİNDİYE KALAN", "AKŞAMA KALAN", "YATSIYA KALAN"]
let HV_FOTO = ["vakit_safak", "vakit_sabah", "vakit_ogle", "vakit_ikindi", "vakit_aksam", "vakit_gece"]

struct HVAn {
    let tarih: Date
    let sehir: String
    let hicri: String
    let saatler: [String]          // bugünün 6 vakti "HH:mm"
    let sonraki: Int               // 0...5 (sıradaki vakit; gece yarısından sonra imsak = 0)
    let hedef: Date                // sıradaki vaktin tarihi
    let onceki: Date               // bir önceki vaktin tarihi (halka için)
    let ayet: HVAyet?
    let son: HVSon?
    let takip: [String: Bool]
    let veriVar: Bool

    var foto: String {
        // içinde bulunulan vakte göre fotoğraf (Kul Şerif)
        switch sonraki {
        case 0: return "vakit_gece"
        case 1: return "vakit_safak"
        case 2: return "vakit_sabah"
        case 3: return "vakit_ogle"
        case 4: return "vakit_ikindi"
        default: return "vakit_aksam"
        }
    }
    var tarihYazi: String {
        let f = DateFormatter(); f.locale = Locale(identifier: "tr_TR"); f.dateFormat = "d MMMM EEE"
        return f.string(from: tarih)
    }
    var tarihUzun: String {
        let f = DateFormatter(); f.locale = Locale(identifier: "tr_TR"); f.dateFormat = "d MMMM EEEE"
        return f.string(from: tarih)
    }
    var oran: Double {
        let top = hedef.timeIntervalSince(onceki)
        guard top > 0 else { return 0 }
        return max(0, min(1, tarih.timeIntervalSince(onceki) / top))
    }
}

enum HVHesap {
    static func tarih(_ gun: String, _ saat: String) -> Date? {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone.current
        f.dateFormat = "yyyy-MM-dd HH:mm"
        return f.date(from: gun + " " + String(saat.prefix(5)))
    }

    /// Önümüzdeki tüm vakitler (gün, index, tarih)
    static func vakitler(_ v: HVVeri?) -> [(gun: HVGun, i: Int, t: Date)] {
        var o: [(gun: HVGun, i: Int, t: Date)] = []
        for g in v?.gunler ?? [] where g.t.count >= 6 {
            for i in 0..<6 { if let t = tarih(g.d, g.t[i]) { o.append((g, i, t)) } }
        }
        return o.sorted { $0.t < $1.t }
    }

    static func an(_ simdi: Date, _ v: HVVeri?) -> HVAn {
        let tum = vakitler(v)
        let bugunK = HVDepo.gunAnahtari(simdi)
        let bugun = v?.gunler?.first(where: { $0.d == bugunK }) ?? v?.gunler?.first
        let ayet = v?.ayetler?.first(where: { $0.d == bugunK }) ?? v?.ayetler?.first
        if let ix = tum.firstIndex(where: { $0.t > simdi }) {
            let s = tum[ix]
            let once = ix > 0 ? tum[ix - 1].t : s.t.addingTimeInterval(-6 * 3600)
            return HVAn(tarih: simdi, sehir: v?.sehir ?? "", hicri: bugun?.h ?? "", saatler: bugun?.t ?? [],
                        sonraki: s.i, hedef: s.t, onceki: once, ayet: ayet, son: v?.son,
                        takip: HVDepo.takip(simdi), veriVar: true)
        }
        // veri yok / bitti → örnek görünüm
        return HVAn(tarih: simdi, sehir: v?.sehir ?? "", hicri: "", saatler: bugun?.t ?? [],
                    sonraki: 3, hedef: simdi.addingTimeInterval(5045), onceki: simdi.addingTimeInterval(-3600),
                    ayet: ayet, son: v?.son, takip: HVDepo.takip(simdi), veriVar: false)
    }
}

// MARK: - Zaman çizelgesi

struct HVGiris: TimelineEntry {
    let date: Date
    let an: HVAn
}

struct HVSaglayici: TimelineProvider {
    func placeholder(in context: Context) -> HVGiris { ornek() }

    func getSnapshot(in context: Context, completion: @escaping (HVGiris) -> Void) {
        let v = HVDepo.veri()
        completion(v == nil ? ornek() : HVGiris(date: Date(), an: HVHesap.an(Date(), v)))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<HVGiris>) -> Void) {
        let v = HVDepo.veri()
        let simdi = Date()
        var anlar: [Date] = [simdi]
        // her vakit geçişinde + gece yarısında yenile (sonraki 36 saat)
        for x in HVHesap.vakitler(v) where x.t > simdi && x.t < simdi.addingTimeInterval(36 * 3600) {
            anlar.append(x.t.addingTimeInterval(1))
        }
        let cal = Calendar.current
        if let gy = cal.nextDate(after: simdi, matching: DateComponents(hour: 0, minute: 0, second: 5), matchingPolicy: .nextTime) {
            anlar.append(gy)
        }
        anlar.sort()
        let girisler = anlar.map { HVGiris(date: $0, an: HVHesap.an($0, v)) }
        let son = anlar.last ?? simdi.addingTimeInterval(3600)
        completion(Timeline(entries: girisler, policy: .after(son.addingTimeInterval(60))))
    }

    func ornek() -> HVGiris {
        let s = Date()
        let an = HVAn(tarih: s, sehir: "Armutlu", hicri: "28 Cemâziyelevvel 1448",
                      saatler: ["06:08", "07:35", "12:41", "15:18", "17:37", "18:59"],
                      sonraki: 3, hedef: s.addingTimeInterval(5045), onceki: s.addingTimeInterval(-3600),
                      ayet: HVAyet(d: "", m: "Bilesiniz ki kalpler ancak Allah'ı anmakla huzur bulur.", k: "Ra'd Sûresi · 28. Âyet", kk: "Ra'd 28"),
                      son: HVSon(ad: "Mâide Sûresi", no: 5, ayet: 40, sayfa: 113, hatim: 18),
                      takip: ["sabah": true, "ogle": true, "ikindi": false, "aksam": false, "yatsi": false], veriVar: true)
        return HVGiris(date: s, an: an)
    }
}

// MARK: - Yardımcılar

extension View {
    @ViewBuilder
    func hvZemin<Z: View>(@ViewBuilder _ z: () -> Z) -> some View {
        if #available(iOSApplicationExtension 17.0, *) {
            self.containerBackground(for: .widget) { z() }
        } else {
            self.background(z())
        }
    }
}

extension WidgetConfiguration {
    func hvKenarsiz() -> some WidgetConfiguration {
        if #available(iOSApplicationExtension 17.0, *) {
            return self.contentMarginsDisabled()
        } else {
            return self
        }
    }
}

func hvLink(_ hedef: String) -> URL { URL(string: "namazdostu://ac/\(hedef)")! }

struct HVFoto: View {
    let ad: String
    var body: some View {
        Image(ad).resizable().aspectRatio(contentMode: .fill)
    }
}

struct HVGeriSayim: View {
    let hedef: Date
    let boy: CGFloat
    var renk: Color = .hvEsp
    var body: some View {
        Text(hedef, style: .timer)
            .font(hvSerif(boy, .bold))
            .monospacedDigit()
            .foregroundColor(renk)
            .multilineTextAlignment(.center)
            .lineLimit(1)
            .minimumScaleFactor(0.6)
    }
}

struct HVRozet: View {
    let yazi: String
    var boy: CGFloat = 11
    var body: some View {
        Text(yazi)
            .font(hvSerif(boy, .semibold))
            .foregroundColor(Color(red: 0.953, green: 0.851, blue: 0.6))
            .padding(.horizontal, 12).padding(.vertical, 3)
            .background(Capsule().fill(hvKoyuZemin))
            .overlay(Capsule().stroke(Color.hvAltin, lineWidth: 1))
            .lineLimit(1)
    }
}

struct HVAltinCizgi: View {
    var genislik: CGFloat = 110
    var body: some View {
        LinearGradient(colors: [.clear, .hvAltin2, .clear], startPoint: .leading, endPoint: .trailing)
            .frame(width: genislik, height: 1)
    }
}

// MARK: - 1) Vakitler (orta) + büyük birleşik

struct HVVakitlerOrta: View {
    let an: HVAn
    var body: some View {
        GeometryReader { g in
            HStack(spacing: 0) {
                // sol: koyu panel + geri sayım + fotoğraf
                ZStack(alignment: .top) {
                    hvKoyuZemin
                    VStack(spacing: 0) {
                        Spacer(minLength: 0)
                        HVFoto(ad: an.foto)
                            .frame(width: g.size.width * 0.46, height: g.size.height * 0.56)
                            .clipped()
                            .mask(LinearGradient(colors: [.clear, .black, .black], startPoint: .top, endPoint: .bottom))
                    }
                    VStack(spacing: 2) {
                        Text("📍 \(an.sehir.isEmpty ? "Konum" : an.sehir) · \(an.tarihYazi)")
                            .font(.system(size: 10.5, weight: .semibold))
                            .foregroundColor(Color.hvKrem.opacity(0.92)).lineLimit(1).minimumScaleFactor(0.7)
                        Text(HV_KALAN_ETIKET[an.sonraki])
                            .font(hvSerif(10.5, .semibold)).tracking(1)
                            .foregroundColor(.hvAltin2).padding(.top, 4)
                        HVGeriSayim(hedef: an.hedef, boy: 34, renk: .hvKrem)
                            .shadow(color: .black.opacity(0.5), radius: 3, y: 1)
                        HVAltinCizgi(genislik: 100)
                        Text("Ezan \(an.saatler.count > an.sonraki ? an.saatler[an.sonraki] : "--:--")")
                            .font(hvSerif(12.5, .medium)).foregroundColor(.hvKrem)
                            .shadow(color: .black.opacity(0.8), radius: 2)
                    }
                    .padding(.top, 11).padding(.horizontal, 6)
                }
                .frame(width: g.size.width * 0.46)
                // sağ: 6 vakit
                VStack(spacing: 0) {
                    Text("Bugünkü Namaz Vakitleri").font(hvSerif(11.5, .semibold)).foregroundColor(.hvEsp2).lineLimit(1).minimumScaleFactor(0.8)
                    if !an.hicri.isEmpty {
                        Text(an.hicri).font(hvSerif(9.5, .medium)).foregroundColor(Color(red: 0.54, green: 0.35, blue: 0.13)).lineLimit(1).minimumScaleFactor(0.7)
                    }
                    Rectangle().fill(Color.hvAltin.opacity(0.4)).frame(height: 1).padding(.vertical, 3)
                    ForEach(0..<6, id: \.self) { i in
                        HStack {
                            Text(HV_VAKIT_ADLARI[i]).font(hvSerif(12.5, i == an.sonraki ? .bold : .medium))
                            Spacer()
                            Text(an.saatler.count > i ? an.saatler[i] : "--:--").font(.system(size: 13, weight: .semibold)).monospacedDigit()
                        }
                        .foregroundColor(.hvEsp)
                        .padding(.horizontal, 8)
                        .frame(maxHeight: .infinity)
                        .background(Group { if i == an.sonraki { Capsule().fill(hvAltinHap) } })
                    }
                }
                .padding(.horizontal, 10).padding(.vertical, 8)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .widgetURL(hvLink("vakit"))
    }
}

struct HVBirlesikBuyuk: View {
    let an: HVAn
    var body: some View {
        GeometryReader { g in
            VStack(spacing: 0) {
                ZStack {
                    hvKoyuZemin
                    HVFoto(ad: an.foto).opacity(0.5)
                        .frame(width: g.size.width, height: g.size.height * 0.39).clipped()
                        .mask(LinearGradient(colors: [.clear, .black], startPoint: .top, endPoint: .bottom))
                    VStack(spacing: 1) {
                        Text("📍 \(an.sehir) · \(an.tarihUzun)").font(.system(size: 11, weight: .semibold)).foregroundColor(Color.hvKrem.opacity(0.92)).lineLimit(1)
                        Text(HV_KALAN_ETIKET[an.sonraki]).font(hvSerif(11, .semibold)).tracking(1.2).foregroundColor(.hvAltin2).padding(.top, 8)
                        HVGeriSayim(hedef: an.hedef, boy: 42, renk: .hvKrem).shadow(color: .black.opacity(0.6), radius: 4)
                        Text("Ezan \(an.saatler.count > an.sonraki ? an.saatler[an.sonraki] : "--:--")").font(hvSerif(13, .medium)).foregroundColor(.hvKrem)
                    }
                }
                .frame(height: g.size.height * 0.39)
                HStack(spacing: 4) {
                    ForEach(0..<6, id: \.self) { i in
                        VStack(spacing: 1) {
                            Text(HV_VAKIT_ADLARI[i]).font(hvSerif(10.5, .medium)).foregroundColor(.hvKahve).lineLimit(1).minimumScaleFactor(0.7)
                            Text(an.saatler.count > i ? an.saatler[i] : "--:--").font(.system(size: 13, weight: .semibold)).monospacedDigit().foregroundColor(.hvEsp)
                        }
                        .frame(maxWidth: .infinity).padding(.vertical, 5)
                        .background(RoundedRectangle(cornerRadius: 11).fill(i == an.sonraki ? AnyShapeStyle(hvAltinHap) : AnyShapeStyle(Color.hvAltin.opacity(0.1))))
                    }
                }
                .padding(.horizontal, 10).padding(.top, 6)
                VStack(alignment: .leading, spacing: 3) {
                    Rectangle().fill(Color.hvAltin.opacity(0.4)).frame(height: 1)
                    Text("❁ GÜNÜN ÂYETİ").font(hvSerif(10.5, .semibold)).tracking(1).foregroundColor(Color(red: 0.54, green: 0.35, blue: 0.13)).padding(.top, 4)
                    Text("“\(an.ayet?.m ?? "")”").font(hvSerif(13.5).italic()).foregroundColor(.hvEsp).lineLimit(4).minimumScaleFactor(0.75)
                    Text(an.ayet?.k ?? "").font(hvSerif(11, .medium)).foregroundColor(.hvKahve)
                }
                .padding(.horizontal, 14).padding(.top, 6)
                Spacer(minLength: 4)
                Link(destination: hvLink("kuran")) {
                    HStack(spacing: 10) {
                        HVFoto(ad: "vakit_ikindi").frame(width: 50, height: 50).clipShape(RoundedRectangle(cornerRadius: 11))
                        VStack(alignment: .leading, spacing: 1) {
                            Text("SON OKUNAN").font(hvSerif(9.5, .semibold)).tracking(1).foregroundColor(Color(red: 0.54, green: 0.35, blue: 0.13))
                            Text(an.son?.ad?.isEmpty == false ? an.son!.ad! : "Kur'an Oku").font(hvSerif(15, .bold)).foregroundColor(.hvEsp).lineLimit(1)
                            Text(sonAlt(an.son)).font(hvSerif(10.5, .medium)).foregroundColor(.hvKahve).lineLimit(1)
                        }
                        Spacer()
                        Text("Devam ›").font(hvSerif(12, .bold)).foregroundColor(.hvEsp)
                            .padding(.horizontal, 12).padding(.vertical, 6).background(Capsule().fill(hvAltinHap))
                    }
                    .padding(7)
                    .background(RoundedRectangle(cornerRadius: 16).fill(Color.hvAltin.opacity(0.14)))
                    .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.hvAltin.opacity(0.35), lineWidth: 1))
                }
                .padding(.horizontal, 10).padding(.bottom, 10)
            }
        }
        .widgetURL(hvLink("vakit"))
    }
    func sonAlt(_ s: HVSon?) -> String {
        guard let s = s, (s.ayet ?? 0) > 0 else { return "Kaldığın yerden devam et" }
        var p = ["\(s.ayet!). âyet"]
        if let sy = s.sayfa, sy > 0 { p.append("Sayfa \(sy)") }
        if let h = s.hatim, h > 0 { p.append("hatim %\(h)") }
        return p.joined(separator: " · ")
    }
}

struct HVVakitlerGorunum: View {
    @Environment(\.widgetFamily) var aile
    let an: HVAn
    var body: some View {
        Group {
            if aile == .systemLarge { HVBirlesikBuyuk(an: an) } else { HVVakitlerOrta(an: an) }
        }
        .hvZemin { hvKremZemin }
    }
}

struct VakitlerWidget: Widget {
    let kind = "NDVakitler"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: HVSaglayici()) { e in HVVakitlerGorunum(an: e.an) }
            .configurationDisplayName("Namaz Vakitleri")
            .description("Sıradaki vakte kalan süre ve bugünkü 6 vakit.")
            .supportedFamilies([.systemMedium, .systemLarge])
            .hvKenarsiz()
    }
}

// MARK: - 2) Küçük geri sayım (krem ve koyu)

struct HVKucukSayac: View {
    let an: HVAn
    let koyu: Bool
    var body: some View {
        GeometryReader { g in
            ZStack(alignment: .top) {
                VStack { Spacer(minLength: 0)
                    HVFoto(ad: an.foto).frame(width: g.size.width, height: g.size.height * 0.5).clipped()
                        .mask(LinearGradient(colors: [.clear, .black, .black], startPoint: .top, endPoint: .bottom))
                        .opacity(koyu ? 1 : 0.9)
                }
                VStack(spacing: 3) {
                    Text(HV_KALAN_ETIKET[an.sonraki]).font(hvSerif(10.5, .semibold)).tracking(1)
                        .foregroundColor(koyu ? .hvAltin2 : Color(red: 0.54, green: 0.35, blue: 0.13))
                        .lineLimit(1).minimumScaleFactor(0.7)
                    HVGeriSayim(hedef: an.hedef, boy: 32, renk: koyu ? .hvKrem : .hvEsp)
                    Text("Ezan \(an.saatler.count > an.sonraki ? an.saatler[an.sonraki] : "--:--")")
                        .font(hvSerif(13, .medium)).foregroundColor(koyu ? .hvKrem : .hvEsp)
                        .shadow(color: koyu ? .black.opacity(0.7) : .clear, radius: 2)
                }
                .padding(.top, 18).padding(.horizontal, 8)
            }
        }
        .hvZemin { if koyu { hvKoyuZemin } else { hvKremZemin } }
        .widgetURL(hvLink("vakit"))
    }
}

struct SayacWidget: Widget {
    let kind = "NDSayac"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: HVSaglayici()) { e in HVKucukSayac(an: e.an, koyu: false) }
            .configurationDisplayName("Geri Sayım · Krem")
            .description("Sıradaki vakte kalan süre.")
            .supportedFamilies([.systemSmall])
            .hvKenarsiz()
    }
}

struct SayacKoyuWidget: Widget {
    let kind = "NDSayacKoyu"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: HVSaglayici()) { e in HVKucukSayac(an: e.an, koyu: true) }
            .configurationDisplayName("Geri Sayım · Koyu")
            .description("Sıradaki vakte kalan süre.")
            .supportedFamilies([.systemSmall])
            .hvKenarsiz()
    }
}

// MARK: - 3) Günün Âyeti

struct HVAyetGorunum: View {
    @Environment(\.widgetFamily) var aile
    let an: HVAn
    var metin: String { an.ayet?.m ?? "Bilesiniz ki kalpler ancak Allah'ı anmakla huzur bulur." }
    var kaynak: String { an.ayet?.k ?? "Ra'd Sûresi · 28. Âyet" }
    var uzun: Bool { metin.count > 95 }
    var body: some View {
        Group {
            switch aile {
            case .accessoryRectangular:
                VStack(alignment: .leading, spacing: 1) {
                    Text("❁ Günün Âyeti").font(.system(size: 12, weight: .semibold))
                    Text(metin).font(hvSerif(12).italic()).lineLimit(2)
                    Text(an.ayet?.kk ?? "").font(.system(size: 10, weight: .medium)).opacity(0.85)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .hvZemin { Color.clear }
            case .systemSmall:
                VStack(spacing: 6) {
                    Text("❁ GÜNÜN ÂYETİ").font(hvSerif(10, .semibold)).tracking(1).foregroundColor(Color(red: 0.54, green: 0.35, blue: 0.13))
                    Text("“\(metin)”").font(hvSerif(13).italic()).foregroundColor(.hvEsp).multilineTextAlignment(.center).minimumScaleFactor(0.55)
                    Text(an.ayet?.kk ?? "").font(hvSerif(10.5, .medium)).foregroundColor(.hvKahve)
                }
                .padding(12)
                .hvZemin { hvKremZemin }
            default:
                GeometryReader { g in
                    ZStack(alignment: .topLeading) {
                        if uzun {
                            HVFoto(ad: an.foto).opacity(0.16).frame(width: g.size.width, height: g.size.height).clipped()
                        } else {
                            HStack { Spacer(minLength: 0)
                                HVFoto(ad: "vakit_aksam").frame(width: g.size.width * 0.41, height: g.size.height).clipped()
                                    .mask(LinearGradient(colors: [.clear, .black, .black], startPoint: .leading, endPoint: .trailing))
                            }
                        }
                        VStack(alignment: .leading, spacing: 0) {
                            HStack { Spacer(); HVRozet(yazi: "❁ Günün Âyeti ❁", boy: 11.5); Spacer() }
                                .padding(.top, 8)
                            Spacer(minLength: 2)
                            Text("“\(metin)”")
                                .font(hvSerif(uzun ? 13.5 : 17).italic())
                                .foregroundColor(.hvEsp)
                                .lineSpacing(1)
                                .minimumScaleFactor(0.6)
                                .frame(width: uzun ? g.size.width - 32 : g.size.width * 0.6, alignment: .leading)
                            Spacer(minLength: 2)
                            LinearGradient(colors: [.hvAltin, .clear], startPoint: .leading, endPoint: .trailing).frame(width: 150, height: 1)
                            Text(kaynak).font(hvSerif(11.5, .medium)).foregroundColor(.hvKahve).padding(.top, 4).padding(.bottom, 10)
                        }
                        .padding(.horizontal, 16)
                    }
                }
                .hvZemin { hvKremZemin }
            }
        }
        .widgetURL(hvLink("ayet"))
    }
}

struct AyetWidget: Widget {
    let kind = "NDAyet"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: HVSaglayici()) { e in HVAyetGorunum(an: e.an) }
            .configurationDisplayName("Günün Âyeti")
            .description("Her gün yeni bir âyet ve meâli.")
            .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular])
            .hvKenarsiz()
    }
}

// MARK: - 4) Son Okunan

struct HVSonOkunan: View {
    let an: HVAn
    var body: some View {
        GeometryReader { g in
            HStack(spacing: 14) {
                HVFoto(ad: "vakit_ikindi")
                    .frame(width: g.size.width * 0.29, height: g.size.height - 24)
                    .clipShape(RoundedRectangle(cornerRadius: 16))
                    .shadow(color: .black.opacity(0.25), radius: 3, y: 1)
                VStack(alignment: .leading, spacing: 2) {
                    HVRozet(yazi: "SON OKUNAN", boy: 10)
                    Text(an.son?.ad?.isEmpty == false ? an.son!.ad! : "Kur'an-ı Kerîm")
                        .font(hvSerif(21, .bold)).foregroundColor(.hvEsp).lineLimit(1).minimumScaleFactor(0.6).padding(.top, 3)
                    Text(alt).font(hvSerif(12, .medium)).foregroundColor(.hvKahve).lineLimit(1).minimumScaleFactor(0.8)
                    Spacer(minLength: 2)
                    HStack(alignment: .bottom) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Meâlden hatim %\(an.son?.hatim ?? 0)").font(hvSerif(11.5, .medium)).foregroundColor(.hvKahve)
                            ZStack(alignment: .leading) {
                                Capsule().fill(Color.hvAltin.opacity(0.25)).frame(width: 110, height: 6)
                                Capsule().fill(hvAltinHap).frame(width: max(4, 110 * CGFloat(an.son?.hatim ?? 0) / 100), height: 6)
                            }
                        }
                        Spacer()
                        Text("Devam Et ›").font(hvSerif(12.5, .bold)).foregroundColor(.hvEsp)
                            .padding(.horizontal, 12).padding(.vertical, 7).background(Capsule().fill(hvAltinHap))
                            .shadow(color: Color(red: 0.47, green: 0.31, blue: 0.08).opacity(0.35), radius: 2, y: 1)
                    }
                }
                .padding(.vertical, 2)
            }
            .padding(12)
        }
        .hvZemin { hvKremZemin }
        .widgetURL(hvLink("kuran"))
    }
    var alt: String {
        guard let s = an.son, let a = s.ayet, a > 0 else { return "Okumaya başla" }
        if let sy = s.sayfa, sy > 0 { return "📖 \(a). âyette kaldın · Sayfa \(sy)" }
        return "📖 \(a). âyette kaldın"
    }
}

struct SonOkunanWidget: Widget {
    let kind = "NDSonOkunan"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: HVSaglayici()) { e in HVSonOkunan(an: e.an) }
            .configurationDisplayName("Son Okunan")
            .description("Kur'an'da kaldığın yer ve meâlden hatim.")
            .supportedFamilies([.systemMedium])
            .hvKenarsiz()
    }
}

// MARK: - 5) Namaz Takibim + Kıble / Zikir / Dua

#if canImport(AppIntents)
@available(iOSApplicationExtension 17.0, *)
struct NamazIsaretle: AppIntent {
    static var title: LocalizedStringResource = "Namazı işaretle"
    static var isDiscoverable: Bool = false
    @Parameter(title: "Vakit") var vakit: String
    init() { self.vakit = "sabah" }
    init(vakit: String) { self.vakit = vakit }
    func perform() async throws -> some IntentResult {
        HVDepo.takipDegistir(vakit)
        return .result()
    }
}
#endif

struct HVTakipDaire: View {
    let ad: String
    let kilindi: Bool
    var body: some View {
        VStack(spacing: 3) {
            ZStack {
                Circle().fill(kilindi ? AnyShapeStyle(hvAltinHap) : AnyShapeStyle(Color.clear)).frame(width: 26, height: 26)
                Circle().stroke(Color.hvAltin2, lineWidth: 1.6).frame(width: 26, height: 26)
                if kilindi { Image(systemName: "checkmark").font(.system(size: 12, weight: .bold)).foregroundColor(.hvEsp) }
            }
            Text(ad).font(hvSerif(11, .medium)).foregroundColor(.hvKrem).lineLimit(1).minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity)
    }
}

struct HVTakip: View {
    let an: HVAn
    let adlar = ["Sabah", "Öğle", "İkindi", "Akşam", "Yatsı"]
    var sayi: Int { HVDepo.vakitAnahtar.filter { an.takip[$0] == true }.count }
    var body: some View {
        GeometryReader { g in
            VStack(spacing: 0) {
                VStack(spacing: 6) {
                    HStack {
                        Text("🕌 Namaz Takibim").font(hvSerif(14, .semibold)).foregroundColor(.hvKrem)
                        Spacer()
                        Text("Bugün \(sayi)/5").font(hvSerif(11, .semibold)).foregroundColor(Color(red: 0.953, green: 0.851, blue: 0.6))
                            .padding(.horizontal, 10).padding(.vertical, 2)
                            .overlay(Capsule().stroke(Color.hvAltin, lineWidth: 1))
                    }
                    HStack(spacing: 0) {
                        ForEach(0..<5, id: \.self) { i in daire(i) }
                    }
                }
                .padding(.horizontal, 14).padding(.top, 10).padding(.bottom, 8)
                .frame(width: g.size.width)
                .background(hvKoyuZemin)
                HStack(spacing: 8) {
                    kisayol("Kıble", "location.north.circle", "kible")
                    kisayol("Zikir", "circle.hexagongrid", "zikir")
                    kisayol("Dua", "book", "dua")
                }
                .padding(.horizontal, 10).padding(.vertical, 9)
                .frame(maxHeight: .infinity)
            }
        }
        .hvZemin { hvKremZemin }
        .widgetURL(hvLink("takip"))
    }

    @ViewBuilder func daire(_ i: Int) -> some View {
        let k = HVDepo.vakitAnahtar[i]
        let on = an.takip[k] == true
        #if canImport(AppIntents)
        if #available(iOSApplicationExtension 17.0, *) {
            Button(intent: NamazIsaretle(vakit: k)) { HVTakipDaire(ad: adlar[i], kilindi: on) }
                .buttonStyle(.plain)
        } else {
            Link(destination: hvLink("takip")) { HVTakipDaire(ad: adlar[i], kilindi: on) }
        }
        #else
        Link(destination: hvLink("takip")) { HVTakipDaire(ad: adlar[i], kilindi: on) }
        #endif
    }

    func kisayol(_ ad: String, _ ikon: String, _ hedef: String) -> some View {
        Link(destination: hvLink(hedef)) {
            HStack(spacing: 6) {
                Image(systemName: ikon).font(.system(size: 17, weight: .regular)).foregroundColor(Color(red: 0.66, green: 0.41, blue: 0.18))
                Text(ad).font(hvSerif(13.5, .semibold)).foregroundColor(.hvEsp)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(RoundedRectangle(cornerRadius: 14).fill(LinearGradient(colors: [Color(red: 1, green: 0.973, blue: 0.918), Color(red: 0.941, green: 0.875, blue: 0.749)], startPoint: .top, endPoint: .bottom)))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.hvAltin.opacity(0.55), lineWidth: 1))
        }
    }
}

struct TakipWidget: Widget {
    let kind = "NDTakip"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: HVSaglayici()) { e in HVTakip(an: e.an) }
            .configurationDisplayName("Namaz Takibim")
            .description("Kıldığın vakti dokunarak işaretle; Kıble, Zikir ve Dua'ya hızlı geçiş.")
            .supportedFamilies([.systemMedium])
            .hvKenarsiz()
    }
}

// MARK: - 6) Kilit ekranı (yuvarlak, dikdörtgen, satır)

struct HVKilit: View {
    @Environment(\.widgetFamily) var aile
    let an: HVAn
    var ad: String { HV_VAKIT_ADLARI[an.sonraki] }
    var saat: String { an.saatler.count > an.sonraki ? an.saatler[an.sonraki] : "--:--" }
    var body: some View {
        Group {
            switch aile {
            case .accessoryCircular:
                ZStack {
                    AccessoryWidgetBackground()
                    Gauge(value: 1 - an.oran) {
                        Text(ad)
                    } currentValueLabel: {
                        VStack(spacing: 0) {
                            Text(ad).font(.system(size: 10, weight: .semibold))
                            Text(saat).font(.system(size: 13, weight: .bold)).monospacedDigit()
                        }
                    }
                    .gaugeStyle(.accessoryCircularCapacity)
                }
            case .accessoryInline:
                Text("☾ \(ad) \(saat)")
            default:
                VStack(alignment: .leading, spacing: 1) {
                    Text("\(ad) \(saat)").font(.system(size: 15, weight: .bold))
                    HStack(spacing: 3) {
                        Text(an.hedef, style: .relative).monospacedDigit()
                        Text("kaldı")
                    }.font(.system(size: 12, weight: .medium))
                    if an.sonraki < 5, an.saatler.count > an.sonraki + 1 {
                        Text("\(HV_VAKIT_ADLARI[an.sonraki + 1]) \(an.saatler[an.sonraki + 1])").font(.system(size: 12)).opacity(0.85)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .hvZemin { Color.clear }
        .widgetURL(hvLink("vakit"))
    }
}

struct KilitWidget: Widget {
    let kind = "NDKilit"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: HVSaglayici()) { e in HVKilit(an: e.an) }
            .configurationDisplayName("Sıradaki Vakit")
            .description("Kilit ekranında sıradaki vakit ve kalan süre.")
            .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}

// MARK: - Paket

@main
struct NamazDostuWidgetPaketi: WidgetBundle {
    var body: some Widget {
        VakitlerWidget()
        AyetWidget()
        SonOkunanWidget()
        TakipWidget()
        SayacWidget()
        SayacKoyuWidget()
        KilitWidget()
    }
}
