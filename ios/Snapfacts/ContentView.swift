import SwiftUI

struct ContentView: View {
    @State private var progress: Double = 0.0
    @State private var isLoading: Bool = true
    @State private var isOffline: Bool = false
    @State private var reloadTrigger: UUID = UUID()
    
    #if DEBUG
    private let targetURL = URL(string: "http://localhost:8000")!
    #else
    private let targetURL = URL(string: "https://www.snapfacts.in")!
    #endif
    
    var body: some View {
        ZStack(alignment: .top) {
            // Main Web View spanning the full screen (including notch and bottom indicator)
            WebView(
                url: targetURL,
                progress: $progress,
                isLoading: $isLoading,
                isOffline: $isOffline,
                reloadTrigger: reloadTrigger
            )
            .ignoresSafeArea()
            
            // Premium micro-progress loading bar
            if isLoading && progress < 1.0 {
                GeometryReader { geometry in
                    VStack {
                        // Position exactly at the top of safe area (below notch)
                        Rectangle()
                            .fill(
                                LinearGradient(
                                    colors: [Color(red: 9/255, green: 145/255, blue: 255/255), Color(red: 5/255, green: 68/255, blue: 179/255)],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .frame(width: geometry.size.width * CGFloat(progress), height: 3)
                            .animation(.easeOut(duration: 0.1), value: progress)
                        
                        Spacer()
                    }
                }
                .ignoresSafeArea(edges: .bottom) // Ensure bar alignment stays fixed at top
            }
            
            // Native offline fallback screen
            if isOffline {
                OfflineView {
                    // Force webview reload by generating a new trigger uuid
                    reloadTrigger = UUID()
                }
                .transition(.opacity.animation(.easeInOut(duration: 0.35)))
            }
        }
        // Force the app to dark or light interface style automatically based on system preferences
        .preferredColorScheme(.light)
    }
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
    }
}
