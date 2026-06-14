import SwiftUI
import WebKit

struct WebView: UIViewRepresentable {
    let url: URL
    @Binding var progress: Double
    @Binding var isLoading: Bool
    @Binding var isOffline: Bool
    let reloadTrigger: UUID // Change trigger to force reloads from SwiftUI
    
    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }
    
    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        
        // Hide scroll indicators for a clean, app-like visual feel
        webView.scrollView.showsHorizontalScrollIndicator = false
        
        // Configure Custom User Agent
        webView.evaluateJavaScript("navigator.userAgent") { (result, error) in
            if let defaultUA = result as? String {
                webView.customUserAgent = "\(defaultUA) SnapfactsiOS"
            }
        }
        
        // Add Pull-To-Refresh Control
        let refreshControl = UIRefreshControl()
        refreshControl.addTarget(context.coordinator, action: #selector(Coordinator.handleRefresh(_:)), for: .valueChanged)
        webView.scrollView.refreshControl = refreshControl
        
        // Setup Progress and Loading Observers
        context.coordinator.setupObservers(for: webView)
        
        // Initial load
        let request = URLRequest(url: url)
        webView.load(request)
        
        return webView
    }
    
    func updateUIView(_ uiView: WKWebView, context: Context) {
        // Handle programmatic reload trigger
        if context.coordinator.lastReloadTrigger != reloadTrigger {
            context.coordinator.lastReloadTrigger = reloadTrigger
            uiView.reload()
        }
    }
    
    class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        var parent: WebView
        var lastReloadTrigger: UUID
        private var progressObserver: NSKeyValueObservation?
        private var loadingObserver: NSKeyValueObservation?
        
        init(_ parent: WebView) {
            self.parent = parent
            self.lastReloadTrigger = parent.reloadTrigger
        }
        
        deinit {
            progressObserver?.invalidate()
            loadingObserver?.invalidate()
        }
        
        func setupObservers(for webView: WKWebView) {
            progressObserver = webView.observe(\.estimatedProgress, options: .new) { [weak self] webView, change in
                guard let self = self else { return }
                DispatchQueue.main.async {
                    self.parent.progress = change.newValue ?? 0.0
                }
            }
            
            loadingObserver = webView.observe(\.isLoading, options: .new) { [weak self] webView, change in
                guard let self = self else { return }
                DispatchQueue.main.async {
                    self.parent.isLoading = change.newValue ?? false
                    // Hide pull-to-refresh spinner when finished loading
                    if !(change.newValue ?? false) {
                        webView.scrollView.refreshControl?.endRefreshing()
                    }
                }
            }
        }
        
        @objc func handleRefresh(_ sender: UIRefreshControl) {
            guard let webView = sender.superview as? UIScrollView,
                  let wkWebView = webView.superview as? WKWebView else {
                sender.endRefreshing()
                return
            }
            
            // Trigger light haptic click
            let impact = UIImpactFeedbackGenerator(style: .light)
            impact.impactOccurred()
            
            wkWebView.reload()
        }
        
        // MARK: - WKNavigationDelegate
        
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.allow)
                return
            }
            
            // Intercept external domains (e.g. clicked news links) and open in Safari
            if let host = url.host {
                let isSnapfacts = host.contains("snapfacts.in") || host.contains("localhost") || host.contains("127.0.0.1")
                if !isSnapfacts && navigationAction.navigationType == .linkActivated {
                    // Open in default Safari browser
                    UIApplication.shared.open(url, options: [:], completionHandler: nil)
                    
                    // Trigger a light haptic cue
                    let feedback = UIImpactFeedbackGenerator(style: .medium)
                    feedback.impactOccurred()
                    
                    decisionHandler(.cancel)
                    return
                }
            }
            
            decisionHandler(.allow)
        }
        
        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            DispatchQueue.main.async {
                self.parent.isOffline = false
            }
        }
        
        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            let nsError = error as NSError
            // Check if connection is lost
            if nsError.code == NSURLErrorNotConnectedToInternet || nsError.code == NSURLErrorCannotFindHost || nsError.code == NSURLErrorTimedOut {
                DispatchQueue.main.async {
                    self.parent.isOffline = true
                }
            }
        }
        
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            DispatchQueue.main.async {
                self.parent.isOffline = false
            }
        }
        
        // MARK: - WKUIDelegate
        
        // Intercept target="_blank" links and open in Safari
        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
            if navigationAction.targetFrame == nil, let url = navigationAction.request.url {
                UIApplication.shared.open(url, options: [:], completionHandler: nil)
                
                let feedback = UIImpactFeedbackGenerator(style: .medium)
                feedback.impactOccurred()
            }
            return nil
        }
    }
}
