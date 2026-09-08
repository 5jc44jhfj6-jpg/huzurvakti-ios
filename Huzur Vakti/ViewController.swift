import UIKit
import WebKit

var webView: WKWebView! = nil

class ViewController: UIViewController, WKNavigationDelegate, UIDocumentInteractionControllerDelegate {
    enum LoadingMode {
        case defaultCachePolicy
        case forceCache
    }

    var documentController: UIDocumentInteractionController?
    func documentInteractionControllerViewControllerForPreview(_ controller: UIDocumentInteractionController) -> UIViewController {
        return self
    }
    
    @IBOutlet weak var loadingView: UIView!
    @IBOutlet weak var progressView: UIProgressView!
    @IBOutlet weak var connectionProblemView: UIImageView!
    @IBOutlet weak var webviewView: UIView!
    var toolbarView: UIToolbar!
    
    var htmlIsLoaded = false;
    private var loadingMode = LoadingMode.defaultCachePolicy

    private var themeObservation: NSKeyValueObservation?
    var currentWebViewTheme: UIUserInterfaceStyle = .unspecified

    // ── Açılış (splash) ekranı ──
    private var splashActive = true
    private var splashBgView: UIImageView?
    private var splashIconView: UIImageView?
    private var splashTitle: UILabel?
    private var splashSubtitle: UILabel?
    private var splashZoomStarted = false

