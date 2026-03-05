import SwiftUI

struct ToolResultChipView: View {
    let toolResult: ToolResult

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: toolResult.icon)
                .font(.system(size: 10))
            Text(toolResult.label)
                .font(.system(size: 11, weight: .medium))
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(toolResult.chipColor.opacity(0.2))
        .foregroundStyle(toolResult.chipColor)
        .cornerRadius(12)
    }
}
