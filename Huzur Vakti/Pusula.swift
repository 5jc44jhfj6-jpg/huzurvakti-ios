//
//  Pusula.swift — telefonun kendi pusulası (CoreLocation heading) → web hvNativeHeading(derece, doğruluk, gerçekKuzey)
//  Hareket (DeviceOrientation) izni gerekmez; konum izni zaten alınıyor (bir kez).
//  1.9.4: konum biliniyorsa telefonun kendi GERÇEK kuzey verisi (trueHeading) gönderilir → 3. değer 1.
//         Konum yoksa eskisi gibi manyetik kuzey gider (3. değer 0) ve web sapmayı kendi ekler.
//

import Foundation
import CoreLocation
import WebKit

final class Pusula: NSObject, CLLocationManagerDelegate {
    static let paylasilan = Pusula()
    private let lm = CLLocationManager()
    private var acik = false
    private var sonGonderim: TimeInterval = 0

    override init() {
        super.init()
        lm.delegate = self
        lm.headingFilter = 1
        lm.desiredAccuracy = kCLLocationAccuracyKilometer   // gerçek kuzey için kaba konum yeter, pil yemez
    }

    func baslat() {
        guard CLLocationManager.headingAvailable() else { return }
        if lm.authorizationStatus == .notDetermined { lm.requestWhenInUseAuthorization() }
        acik = true
        lm.startUpdatingHeading()
        lm.startUpdatingLocation()   // trueHeading'in dolması için gerekli (yalnız pusula açıkken)
    }

    func durdur() {
        acik = false
        lm.stopUpdatingHeading()
        lm.stopUpdatingLocation()
    }

    func locationManager(_ manager: CLLocationManager, didUpdateHeading h: CLHeading) {
        guard acik, let wv = webView else { return }
        let t = Date().timeIntervalSince1970
        if t - sonGonderim < 0.08 { return }   // ~12 Hz yeter
        sonGonderim = t
        let gercekVar = h.trueHeading >= 0
        let derece = gercekVar ? h.trueHeading : h.magneticHeading
        let dogruluk = h.headingAccuracy   // <0: güvenilmez → web "8 çiz" ipucu gösterir
        let acc = dogruluk < 0 ? 0 : (dogruluk < 15 ? 3 : (dogruluk < 30 ? 2 : 1))
        wv.evaluateJavaScript("window.hvNativeHeading && hvNativeHeading(\(derece), \(acc), \(gercekVar ? 1 : 0)); true;", completionHandler: nil)
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {}
    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {}

    func locationManagerShouldDisplayHeadingCalibration(_ manager: CLLocationManager) -> Bool { false }
}

//
//  1.9.5: Konum — web'in navigator.geolocation'ı yerine telefonun kendi konumu.
//  WKWebView her açılışta "…github.io konumunuzu kullanmak istiyor" diye ayrıca soruyordu.
//  Artık izin yalnız BİR KEZ (iPhone'un kendi penceresi) sorulur; sonra kıble/şehir sessizce açılır.
//
final class HVKonum: NSObject, CLLocationManagerDelegate {
    static let paylasilan = HVKonum()
    private let lm = CLLocationManager()
    private var bekliyor = false

    override init() {
        super.init()
        lm.delegate = self
        lm.desiredAccuracy = kCLLocationAccuracyHundredMeters
    }

    func iste() {
        bekliyor = true
        switch lm.authorizationStatus {
        case .notDetermined:
            lm.requestWhenInUseAuthorization()          // ilk ve tek soru
        case .denied, .restricted:
            bekliyor = false
            gonderHata(1)
        default:
            if let son = lm.location, Date().timeIntervalSince(son.timestamp) < 120 { gonder(son) }
            lm.requestLocation()
        }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        guard bekliyor else { return }
        switch manager.authorizationStatus {
        case .authorizedWhenInUse, .authorizedAlways: manager.requestLocation()
        case .denied, .restricted: bekliyor = false; gonderHata(1)
        default: break
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let l = locations.last else { return }
        bekliyor = false
        gonder(l)
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        if let son = manager.location { gonder(son); return }
        bekliyor = false
        gonderHata(2)
    }

    private func gonder(_ l: CLLocation) {
        let js = "window.__hvNativeKonum && window.__hvNativeKonum(\(l.coordinate.latitude), \(l.coordinate.longitude), \(max(1, l.horizontalAccuracy))); true;"
        DispatchQueue.main.async { webView?.evaluateJavaScript(js, completionHandler: nil) }
    }

    private func gonderHata(_ kod: Int) {
        DispatchQueue.main.async { webView?.evaluateJavaScript("window.__hvNativeKonumHata && window.__hvNativeKonumHata(\(kod)); true;", completionHandler: nil) }
    }
}
