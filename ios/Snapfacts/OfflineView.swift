import SwiftUI

struct OfflineView: View {
    let onRetry: () -> Void
    
    var body: some View {
        ZStack {
            // Elegant dark-themed background matching modern app designs
            Color(red: 10 / 255, green: 14 / 255, blue: 23 / 255)
                .ignoresSafeArea()
            
            VStack(spacing: 24) {
                Spacer()
                
                // Animated floating visual container
                ZStack {
                    Circle()
                        .fill(
                            LinearGradient(
                                colors: [Color.blue.opacity(0.15), Color.purple.opacity(0.1)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 140, height: 140)
                    
                    Image(systemName: "wifi.slash")
                        .font(.system(size: 48, weight: .semibold))
                        .foregroundColor(.blue)
                        .shadow(color: Color.blue.opacity(0.4), radius: 8, x: 0, y: 4)
                }
                
                VStack(spacing: 12) {
                    Text("Connection Lost")
                        .font(.system(size: 24, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                    
                    Text("Snapfacts needs an active internet connection to load the latest news and clusters. Please check your settings.")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(Color.white.opacity(0.6))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 36)
                        .lineSpacing(4)
                }
                
                Spacer()
                
                // Premium gradient Action Button with micro-interactions
                Button(action: {
                    // Trigger a light haptic impact
                    let impact = UIImpactFeedbackGenerator(style: .medium)
                    impact.impactOccurred()
                    
                    onRetry()
                }) {
                    Text("Try Again")
                        .font(.system(size: 15, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 50)
                        .background(
                            LinearGradient(
                                colors: [Color(red: 9 / 255, green: 145 / 255, blue: 255 / 255), Color(red: 5 / 255, green: 68 / 255, blue: 179 / 255)],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .cornerRadius(16)
                        .shadow(color: Color(red: 5 / 255, green: 68 / 255, blue: 179 / 255).opacity(0.4), radius: 12, x: 0, y: 6)
                }
                .padding(.horizontal, 36)
                .padding(.bottom, 24)
            }
        }
    }
}

struct OfflineView_Previews: PreviewProvider {
    static var previews: some View {
        OfflineView(onRetry: {})
    }
}