    override var preferredStatusBarStyle : UIStatusBarStyle {
        if splashActive { return .lightContent }
        if #available(iOS 13, *), overrideStatusBar{
            if #available(iOS 15, *) {
                return .default
            } else {
                return statusBarTheme == "dark" ? .lightContent : .darkContent
            }
        }
        return .default
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        setupSplashDesign()
        initWebView()
        initToolbarView()
        loadRootUrl()
    
        NotificationCenter.default.addObserver(self, selector: #selector(self.keyboardWillHide(_:)), name: UIResponder.keyboardWillHideNotification , object: nil)
        
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        HuzurVakti.webView.frame = calcWebviewFrame(webviewView: webviewView, toolbarView: nil)
        layoutSplash()
    }
    
    @objc func keyboardWillHide(_ notification: NSNotification) {
        HuzurVakti.webView.setNeedsLayout()
    }
    
    func initWebView() {
        HuzurVakti.webView = createWebView(container: webviewView, WKSMH: self, WKND: self, NSO: self, VC: self)
        webviewView.addSubview(HuzurVakti.webView);
        
        HuzurVakti.webView.uiDelegate = self;
        
        HuzurVakti.webView.addObserver(self, forKeyPath: #keyPath(WKWebView.estimatedProgress), options: .new, context: nil)

        if(pullToRefresh){
            let refreshControl = UIRefreshControl()
            refreshControl.addTarget(self, action: #selector(refreshWebView(_:)), for: UIControl.Event.valueChanged)
            HuzurVakti.webView.scrollView.addSubview(refreshControl)
            HuzurVakti.webView.scrollView.bounces = true
        }

        if #available(iOS 15.0, *), adaptiveUIStyle {
            themeObservation = HuzurVakti.webView.observe(\.themeColor) { [unowned self] webView, _ in
                let backgroundColor = HuzurVakti.webView.underPageBackgroundColor;
                let themeColor = HuzurVakti.webView.themeColor;
                currentWebViewTheme = themeColor?.isLight() ?? backgroundColor?.isLight() ?? true ? .light : .dark
                self.overrideUIStyle()
                view.backgroundColor = themeColor ?? backgroundColor;
            }
        }
    }

    @objc func refreshWebView(_ sender: UIRefreshControl) {
        HuzurVakti.webView?.reload()
        sender.endRefreshing()
    }

    func createToolbarView() -> UIToolbar{
        let winScene = UIApplication.shared.connectedScenes.first
        let windowScene = winScene as! UIWindowScene
        var statusBarHeight = windowScene.statusBarManager?.statusBarFrame.height ?? 60
        
        #if targetEnvironment(macCatalyst)
        if (statusBarHeight == 0){
            statusBarHeight = 30
        }
        #endif
        
        let toolbarView = UIToolbar(frame: CGRect(x: 0, y: 0, width: webviewView.frame.width, height: 0))
        toolbarView.sizeToFit()
        toolbarView.frame = CGRect(x: 0, y: 0, width: webviewView.frame.width, height: toolbarView.frame.height + statusBarHeight)
        
        let flex = UIBarButtonItem(barButtonSystemItem: .flexibleSpace, target: nil, action: nil)
        let close = UIBarButtonItem(barButtonSystemItem: .done, target: self, action: #selector(loadRootUrl))
        toolbarView.setItems([close,flex], animated: true)
        
        toolbarView.isHidden = true
        
        return toolbarView
    }
    
    func overrideUIStyle(toDefault: Bool = false) {
        if #available(iOS 15.0, *), adaptiveUIStyle {
            if (((htmlIsLoaded && !HuzurVakti.webView.isHidden) || toDefault) && self.currentWebViewTheme != .unspecified) {
                UIApplication
                    .shared
                    .connectedScenes
                    .flatMap { ($0 as? UIWindowScene)?.windows ?? [] }
                    .first { $0.isKeyWindow }?.overrideUserInterfaceStyle = toDefault ? .unspecified : self.currentWebViewTheme;
            }
        }
    }
    
    func initToolbarView() {
        toolbarView =  createToolbarView()
        
        webviewView.addSubview(toolbarView)
    }
    
    @objc func loadRootUrl(cachePolicy: NSURLRequest.CachePolicy = .useProtocolCachePolicy) {
        HuzurVakti.webView.load(URLRequest(url: SceneDelegate.universalLinkToLaunch ?? SceneDelegate.shortcutLinkToLaunch ?? rootUrl, cachePolicy: cachePolicy))
    }
    
    func reloadWebview(
        loadingMode: LoadingMode = LoadingMode.defaultCachePolicy
    ) {
        switch loadingMode {
        case LoadingMode.defaultCachePolicy:
            loadRootUrl(cachePolicy: .useProtocolCachePolicy);

        case LoadingMode.forceCache:
            loadRootUrl(cachePolicy: .useProtocolCachePolicy);
        }

        self.loadingMode = loadingMode
    }
    
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!){
        htmlIsLoaded = true
        
        self.setProgress(1.0, true)
        self.animateConnectionProblem(false)
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.55) {
            HuzurVakti.webView.isHidden = false
            HuzurVakti.webView.alpha = 0

            UIView.animate(withDuration: 0.45, animations: {
                HuzurVakti.webView.alpha = 1
                self.loadingView.alpha = 0
            }, completion: { _ in
                self.loadingView.isHidden = true
                self.loadingView.alpha = 1
                self.stopSplashAnimations()
            })

            self.setProgress(0.0, false)
            self.overrideUIStyle()
        }
    }
    
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        htmlIsLoaded = false;
        
        if (error as NSError)._code == (-999) { return }
        if (error as NSError)._code == 102 { return }
        
        self.overrideUIStyle(toDefault: true);
        webView.isHidden = true;
        loadingView.isHidden = false;

        if loadingMode == LoadingMode.defaultCachePolicy {
            DispatchQueue.main.async {
                self.reloadWebview(loadingMode: LoadingMode.forceCache)
            }
        } else {
            animateConnectionProblem(true);
            setProgress(0.05, true);
            
            DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
                self.setProgress(0.1, true);
                DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
                    self.reloadWebview()
                }
            }
        }
    }
    
    override func observeValue(forKeyPath keyPath: String?, of object: Any?, change: [NSKeyValueChangeKey : Any]?, context: UnsafeMutableRawPointer?) {

        if (keyPath == #keyPath(WKWebView.estimatedProgress) &&
                HuzurVakti.webView.isLoading &&
                !self.loadingView.isHidden &&
                !self.htmlIsLoaded) {
                    var progress = Float(HuzurVakti.webView.estimatedProgress);
                    
                    if (progress >= 0.8) { progress = 1.0; };
                    if (progress >= 0.3) { self.animateConnectionProblem(false); }
                    
                    self.setProgress(progress, true);
        }
    }
    
    func setProgress(_ progress: Float, _ animated: Bool) {
        self.progressView.setProgress(progress, animated: animated);
    }
    
    
    func animateConnectionProblem(_ show: Bool) {
        if (show) {
            self.connectionProblemView.isHidden = false;
            self.connectionProblemView.alpha = 0
            UIView.animate(withDuration: 0.7, delay: 0, options: [.repeat, .autoreverse], animations: {
                self.connectionProblemView.alpha = 1
            })
        }
        else {
            UIView.animate(withDuration: 0.3, delay: 0, options: [], animations: {
                self.connectionProblemView.alpha = 0 // Here you will get the animation you want
            }, completion: { _ in
                self.connectionProblemView.isHidden = true;
                self.connectionProblemView.layer.removeAllAnimations();
            })
        }
    }
        

    // ══════════════════════════════════════════════════════════
    //  AÇILIŞ (SPLASH) EKRANI — sade ve kırılmaz
    //  Düz zemin + ikon + isim. Görsel yok, yakınlaşma yok,
    //  elle çerçeve hesabı yok → her cihazda aynı görünür.
    // ══════════════════════════════════════════════════════════

    private var hvGold: UIColor { UIColor(red: 0.890, green: 0.678, blue: 0.510, alpha: 1) }      // #E3AD82
    private var hvGoldPale: UIColor { UIColor(red: 0.969, green: 0.867, blue: 0.769, alpha: 1) }  // #F7DDC4
    private var hvBgDark: UIColor { UIColor(red: 0.086, green: 0.043, blue: 0.016, alpha: 1) }    // #160B04
    private var hvBgDeep: UIColor { UIColor(red: 0.086, green: 0.043, blue: 0.016, alpha: 1) }    // #160B04

    func setupSplashDesign() {
        guard let lv = loadingView else { return }

        // ══ ASIL HATA BURADAYDI ══
        // Storyboard'da "Loading View" ekranin ortasinda 200x200 SABIT bir kutu.
        // Splash icerigi o kutuya girdigi icin her seferinde kucuk kare cikiyordu.
        // Once bu kutuyu ekrani kaplayacak sekilde sabitliyoruz.
        if let host = lv.superview {
            lv.translatesAutoresizingMaskIntoConstraints = false
            NSLayoutConstraint.activate([
                lv.topAnchor.constraint(equalTo: host.topAnchor),
                lv.bottomAnchor.constraint(equalTo: host.bottomAnchor),
                lv.leadingAnchor.constraint(equalTo: host.leadingAnchor),
                lv.trailingAnchor.constraint(equalTo: host.trailingAnchor)
            ])
        }

        lv.backgroundColor = hvBgDeep
        lv.clipsToBounds = true

        // Storyboard'daki kucuk ikon ve ilerleme cubugu gizlensin
        for old in lv.subviews {
            if let iv = old as? UIImageView, iv !== connectionProblemView { iv.isHidden = true }
        }
        progressView?.isHidden = true
        connectionProblemView?.tintColor = hvGoldPale.withAlphaComponent(0.85)

        // ── Arka plan gorseli (dort kenardan sabit, elle cerceve hesabi yok) ──
        let bg = UIImageView(image: UIImage(named: "SplashBg"))
        bg.translatesAutoresizingMaskIntoConstraints = false
        bg.contentMode = .scaleAspectFill
        bg.clipsToBounds = true
        bg.isUserInteractionEnabled = false
        lv.addSubview(bg)
        splashBgView = bg

        // ── Uygulama ikonu ──
        let icon = UIImageView(image: UIImage(named: "SplashIcon") ?? UIImage(named: "LaunchIcon"))
        icon.translatesAutoresizingMaskIntoConstraints = false
        icon.contentMode = .scaleAspectFill
        icon.layer.cornerRadius = 27
        icon.clipsToBounds = true
        lv.addSubview(icon)
        splashIconView = icon

        // ── Isim ──
        let title = UILabel()
        title.translatesAutoresizingMaskIntoConstraints = false
        title.textAlignment = .center
        title.numberOfLines = 1
        title.adjustsFontSizeToFitWidth = true
        title.minimumScaleFactor = 0.6
        title.attributedText = NSAttributedString(
            string: "NAMAZ DOSTU",
            attributes: [.kern: 5.0,
                         .font: UIFont.systemFont(ofSize: 34, weight: .semibold),
                         .foregroundColor: hvGoldPale])
        lv.addSubview(title)
        splashTitle = title

        // ── Alt yazi ──
        let cap = UILabel()
        cap.translatesAutoresizingMaskIntoConstraints = false
        cap.textAlignment = .center
        cap.numberOfLines = 1
        cap.adjustsFontSizeToFitWidth = true
        cap.minimumScaleFactor = 0.6
        cap.attributedText = NSAttributedString(
            string: "VAKİT • KIBLE • KUR'AN",
            attributes: [.kern: 3.2,
                         .font: UIFont.systemFont(ofSize: 14, weight: .regular),
                         .foregroundColor: hvGold.withAlphaComponent(0.80)])
        lv.addSubview(cap)
        splashSubtitle = cap

        NSLayoutConstraint.activate([
            bg.topAnchor.constraint(equalTo: lv.topAnchor),
            bg.bottomAnchor.constraint(equalTo: lv.bottomAnchor),
            bg.leadingAnchor.constraint(equalTo: lv.leadingAnchor),
            bg.trailingAnchor.constraint(equalTo: lv.trailingAnchor),

            icon.centerXAnchor.constraint(equalTo: lv.centerXAnchor),
            icon.centerYAnchor.constraint(equalTo: lv.centerYAnchor, constant: -60),
            icon.widthAnchor.constraint(equalToConstant: 120),
            icon.heightAnchor.constraint(equalToConstant: 120),

            title.topAnchor.constraint(equalTo: icon.bottomAnchor, constant: 30),
            title.centerXAnchor.constraint(equalTo: lv.centerXAnchor),
            title.leadingAnchor.constraint(equalTo: lv.leadingAnchor, constant: 16),
            title.trailingAnchor.constraint(equalTo: lv.trailingAnchor, constant: -16),

            cap.topAnchor.constraint(equalTo: title.bottomAnchor, constant: 9),
            cap.centerXAnchor.constraint(equalTo: lv.centerXAnchor),
            cap.leadingAnchor.constraint(equalTo: lv.leadingAnchor, constant: 24),
            cap.trailingAnchor.constraint(equalTo: lv.trailingAnchor, constant: -24)
        ])

        bg.alpha = 1
        icon.alpha = 1
        title.alpha = 0
        cap.alpha = 0

        if let cp = connectionProblemView { lv.bringSubviewToFront(cp) }

        startSplashAnimations()
        setNeedsStatusBarAppearanceUpdate()
    }

    private func startSplashAnimations() {
        UIView.animate(withDuration: 0.55, delay: 0.20, options: [.curveEaseOut], animations: {
            self.splashTitle?.alpha = 1
        }, completion: nil)
        UIView.animate(withDuration: 0.55, delay: 0.36, options: [.curveEaseOut], animations: {
            self.splashSubtitle?.alpha = 1
        }, completion: nil)
    }

    func stopSplashAnimations() {
        splashActive = false
        splashBgView?.layer.removeAllAnimations()
        splashIconView?.layer.removeAllAnimations()
        splashTitle?.layer.removeAllAnimations()
        splashSubtitle?.layer.removeAllAnimations()
        setNeedsStatusBarAppearanceUpdate()
    }

    // Yakinlasma SADECE ilk yerlesim bittikten sonra baslar.
    func layoutSplash() {
        guard splashActive, !splashZoomStarted,
              let bg = splashBgView, bg.bounds.width > 1, bg.bounds.height > 1 else { return }
        splashZoomStarted = true
        bg.transform = .identity
        UIView.animate(withDuration: 18.0, delay: 0.0,
                       options: [.curveLinear, .allowUserInteraction], animations: {
            bg.transform = CGAffineTransform(scaleX: 1.10, y: 1.10)
        }, completion: nil)
    }

    deinit {
        HuzurVakti.webView.removeObserver(self, forKeyPath: #keyPath(WKWebView.estimatedProgress))
    }
}

