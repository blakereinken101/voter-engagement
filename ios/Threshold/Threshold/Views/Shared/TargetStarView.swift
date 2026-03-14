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
