import SwiftUI

/// Gold star indicator for target universe voters.
/// Shows a filled gold star for target voters, grey outline for non-target voters.
/// Only renders when targetUniverse config is active.
/// When `onTap` is provided, the star becomes tappable.
struct TargetStarView: View {
    let isTarget: Bool
    var showLabel: Bool = false
    var size: CGFloat = 16
    var onTap: (() -> Void)? = nil

    var body: some View {
        if let onTap {
            Button(action: onTap) {
                starContent
                    .frame(minWidth: 44, minHeight: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        } else {
            starContent
        }
    }

    private var starContent: some View {
        HStack(spacing: 4) {
            Image(systemName: isTarget ? "star.fill" : "star")
                .font(.system(size: size))
                .foregroundStyle(isTarget ? Color.vcGold : Color.vcSlate.opacity(0.3))

            if showLabel {
                Text(isTarget ? "Target Voter" : "Not in target universe")
                    .font(.caption)
                    .fontWeight(isTarget ? .bold : .regular)
                    .foregroundStyle(isTarget ? Color.vcGold : Color.vcSlate.opacity(0.5))
            }
        }
    }
}

// MARK: - Swipe Hint Arrow

/// Flashing orange arrow pointing left, shown on the far right of list rows
/// to hint that the user can swipe left. Flashes a few times then disappears.
/// Uses @AppStorage so it only ever shows once per install.
struct SwipeHintArrow: View {
    @AppStorage("hasSeenSwipeHint") private var hasSeenHint = false
    @State private var opacity: Double = 1.0
    @State private var dismissed = false

    var body: some View {
        if !hasSeenHint && !dismissed {
            Image(systemName: "chevron.left")
                .font(.caption2.bold())
                .foregroundStyle(Color.orange)
                .opacity(opacity)
                .onAppear {
                    withAnimation(.easeInOut(duration: 0.5).repeatCount(6, autoreverses: true)) {
                        opacity = 0.15
                    }
                    DispatchQueue.main.asyncAfter(deadline: .now() + 3.5) {
                        withAnimation(.easeOut(duration: 0.3)) {
                            dismissed = true
                        }
                        hasSeenHint = true
                    }
                }
        }
    }
}