extension UIColor {
    func isLight(threshold: Float = 0.5) -> Bool? {
        let originalCGColor = self.cgColor

        let RGBCGColor = originalCGColor.converted(to: CGColorSpaceCreateDeviceRGB(), intent: .defaultIntent, options: nil)
        guard let components = RGBCGColor?.components else {
            return nil
        }
        guard components.count >= 3 else {
            return nil
        }

        let brightness = Float(((components[0] * 299) + (components[1] * 587) + (components[2] * 114)) / 1000)
        return (brightness > threshold)
    }
}

extension ViewController: WKScriptMessageHandler {
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.name == "print" {
            printView(webView: HuzurVakti.webView)
        }
        if message.name == "push-subscribe" {
            handleSubscribeTouch(message: message)
        }
        if message.name == "push-permission-request" {
            handlePushPermission()
        }
        if message.name == "push-permission-state" {
            handlePushState()
        }
        if message.name == "push-token" {
            handleFCMToken()
        }
        if message.name == "clear-local-notifications" {
            UNUserNotificationCenter.current().removeAllPendingNotificationRequests()
        }
        if message.name == "schedule-local-notification" {
            if let dict = message.body as? [String: Any],
               let identifier = dict["id"] as? String,
               let title = dict["title"] as? String,
               let body = dict["body"] as? String,
               let timestamp = dict["timestamp"] as? TimeInterval {
                
                let content = UNMutableNotificationContent()
                content.title = title
                content.body = body

                // Bildirim sesi (web tarafından "sound" alanı ile gelir)
                //  "ezan"    -> uygulama paketindeki ezan.caf (yoksa varsayılan ses)
                //  "none"    -> sessiz
                //  diğer     -> telefonun varsayılan bildirim sesi
                let soundKey = (dict["sound"] as? String) ?? "default"
                if soundKey == "none" {
                    content.sound = nil
                } else if soundKey == "ezan",
                          Bundle.main.url(forResource: "ezan", withExtension: "caf") != nil {
                    content.sound = UNNotificationSound(named: UNNotificationSoundName(rawValue: "ezan.caf"))
                } else {
                    content.sound = UNNotificationSound.default
                }

                let triggerDate = Date(timeIntervalSince1970: timestamp)
                let dateComponents = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute, .second], from: triggerDate)
                let trigger = UNCalendarNotificationTrigger(dateMatching: dateComponents, repeats: false)
                
                let request = UNNotificationRequest(identifier: identifier, content: content, trigger: trigger)
                UNUserNotificationCenter.current().add(request) { error in
                    if let error = error {
                        print("Error scheduling notification: \(error)")
                    }
                }
            }
        }
    }
}
