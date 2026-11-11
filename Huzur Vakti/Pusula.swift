//
//  Pusula.swift — telefonun kendi pusulası (CoreLocation heading) → web hvNativeHeading(derece, doğruluk)
//  Hareket (DeviceOrientation) izni gerekmez; konum izni zaten alınıyor.
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
    }

    func baslat() {
        guard CLLocationManager.headingAvailable() else { return }
        if lm.authorizationStatus == .notDetermined { lm.requestWhenInUseAuthorization() }
        acik = true
        lm.startUpdatingHeading()
    }

    func durdur() {
        acik = false
        lm.stopUpdatingHeading()
    }

    func locationManager(_ manager: CLLocationManager, didUpdateHeading h: CLHeading) {
        guard acik, let wv = webView else { return }
        let t = Date().timeIntervalSince1970
        if t - sonGonderim < 0.08 { return }   // ~12 Hz yeter
        sonGonderim = t
        // Web manyetik kuzeyi bekler ve sapmayı kendi ekler (Android ile aynı yol)
        let derece = h.magneticHeading
        let dogruluk = h.headingAccuracy   // <0: güvenilmez → web "8 çiz" ipucu gösterir
        let acc = dogruluk < 0 ? 0 : (dogruluk < 15 ? 3 : (dogruluk < 30 ? 2 : 1))
        wv.evaluateJavaScript("window.hvNativeHeading && hvNativeHeading(\(derece), \(acc)); true;", completionHandler: nil)
    }

    func locationManagerShouldDisplayHeadingCalibration(_ manager: CLLocationManager) -> Bool { false }
}
